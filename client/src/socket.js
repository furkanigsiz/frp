import io from 'socket.io-client';

const SOCKET_URL = process.env.NODE_ENV === 'production'
  ? window.location.origin  // Production URL - otomatik olarak mevcut domain'i kullan
  : 'http://localhost:5000';

console.log('Connecting to socket server at:', SOCKET_URL);

const socket = io(SOCKET_URL, {
  transports: ['websocket', 'polling'],
  upgrade: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000
});

socket.on('connect', () => {
  console.log('Socket.io bağlantısı başarılı');
});

socket.on('connect_error', (error) => {
  console.error('Socket.io bağlantı hatası:', error);
});

socket.on('disconnect', (reason) => {
  console.log('Socket.io bağlantısı koptu:', reason);
});

export default socket; 