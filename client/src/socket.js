import io from 'socket.io-client';

const SOCKET_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:5000'
  : window.location.origin;

console.log('Connecting to socket server at:', SOCKET_URL);

const socket = io(SOCKET_URL, {
  transports: ['websocket'],
  withCredentials: false,
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 20000
});

socket.on('connect', () => {
  console.log('Socket.io bağlantısı başarılı');
});

socket.on('connect_error', (error) => {
  console.error('Socket.io bağlantı hatası:', error);
  console.log('Bağlantı URL:', SOCKET_URL);
});

socket.on('disconnect', (reason) => {
  console.log('Socket.io bağlantısı koptu:', reason);
});

export default socket; 