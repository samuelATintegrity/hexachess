/**
 * Lobby UI - create/join rooms.
 */

function initLobby(socket) {
  const createBtn = document.getElementById('create-btn');
  const joinBtn = document.getElementById('join-btn');
  const roomInput = document.getElementById('room-input');
  const lobbyStatus = document.getElementById('lobby-status');

  createBtn.addEventListener('click', () => {
    socket.emit('create-room', (res) => {
      if (res.success) {
        lobbyStatus.innerHTML = `Room created! Code: <strong>${res.roomCode}</strong><br>Share this code with your opponent.`;
        createBtn.style.display = 'none';
        joinBtn.style.display = 'none';
        roomInput.style.display = 'none';

        // Store for reconnection
        sessionStorage.setItem('hexchess-room', res.roomCode);
        sessionStorage.setItem('hexchess-role', res.role);
      }
    });
  });

  joinBtn.addEventListener('click', () => {
    const code = roomInput.value.trim().toUpperCase();
    if (!code) {
      lobbyStatus.textContent = 'Enter a room code.';
      return;
    }

    socket.emit('join-room', { roomCode: code }, (res) => {
      if (res.success) {
        lobbyStatus.textContent = 'Joined! Starting game...';

        // Store for reconnection
        sessionStorage.setItem('hexchess-room', res.roomCode);
        sessionStorage.setItem('hexchess-role', res.role);

        showGame();
      } else {
        lobbyStatus.textContent = 'Error: ' + res.reason;
      }
    });
  });

  // Allow Enter key to join
  roomInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') joinBtn.click();
  });
}

function showLobby() {
  document.getElementById('lobby-screen').style.display = 'flex';
  document.getElementById('game-screen').style.display = 'none';
}

function showGame() {
  document.getElementById('lobby-screen').style.display = 'none';
  document.getElementById('game-screen').style.display = 'flex';
}
