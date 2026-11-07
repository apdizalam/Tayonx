import { io } from 'socket.io-client';
import { API_BASE_URL } from './lib/api.js';

export function createChatSocket(token) {
  const socketUrl = API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:5000' : window.location.origin);
  return io(socketUrl, {
    autoConnect: false,
    auth: { token },
  });
}