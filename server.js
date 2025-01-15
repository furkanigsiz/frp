const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Production için CORS ayarları
const io = socketIo(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? '*'  // Tüm domainlere izin ver
      : "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ["my-custom-header"]
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000
});

app.use(cors());
app.use(express.json());

// Production için statik dosyaları servis et
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'client/build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
  });
} else {
  // Development için statik dosyaları servis et
  app.use(express.static(path.join(__dirname, 'client/public')));
}

// Müzik ve arka plan dosyalarını servis et
app.get('/music/:file', (req, res) => {
  const filePath = process.env.NODE_ENV === 'production'
    ? path.join(__dirname, 'client/build/music', req.params.file)
    : path.join(__dirname, 'client/public/music', req.params.file);
  res.sendFile(filePath);
});

app.get('/backgrounds/:file', (req, res) => {
  const filePath = process.env.NODE_ENV === 'production'
    ? path.join(__dirname, 'client/build/backgrounds', req.params.file)
    : path.join(__dirname, 'client/public/backgrounds', req.params.file);
  res.sendFile(filePath);
});

// Oyun durumu
const gameState = {
  players: new Map(),
  story: '',
  dmId: null,
  currentTurn: null,
  turnOrder: [],
  ambiance: {
    background: 'backgrounds/tavern.jpg',
    music: 'music/tavern.mp3',
    isPlaying: false
  }
};

// Kullanılabilir temalar ve müzikler
const THEMES = {
  default: {
    background: 'backgrounds/tavern.jpg',
    music: 'music/tavern.mp3'
  },
  boss: {
    background: 'backgrounds/boss.jpg',
    music: 'music/boss.mp3'
  },
  forest: {
    background: 'backgrounds/forest.jpg',
    music: 'music/forest.mp3'
  },
  dungeon: {
    background: 'backgrounds/dungeon.jpg',
    music: 'music/dungeon.mp3'
  },
  combat: {
    background: 'backgrounds/combat.jpg',
    music: 'music/battle.mp3'
  },
  victory: {
    background: 'backgrounds/victory.jpg',
    music: 'music/victory.mp3'
  }
};

// Başlangıç HP hesaplama
const calculateBaseHP = (character) => {
  const baseHP = {
    'Savaşçı': 30,
    'Büyücü': 20,
    'Okçu': 25,
    'Şifacı': 22,
    'Hırsız': 24
  };

  return baseHP[character.class] + (character.stats.dayanıklılık * 2);
};

