import { io } from "socket.io-client";

// Ku xirashada Backend Server-ka (Port 5000)
const SOCKET_URL = "http://localhost:5000";
export const socket = io(SOCKET_URL);