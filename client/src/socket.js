import io from 'socket.io-client';

const SOCKET_URL = process.env.NODE_ENV === 'production'
  ? window.location.origin
  : 'http://localhost:5000';

console.log('Connecting to socket server at:', SOCKET_URL);

const socket = io(SOCKET_URL, {
  transports: ['polling', 'websocket'],
  withCredentials: true,
  forceNew: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 20000,
  auth: {
    token: "your-auth-token" // İsteğe bağlı, güvenlik için eklenebilir
  }
});

socket.on('connect', () => {
  console.log('Socket.io bağlantısı başarılı');
});

socket.on('connect_error', (error) => {
  console.error('Socket.io bağlantı hatası:', error);
  console.log('Bağlantı URL:', SOCKET_URL);
  console.log('Transport:', socket.io.engine.transport.name);
});

socket.on('disconnect', (reason) => {
  console.log('Socket.io bağlantısı koptu:', reason);
});

export default socket; 