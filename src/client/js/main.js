/**
 * Main entry point - connects everything.
 */

let booted = false;

function boot() {
  if (booted) return;
  booted = true;

  const socket = io();

  // Initialize modules
  initLobby(socket);
  initRenderer();
  initGameClient(socket);

  // When game starts (state-update received), switch to game view
  socket.on('state-update', () => {
    if (document.getElementById('lobby-screen').style.display !== 'none') {
      showGame();
    }
  });

  // Setup canvas click handler
  const canvasEl = document.getElementById('game-canvas');
  canvasEl.addEventListener('click', handleCanvasClick);

  // Try to reconnect if we have session data
  const savedRoom = sessionStorage.getItem('hexchess-room');
  const savedRole = sessionStorage.getItem('hexchess-role');
  if (savedRoom && savedRole) {
    socket.emit('rejoin-room', { roomCode: savedRoom, role: savedRole }, (res) => {
      if (res.success) {
        showGame();
      } else {
        sessionStorage.removeItem('hexchess-room');
        sessionStorage.removeItem('hexchess-role');
      }
    });
  }
}

// Ensure boot runs regardless of when scripts load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
window.addEventListener('load', boot);
