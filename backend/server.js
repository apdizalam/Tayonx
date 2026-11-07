const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();
const authRoutes = require('./routes/auth');
const requestRoutes = require('./routes/requests');
const userRoutes = require('./routes/users');

const app = express();
const server = http.createServer(app);

const allowedOrigins = process.env.FRONTEND_ORIGIN
  ? [process.env.FRONTEND_ORIGIN]
  : ['http://localhost:5173', 'http://127.0.0.1:5173'];

// Express Middleware
app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  credentials: true
}));

app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/users', userRoutes);

// Socket.io Setup (Real-Time)
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
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