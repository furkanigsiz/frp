import io from 'socket.io-client';

const SOCKET_URL = process.env.NODE_ENV === 'production'
  ? 'https://frp-p70d.onrender.com'  // Production URL
  : 'http://localhost:5000';         // Development URL

const socket = io(SOCKET_URL, {
  transports: ['websocket'],
  upgrade: false
});

export default socket; 