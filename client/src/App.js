import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Container, Box, Typography, TextField, Button, Paper, Select, MenuItem, FormControl, InputLabel, Grid, Slider, LinearProgress, Dialog, DialogTitle, DialogContent, DialogActions, IconButton } from '@mui/material';
import { PlayArrow, Pause, VolumeUp, VolumeOff } from '@mui/icons-material';
import io from 'socket.io-client';
import './App.css';

const socket = io('http://localhost:5000');

const KARAKTER_SINIFLARI = ['Savaşçı', 'Büyücü', 'Okçu', 'Şifacı', 'Hırsız'];
const BAŞLANGIÇ_STAT_PUANI = 20;

const THEMES = {
  default: { name: 'Han', icon: '🏠' },
  boss: { name: 'Boss Savaşı', icon: '👿' },
  forest: { name: 'Orman', icon: '🌲' },
  dungeon: { name: 'Zindan', icon: '🏰' },
  combat: { name: 'Savaş', icon: '⚔️' },
  victory: { name: 'Zafer', icon: '🏆' }
};

function App() {
  const [playerName, setPlayerName] = useState('');
  const [characterClass, setCharacterClass] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [players, setPlayers] = useState([]);
  const [diceResult, setDiceResult] = useState(null);
  const [isDM, setIsDM] = useState(false);
  const [story, setStory] = useState('');
  const [currentTurn, setCurrentTurn] = useState(null);
  const [turnOrder, setTurnOrder] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [levelUpOpen, setLevelUpOpen] = useState(false);
  const [newLevel, setNewLevel] = useState(null);
  const [pendingStats, setPendingStats] = useState(0);
  const [stats, setStats] = useState({
    güç: 0,
    çeviklik: 0,
    dayanıklılık: 0,
    zeka: 0,
    karizma: 0
  });
  const [remainingPoints, setRemainingPoints] = useState(BAŞLANGIÇ_STAT_PUANI);
  const [ambiance, setAmbiance] = useState({ background: 'default', music: null, isPlaying: false });
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef(null);

  // Müzik yükleme ve çalma işleyicisi
  const handleAudioPlay = useCallback(async () => {
    try {
      if (audioRef.current) {
        if (ambiance.music) {
          // URL'yi düzgün şekilde oluştur
          const audioPath = `${process.env.PUBLIC_URL}/${ambiance.music}`;
          console.log('Loading audio:', audioPath);
          
          // Eğer aynı müzik çalıyorsa, sadece play/pause durumunu değiştir
          if (audioRef.current.src === window.location.origin + audioPath) {
            if (ambiance.isPlaying) {
              try {
                await audioRef.current.play();
                console.log('Resumed existing audio');
              } catch (error) {
                console.error('Error resuming audio:', error);
              }
            } else {
              audioRef.current.pause();
              console.log('Paused existing audio');
            }
            return;
          }

          // Yeni müzik yükle
          audioRef.current.src = audioPath;
          audioRef.current.load();
          
          if (ambiance.isPlaying) {
            try {
              await new Promise((resolve, reject) => {
                audioRef.current.oncanplaythrough = resolve;
                audioRef.current.onerror = reject;
                // 5 saniye sonra timeout
                setTimeout(reject, 5000);
              });
              await audioRef.current.play();
              console.log('New audio started playing');
            } catch (error) {
              console.error('Error playing new audio:', error);
              setAmbiance(prev => ({ ...prev, isPlaying: false }));
            }
          }
        } else {
          // Müzik yoksa durdur
          audioRef.current.pause();
          audioRef.current.src = '';
        }
      }
    } catch (error) {
      console.error('Audio handling error:', error);
    }
  }, [ambiance.music, ambiance.isPlaying]);

  useEffect(() => {
    socket.on('playersList', (playersList) => {
      setPlayers(playersList);
      // Kendi karakterimizi bul ve stat bilgilerini güncelle
      const myPlayer = playersList.find(p => p.id === socket.id);
      if (myPlayer) {
        setPendingStats(myPlayer.character.pendingStats);
      }
    });

    socket.on('diceResult', (result) => {
      setDiceResult(result);
      setTimeout(() => setDiceResult(null), 3000);
    });

    socket.on('storyUpdate', (newStory) => {
      setStory(newStory);
    });

    socket.on('dmAssigned', (dmId) => {
      setIsDM(dmId === socket.id);
    });

    socket.on('turnUpdate', ({ currentTurn: newTurn, turnOrder: newOrder }) => {
      setCurrentTurn(newTurn);
      setTurnOrder(newOrder);
    });

    socket.on('levelUp', ({ newLevel, pendingStats }) => {
      setNewLevel(newLevel);
      setPendingStats(pendingStats);
      setLevelUpOpen(true);
    });

    socket.on('ambianceUpdate', (newAmbiance) => {
      console.log('Received new ambiance:', newAmbiance);
      setAmbiance(newAmbiance);
      if (!isMuted) {
        handleAudioPlay();
      }
    });

    socket.on('musicControl', (action) => {
      console.log('Received music control:', action);
      if (!isMuted) {
        if (action === 'play') {
          handleAudioPlay();
        } else {
          if (audioRef.current) {
            audioRef.current.pause();
          }
        }
      }
    });

    return () => {
      socket.off('playersList');
      socket.off('diceResult');
      socket.off('storyUpdate');
      socket.off('dmAssigned');
      socket.off('turnUpdate');
      socket.off('levelUp');
      socket.off('ambianceUpdate');
      socket.off('musicControl');
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, [isMuted, handleAudioPlay]);

  const handleStatChange = (stat, value) => {
    const newValue = parseInt(value) || 0;
    const oldValue = stats[stat];
    const pointDifference = newValue - oldValue;
    
    if (remainingPoints - pointDifference >= 0 && newValue >= 0 && newValue <= 10) {
      setStats({ ...stats, [stat]: newValue });
      setRemainingPoints(remainingPoints - pointDifference);
    }
  };

  const handleLevelUpStatChange = (stat, value) => {
    const player = players.find(p => p.id === socket.id);
    if (player && pendingStats > 0) {
      const newValue = parseInt(value);
      if (newValue > player.character.stats[stat]) {
        socket.emit('updateStats', { stat, value: newValue });
      }
    }
  };

  const handleJoin = () => {
    if (playerName.trim() && characterClass && remainingPoints === 0) {
      socket.emit('playerJoin', {
        name: playerName,
        character: {
          class: characterClass,
          level: 1,
          stats: stats
        }
      });
      setIsJoined(true);
    }
  };

  const handleDMRequest = () => {
    socket.emit('requestDM');
  };

  const handleStoryUpdate = (newStory) => {
    socket.emit('updateStory', newStory);
    setStory(newStory);
  };

  const handleRollDice = (diceType) => {
    socket.emit('rollDice', diceType);
  };

  const handlePlayerUpdate = (playerId, updates) => {
    socket.emit('updatePlayer', { playerId, updates });
  };

  const isMyTurn = currentTurn === socket.id;

  const LevelUpDialog = () => {
    const player = players.find(p => p.id === socket.id);
    if (!player) return null;

    return (
      <Dialog open={levelUpOpen} onClose={() => pendingStats === 0 && setLevelUpOpen(false)}>
        <DialogTitle>
          Seviye Atladın! (Seviye {newLevel})
        </DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Dağıtılacak Stat Puanı: {pendingStats}
          </Typography>
          {Object.keys(stats).map((stat) => (
            <Box key={stat} sx={{ mb: 2 }}>
              <Typography gutterBottom>
                {stat.charAt(0).toUpperCase() + stat.slice(1)}: {player.character.stats[stat]}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => handleLevelUpStatChange(stat, player.character.stats[stat] + 1)}
                  disabled={pendingStats === 0}
                >
                  +1
                </Button>
              </Box>
            </Box>
          ))}
        </DialogContent>
        <DialogActions>
          <Typography color="text.secondary">
            {pendingStats > 0 ? `${pendingStats} puan daha dağıtmalısın` : 'Tüm puanlar dağıtıldı'}
          </Typography>
          <Button
            onClick={() => setLevelUpOpen(false)}
            disabled={pendingStats > 0}
          >
            Tamam
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  const handleThemeChange = (theme) => {
    socket.emit('updateAmbiance', {
      theme,
      musicAction: 'play'
    });
  };

  const handleMusicControl = (action) => {
    if (action === 'play' && !isMuted) {
      handleAudioPlay();
    }
    socket.emit('controlMusic', action);
  };

  const toggleMute = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    if (audioRef.current) {
      audioRef.current.muted = newMutedState;
      if (!newMutedState && ambiance.isPlaying) {
        handleAudioPlay();
      }
    }
  };

  const containerStyle = {
    minHeight: '100vh',
    backgroundImage: ambiance.background ? `url(${process.env.PUBLIC_URL}/${ambiance.background})` : 'none',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundAttachment: 'fixed',
    transition: 'background-image 0.5s ease-in-out'
  };

  const DMControls = () => {
    if (!isDM) return null;

    return (
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          DM Kontrolleri
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {Object.entries(THEMES).map(([key, theme]) => (
            <Button
              key={key}
              variant="outlined"
              onClick={() => handleThemeChange(key)}
              startIcon={<span>{theme.icon}</span>}
              sx={{ minWidth: '120px' }}
            >
              {theme.name}
            </Button>
          ))}
        </Box>
        <Box sx={{ mt: 2, display: 'flex', gap: 1, alignItems: 'center' }}>
          <IconButton onClick={() => handleMusicControl(ambiance.isPlaying ? 'pause' : 'play')}>
            {ambiance.isPlaying ? <Pause /> : <PlayArrow />}
          </IconButton>
          <IconButton onClick={toggleMute}>
            {isMuted ? <VolumeOff /> : <VolumeUp />}
          </IconButton>
          <Typography variant="body2" color="text.secondary">
            {ambiance.isPlaying ? 'Müzik Çalıyor' : 'Müzik Duraklatıldı'}
          </Typography>
        </Box>
      </Paper>
    );
  };

  const AudioPlayer = () => (
    <audio
      ref={audioRef}
      loop
      preload="auto"
      style={{ display: 'none' }}
      onError={(e) => {
        console.error('Audio error:', e.target.error);
        console.error('Audio src:', audioRef.current?.src);
        console.error('Audio error code:', e.target.error?.code);
        console.error('Audio error message:', e.target.error?.message);
        // Hata durumunda müziği duraklat
        setAmbiance(prev => ({ ...prev, isPlaying: false }));
      }}
      onLoadStart={() => console.log('Audio loading started')}
      onLoadedData={() => console.log('Audio data loaded')}
      onCanPlay={() => console.log('Audio can play')}
      onPlay={() => console.log('Audio started playing')}
      onPause={() => console.log('Audio paused')}
      onCanPlayThrough={() => console.log('Audio can play through')}
      controls // Geçici olarak kontrolleri göster (test için)
    />
  );

  if (!isJoined) {
    return (
      <Box style={containerStyle}>
        <Container maxWidth="md">
          <Box sx={{ mt: 8, textAlign: 'center' }}>
            <Typography variant="h4" gutterBottom>
              FRP Oyununa Hoş Geldiniz
            </Typography>
            <Box sx={{ mt: 4 }}>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Karakter Adı"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Karakter Sınıfı</InputLabel>
                    <Select
                      value={characterClass}
                      onChange={(e) => setCharacterClass(e.target.value)}
                      label="Karakter Sınıfı"
                    >
                      {KARAKTER_SINIFLARI.map((sinif) => (
                        <MenuItem key={sinif} value={sinif}>{sinif}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom>
                    Karakter Özellikleri (Kalan Puan: {remainingPoints})
                  </Typography>
                  {Object.keys(stats).map((stat) => (
                    <Box key={stat} sx={{ mb: 2 }}>
                      <TextField
                        fullWidth
                        label={stat.charAt(0).toUpperCase() + stat.slice(1)}
                        type="number"
                        value={stats[stat]}
                        onChange={(e) => handleStatChange(stat, e.target.value)}
                        inputProps={{ min: 0, max: 10 }}
                      />
                    </Box>
                  ))}
                </Grid>
                <Grid item xs={12}>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={handleJoin}
                    disabled={!playerName.trim() || !characterClass || remainingPoints !== 0}
                    fullWidth
                  >
                    Oyuna Katıl
                  </Button>
                </Grid>
              </Grid>
            </Box>
          </Box>
        </Container>
        <AudioPlayer />
      </Box>
    );
  }

  return (
    <Box style={containerStyle}>
      <Container>
        <Box sx={{ mt: 4, bgcolor: 'rgba(255, 255, 255, 0.9)', p: 3, borderRadius: 2 }}>
          <Typography variant="h4" gutterBottom>
            FRP Oyunu
            {pendingStats > 0 && (
              <Button
                variant="contained"
                color="secondary"
                onClick={() => setLevelUpOpen(true)}
                sx={{ ml: 2 }}
              >
                Dağıtılmamış Statlar ({pendingStats})
              </Button>
            )}
          </Typography>

          <DMControls />
          
          <Box sx={{ display: 'flex', gap: 2, mb: 4, flexDirection: 'column' }}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Hikaye
              </Typography>
              {isDM ? (
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  value={story}
                  onChange={(e) => handleStoryUpdate(e.target.value)}
                  placeholder="Hikayenizi buraya yazın..."
                />
              ) : (
                <Typography>{story || 'Henüz bir hikaye başlamadı...'}</Typography>
              )}
            </Paper>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <Paper sx={{ p: 2, flex: 1 }}>
                <Typography variant="h6" gutterBottom>
                  Zar At {isMyTurn && '(Senin Sıran!)'}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {[4, 6, 8, 10, 12, 20].map((dice) => (
                    <Button
                      key={dice}
                      variant="outlined"
                      onClick={() => handleRollDice(dice)}
                      disabled={!isMyTurn && !isDM}
                    >
                      d{dice}
                    </Button>
                  ))}
                </Box>
                {diceResult && (
                  <Box sx={{ mt: 2, p: 2, bgcolor: 'rgba(0,0,0,0.05)', borderRadius: 1 }}>
                    <Typography>
                      {diceResult.playerName}: d{diceResult.diceType} = {diceResult.result}
                    </Typography>
                  </Box>
                )}
                {turnOrder.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Sıra Düzeni:
                    </Typography>
                    {turnOrder.map((name, index) => (
                      <Typography
                        key={index}
                        sx={{
                          color: name === players.find(p => p.id === currentTurn)?.name
                            ? 'primary.main'
                            : 'text.secondary'
                        }}
                      >
                        {index + 1}. {name}
                      </Typography>
                    ))}
                  </Box>
                )}
              </Paper>

              <Paper sx={{ p: 2, flex: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">
                    Aktif Oyuncular
                  </Typography>
                  {!isDM && (
                    <Button
                      variant="contained"
                      onClick={handleDMRequest}
                      disabled={players.some(p => p.isDM)}
                    >
                      DM Ol
                    </Button>
                  )}
                </Box>
                {players.map((player) => (
                  <Box
                    key={player.id}
                    sx={{
                      mb: 2,
                      p: 1,
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                      cursor: isDM ? 'pointer' : 'default',
                      bgcolor: selectedPlayer?.id === player.id ? 'action.selected' : 'transparent'
                    }}
                    onClick={() => isDM && setSelectedPlayer(player)}
                  >
                    <Typography>
                      {player.name} - {player.character.class} Seviye {player.character.level}
                      {player.isDM && ' (DM)'}
                    </Typography>
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        HP: {player.character.hp}/{player.character.maxHp}
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={(player.character.hp / player.character.maxHp) * 100}
                        sx={{ mt: 0.5 }}
                      />
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        XP: {player.character.experience}/{player.character.nextLevelExp}
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={(player.character.experience / player.character.nextLevelExp) * 100}
                        sx={{ mt: 0.5 }}
                      />
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Güç: {player.character.stats.güç}, 
                      Çeviklik: {player.character.stats.çeviklik}, 
                      Dayanıklılık: {player.character.stats.dayanıklılık}, 
                      Zeka: {player.character.stats.zeka}, 
                      Karizma: {player.character.stats.karizma}
                    </Typography>
                  </Box>
                ))}
                
                {isDM && selectedPlayer && (
                  <Paper sx={{ p: 2, mt: 2 }}>
                    <Typography variant="h6" gutterBottom>
                      Oyuncu Düzenle: {selectedPlayer.name}
                    </Typography>
                    <Box sx={{ mb: 2 }}>
                      <Typography gutterBottom>HP Ayarla</Typography>
                      <Slider
                        value={selectedPlayer.character.hp}
                        onChange={(e, newValue) => handlePlayerUpdate(selectedPlayer.id, { hp: newValue })}
                        min={0}
                        max={selectedPlayer.character.maxHp}
                        valueLabelDisplay="auto"
                      />
                    </Box>
                    <Box sx={{ mb: 2 }}>
                      <Typography gutterBottom>XP Ekle</Typography>
                      <Button
                        variant="outlined"
                        onClick={() => handlePlayerUpdate(selectedPlayer.id, {
                          experience: selectedPlayer.character.experience + 50
                        })}
                      >
                        +50 XP
                      </Button>
                    </Box>
                  </Paper>
                )}
              </Paper>
            </Box>
          </Box>
        </Box>
      </Container>
      <LevelUpDialog />
      <AudioPlayer />
    </Box>
  );
}

export default App;
