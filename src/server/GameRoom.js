const {
  createGameState, getPlayerState, startGame,
  placeCity, selectCapital, placeUnit, movePiece,
  chainCaptureAction, chooseSpecialization, spawnGrunt,
} = require('./GameState');

const rooms = new Map();

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = '';
    for (let i = 0; i < 4; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
  } while (rooms.has(code));
  return code;
}

function setupSocket(io) {
  io.on('connection', (socket) => {
    let currentRoom = null;
    let currentRole = null;

    socket.on('create-room', (callback) => {
      const code = generateRoomCode();
      const gameState = createGameState(code);
      gameState.players.player1.socketId = socket.id;
      rooms.set(code, gameState);

      currentRoom = code;
      currentRole = 'player1';
      socket.join(code);

      callback({ success: true, roomCode: code, role: 'player1' });
    });

    socket.on('join-room', (data, callback) => {
      const code = (data.roomCode || '').toUpperCase();
      const gameState = rooms.get(code);

      if (!gameState) {
        callback({ success: false, reason: 'Room not found' });
        return;
      }
      if (gameState.players.player2.socketId) {
        callback({ success: false, reason: 'Room is full' });
        return;
      }

      gameState.players.player2.socketId = socket.id;
      currentRoom = code;
      currentRole = 'player2';
      socket.join(code);

      // Start the game
      startGame(gameState);

      callback({ success: true, roomCode: code, role: 'player2' });

      // Send game state to both players
      emitToPlayer(io, gameState, 'player1');
      emitToPlayer(io, gameState, 'player2');
    });

    socket.on('place-city', (data, callback) => {
      if (!currentRoom || !currentRole) {
        callback({ success: false, reason: 'Not in a room' });
        return;
      }
      const gameState = rooms.get(currentRoom);
      if (!gameState) {
        callback({ success: false, reason: 'Room not found' });
        return;
      }

      const result = placeCity(gameState, currentRole, data.q, data.r);
      callback(result);

      if (result.success) {
        emitToPlayer(io, gameState, 'player1');
        emitToPlayer(io, gameState, 'player2');
      }
    });

    socket.on('select-capital', (data, callback) => {
      if (!currentRoom || !currentRole) {
        callback({ success: false, reason: 'Not in a room' });
        return;
      }
      const gameState = rooms.get(currentRoom);
      if (!gameState) {
        callback({ success: false, reason: 'Room not found' });
        return;
      }

      const result = selectCapital(gameState, currentRole, data.q, data.r);
      callback(result);

      if (result.success) {
        emitToPlayer(io, gameState, 'player1');
        emitToPlayer(io, gameState, 'player2');
      }
    });

    socket.on('place-unit', (data, callback) => {
      if (!currentRoom || !currentRole) {
        callback({ success: false, reason: 'Not in a room' });
        return;
      }
      const gameState = rooms.get(currentRoom);
      if (!gameState) {
        callback({ success: false, reason: 'Room not found' });
        return;
      }

      const result = placeUnit(gameState, currentRole, data.q, data.r, data.unitType, data.specialization);
      callback(result);

      if (result.success) {
        emitToPlayer(io, gameState, 'player1');
        emitToPlayer(io, gameState, 'player2');
      }
    });

    socket.on('move-piece', (data, callback) => {
      if (!currentRoom || !currentRole) {
        callback({ success: false, reason: 'Not in a room' });
        return;
      }
      const gameState = rooms.get(currentRoom);
      if (!gameState) {
        callback({ success: false, reason: 'Room not found' });
        return;
      }

      const result = movePiece(gameState, currentRole, data.fromQ, data.fromR, data.toQ, data.toR);
      callback(result);

      if (result.success) {
        emitToPlayer(io, gameState, 'player1');
        emitToPlayer(io, gameState, 'player2');
      }
    });

    socket.on('chain-capture', (data, callback) => {
      if (!currentRoom || !currentRole) {
        callback({ success: false, reason: 'Not in a room' });
        return;
      }
      const gameState = rooms.get(currentRoom);
      if (!gameState) {
        callback({ success: false, reason: 'Room not found' });
        return;
      }

      const result = chainCaptureAction(gameState, currentRole, data.toQ, data.toR, data.pass);
      callback(result);

      if (result.success) {
        emitToPlayer(io, gameState, 'player1');
        emitToPlayer(io, gameState, 'player2');
      }
    });

    socket.on('choose-specialization', (data, callback) => {
      if (!currentRoom || !currentRole) {
        callback({ success: false, reason: 'Not in a room' });
        return;
      }
      const gameState = rooms.get(currentRoom);
      if (!gameState) {
        callback({ success: false, reason: 'Room not found' });
        return;
      }

      const result = chooseSpecialization(gameState, currentRole, data.specialization);
      callback(result);

      if (result.success) {
        emitToPlayer(io, gameState, 'player1');
        emitToPlayer(io, gameState, 'player2');
      }
    });

    socket.on('spawn-grunt', (data, callback) => {
      if (!currentRoom || !currentRole) {
        callback({ success: false, reason: 'Not in a room' });
        return;
      }
      const gameState = rooms.get(currentRoom);
      if (!gameState) {
        callback({ success: false, reason: 'Room not found' });
        return;
      }

      const result = spawnGrunt(gameState, currentRole, data.cityQ, data.cityR, data.spawnQ, data.spawnR);
      callback(result);

      if (result.success) {
        emitToPlayer(io, gameState, 'player1');
        emitToPlayer(io, gameState, 'player2');
      }
    });

    socket.on('disconnect', () => {
      if (currentRoom) {
        const gameState = rooms.get(currentRoom);
        if (gameState) {
          // Notify opponent
          const opponentRole = currentRole === 'player1' ? 'player2' : 'player1';
          const opponentSocket = gameState.players[opponentRole].socketId;
          if (opponentSocket) {
            io.to(opponentSocket).emit('opponent-disconnected');
          }

          // Keep room alive for 5 minutes for reconnection
          setTimeout(() => {
            const gs = rooms.get(currentRoom);
            if (gs && !gs.players[currentRole].socketId) {
              rooms.delete(currentRoom);
            }
          }, 5 * 60 * 1000);

          gameState.players[currentRole].socketId = null;
        }
      }
    });

    socket.on('rejoin-room', (data, callback) => {
      const code = (data.roomCode || '').toUpperCase();
      const gameState = rooms.get(code);
      if (!gameState) {
        callback({ success: false, reason: 'Room not found' });
        return;
      }

      const role = data.role;
      if (!gameState.players[role]) {
        callback({ success: false, reason: 'Cannot rejoin' });
        return;
      }

      const existingSocketId = gameState.players[role].socketId;
      if (existingSocketId && existingSocketId !== socket.id) {
        // Old socket might still be lingering (refresh before disconnect fires)
        // Check if the old socket is actually connected
        const existingSocket = io.sockets.sockets.get(existingSocketId);
        if (existingSocket) {
          existingSocket.disconnect(true); // force disconnect old socket
        }
      }

      gameState.players[role].socketId = socket.id;
      currentRoom = code;
      currentRole = role;
      socket.join(code);

      callback({ success: true, role });
      emitToPlayer(io, gameState, role);

      // Notify opponent
      const opponentRole = role === 'player1' ? 'player2' : 'player1';
      const opponentSocket = gameState.players[opponentRole].socketId;
      if (opponentSocket) {
        io.to(opponentSocket).emit('opponent-reconnected');
      }
    });
  });
}

function emitToPlayer(io, gameState, playerRole) {
  const socketId = gameState.players[playerRole].socketId;
  if (socketId) {
    io.to(socketId).emit('state-update', getPlayerState(gameState, playerRole));
  }
}

module.exports = { setupSocket };
