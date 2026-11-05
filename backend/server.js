const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Express Middleware
app.use(cors());
app.use(express.json());

// Socket.io Setup (Real-Time Chat)
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // ama Port-ka uu React ku shaqaynayo
    methods: ["GET", "POST"]
  }
});

// MongoDB Atlas Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Atlas connected successfully!'))
  .catch((err) => console.error('❌ Database connection error:', err));

// Socket.io Listener
io.on('connection', (socket) => {
  console.log(`⚡ User Connected: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log('🔥 User Disconnected');
  });
});

// Test Route
app.get('/', (req, res) => {
  res.send('Tayonx API Engine is running...');
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});