// Socket.IO bağlantı yönetimi
io.on('connection', (socket) => {
  console.log('Yeni oyuncu bağlandı:', socket.id);

  // Yeni bağlanan oyuncuya mevcut ambiyansı gönder
  socket.emit('ambianceUpdate', gameState.ambiance);

  // Oyuncu katılma
  socket.on('playerJoin', (playerData) => {
    const baseHP = calculateBaseHP(playerData.character);
    const player = {
      id: socket.id,
      name: playerData.name,
      character: {
        ...playerData.character,
        hp: baseHP,
        maxHp: baseHP,
        experience: 0,
        nextLevelExp: 100,
        pendingStats: 0,
        baseStats: { ...playerData.character.stats }
      },
      isDM: false
    };
    gameState.players.set(socket.id, player);
    gameState.turnOrder.push(socket.id);
    
    if (gameState.currentTurn === null && gameState.turnOrder.length > 0) {
      gameState.currentTurn = gameState.turnOrder[0];
    }
    
    io.emit('playersList', Array.from(gameState.players.values()));
    io.emit('turnUpdate', {
      currentTurn: gameState.currentTurn,
      turnOrder: gameState.turnOrder.map(id => gameState.players.get(id)?.name)
    });
    
    if (gameState.story) {
      socket.emit('storyUpdate', gameState.story);
    }
  });

  // Ambiyans değiştirme (sadece DM)
  socket.on('updateAmbiance', ({ theme, musicAction }) => {
    if (socket.id === gameState.dmId && THEMES[theme]) {
      gameState.ambiance = {
        background: THEMES[theme].background,
        music: THEMES[theme].music,
        isPlaying: musicAction === 'play'
      };
      io.emit('ambianceUpdate', gameState.ambiance);
    }
  });

  // Müzik kontrolü (sadece DM)
  socket.on('controlMusic', (action) => {
    if (socket.id === gameState.dmId) {
      gameState.ambiance.isPlaying = action === 'play';
      io.emit('musicControl', action);
    }
  });

  // Stat güncelleme
  socket.on('updateStats', ({ stat, value }) => {
    const player = gameState.players.get(socket.id);
    if (player && player.character.pendingStats > 0) {
      // Stat değerinin başlangıç değerinden düşük olmamasını kontrol et
      const baseStatValue = player.character.baseStats[stat];
      if (value >= baseStatValue) {
        const oldValue = player.character.stats[stat];
        player.character.stats[stat] = value;
        
        // Eğer stat artırıldıysa, kalan stat puanını azalt
        if (value > oldValue) {
          player.character.pendingStats--;
        }

        // HP'yi güncelle (eğer dayanıklılık değiştiyse)
        if (stat === 'dayanıklılık') {
          const newMaxHp = calculateBaseHP(player.character);
          const hpDifference = newMaxHp - player.character.maxHp;
          player.character.maxHp = newMaxHp;
          player.character.hp += hpDifference;
        }

        gameState.players.set(socket.id, player);
        io.emit('playersList', Array.from(gameState.players.values()));
      }
    }
  });

  // DM olma isteği
  socket.on('requestDM', () => {
    if (!gameState.dmId) {
      gameState.dmId = socket.id;
      const player = gameState.players.get(socket.id);
      if (player) {
        player.isDM = true;
        gameState.players.set(socket.id, player);
      }
      io.emit('playersList', Array.from(gameState.players.values()));
      io.emit('dmAssigned', socket.id);
    }
  });

  // Hikaye güncelleme
  socket.on('updateStory', (newStory) => {
    if (socket.id === gameState.dmId) {
      gameState.story = newStory;
      io.emit('storyUpdate', newStory);
    }
  });

  // Zar atma
  socket.on('rollDice', (diceType) => {
    const player = gameState.players.get(socket.id);
    if (socket.id === gameState.currentTurn || player.isDM) {
      const result = Math.floor(Math.random() * diceType) + 1;
      io.emit('diceResult', {
        playerId: socket.id,
        playerName: player.name,
        result: result,
        diceType: diceType
      });

      // Sırayı bir sonraki oyuncuya geçir (DM değilse)
      if (!player.isDM) {
        const currentIndex = gameState.turnOrder.indexOf(socket.id);
        const nextIndex = (currentIndex + 1) % gameState.turnOrder.length;
        gameState.currentTurn = gameState.turnOrder[nextIndex];
        
        io.emit('turnUpdate', {
          currentTurn: gameState.currentTurn,
          turnOrder: gameState.turnOrder.map(id => gameState.players.get(id)?.name)
        });
      }
    }
  });

  // DM oyuncu güncelleme (HP, Seviye, XP)
  socket.on('updatePlayer', ({ playerId, updates }) => {
    if (socket.id === gameState.dmId) {
      const player = gameState.players.get(playerId);
      if (player) {
        // HP güncelleme
        if (updates.hp !== undefined) {
          player.character.hp = Math.min(updates.hp, player.character.maxHp);
        }
        
        // Seviye ve XP güncelleme
        if (updates.experience !== undefined) {
          const oldLevel = player.character.level;
          player.character.experience = updates.experience;
          
          // Seviye atlama kontrolü
          while (player.character.experience >= player.character.nextLevelExp) {
            player.character.level += 1;
            player.character.maxHp += 5;
            player.character.hp = player.character.maxHp;
            player.character.nextLevelExp *= 2;
            player.character.pendingStats += 3; // Her seviyede 3 stat puanı ekle
          }

          // Seviye atladıysa bildirim gönder
          if (player.character.level > oldLevel) {
            io.to(playerId).emit('levelUp', {
              newLevel: player.character.level,
              pendingStats: player.character.pendingStats
            });
          }
        }
        
        gameState.players.set(playerId, player);
        io.emit('playersList', Array.from(gameState.players.values()));
      }
    }
  });

  // Bağlantı koptuğunda
  socket.on('disconnect', () => {
    if (socket.id === gameState.dmId) {
      gameState.dmId = null;
    }
    
    // Oyuncuyu sıra listesinden çıkar
    const playerIndex = gameState.turnOrder.indexOf(socket.id);
    if (playerIndex > -1) {
      gameState.turnOrder.splice(playerIndex, 1);
    }
    
    // Eğer sırası gelen oyuncu çıktıysa, sırayı sonraki oyuncuya geçir
    if (socket.id === gameState.currentTurn && gameState.turnOrder.length > 0) {
      const nextIndex = playerIndex % gameState.turnOrder.length;
      gameState.currentTurn = gameState.turnOrder[nextIndex];
    } else if (gameState.turnOrder.length === 0) {
      gameState.currentTurn = null;
    }
    
    gameState.players.delete(socket.id);
    io.emit('playersList', Array.from(gameState.players.values()));
    io.emit('turnUpdate', {
      currentTurn: gameState.currentTurn,
      turnOrder: gameState.turnOrder.map(id => gameState.players.get(id)?.name)
    });
    
    console.log('Oyuncu ayrıldı:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Sunucu ${PORT} portunda çalışıyor`);
}); 