const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { setupSocket } = require('./src/server/GameRoom');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from client directory
app.use(express.static(path.join(__dirname, 'src', 'client')));

// Setup socket handlers
setupSocket(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Hexachess server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
});
