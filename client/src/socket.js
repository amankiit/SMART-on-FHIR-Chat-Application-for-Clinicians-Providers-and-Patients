import { io } from 'socket.io-client';
import { API_BASE } from './api';

let socket;

export function getSocket() {
  if (!socket) {
    socket = io(API_BASE, {
      withCredentials: true,
      transports: ['websocket', 'polling']
    });
  }
  return socket;
}
