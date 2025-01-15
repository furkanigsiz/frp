import io from 'socket.io-client';

const SOCKET_URL = process.env.NODE_ENV === 'production'
  ? 'https://frp-p70d.onrender.com'  // Production URL
  : 'http://localhost:5000';         // Development URL

console.log('Connecting to socket server at:', SOCKET_URL);

const socket = io(SOCKET_URL, {
  transports: ['websocket', 'polling'],
  withCredentials: true,
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