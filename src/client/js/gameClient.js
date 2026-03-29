/**
 * Game client - manages game state and server communication.
 */

let socket = null;
let myRole = null;
let localState = null;

// Setup phase state
let selectedUnitType = null;
let selectedSpecialization = null;
let awaitingSpecialization = false;
let awaitingSpawnLocation = false;

function initGameClient(sock) {
  socket = sock;

  socket.on('state-update', (state) => {
    localState = state;
    myRole = state.myRole;
    setGameState(state);
    updateUI(state);
    // Don't clear selection during chain capture - updateUI just set it
    if (!state.chainCapture) {
      clearSelection();
    }
  });

  socket.on('opponent-disconnected', () => {
    showStatus('Opponent disconnected. Waiting for reconnection...');
  });

  socket.on('opponent-reconnected', () => {
    showStatus('Opponent reconnected!');
    setTimeout(() => updateUI(localState), 2000);
  });
}

function updateUI(state) {
  const statusEl = document.getElementById('status-text');
  const phaseEl = document.getElementById('phase-info');
  const setupPanel = document.getElementById('setup-panel');
  const turnInfo = document.getElementById('turn-info');
  const specPanel = document.getElementById('specialization-panel');
  const spawnPanel = document.getElementById('spawn-panel');

  // Hide all panels first, but preserve specialization/spawn panels if active
  setupPanel.style.display = 'none';
  turnInfo.style.display = 'none';
  if (!awaitingSpecialization) specPanel.style.display = 'none';
  if (!awaitingSpawnLocation) spawnPanel.style.display = 'none';

  switch (state.phase) {
    case 'cityPlacement': {
      phaseEl.textContent = 'Phase: City Placement';
      const remaining = CITIES_PER_PLAYER - state.setupInfo.citiesPlaced;
      const isMySetupTurn = state.setupTurn === state.myRole;
      if (remaining > 0 && isMySetupTurn) {
        statusEl.textContent = `Your turn! Place ${remaining} more ${remaining === 1 ? 'city' : 'cities'} on your half.`;
        setSelection(null, getValidCityTiles(state));
      } else if (remaining > 0) {
        statusEl.textContent = 'Waiting for opponent to place a city...';
        clearSelection();
      } else {
        statusEl.textContent = 'Waiting for opponent to finish placing cities...';
        clearSelection();
      }
      break;
    }
    case 'capitalSelection': {
      phaseEl.textContent = 'Phase: Capital Selection';
      if (!state.setupInfo.capitalChosen) {
        statusEl.textContent = 'Click one of your cities to select it as your capital (secret).';
      } else {
        statusEl.textContent = 'Waiting for opponent to select capital...';
      }
      break;
    }
    case 'unitPlacement': {
      phaseEl.textContent = 'Phase: Unit Placement';
      const placed = state.setupInfo.unitsPlaced;
      const remaining = {};
      let totalRemaining = 0;
      for (const [type, max] of Object.entries(UNITS_PER_PLAYER)) {
        remaining[type] = max - (placed[type] || 0);
        totalRemaining += remaining[type];
      }

      const isMySetupTurn = state.setupTurn === state.myRole;
      if (totalRemaining > 0 && isMySetupTurn) {
        setupPanel.style.display = 'block';
        updateUnitButtons(remaining);
        statusEl.textContent = 'Your turn! Select a unit type, then click a valid tile.';
        setSelection(null, getValidUnitTiles(state));
      } else if (totalRemaining > 0) {
        setupPanel.style.display = 'none';
        statusEl.textContent = 'Waiting for opponent to place a unit...';
        clearSelection();
      } else {
        setupPanel.style.display = 'none';
        statusEl.textContent = 'Waiting for opponent to finish placing units...';
      }
      break;
    }
    case 'playing': {
      phaseEl.textContent = 'Phase: Playing';
      turnInfo.style.display = 'block';
      document.getElementById('moves-remaining').textContent = state.movesRemaining;
      document.getElementById('current-turn').textContent =
        state.isMyTurn ? 'Your turn' : "Opponent's turn";
      document.getElementById('current-turn').style.color =
        state.isMyTurn ? '#27AE60' : '#E74C3C';

      if (state.chainCapture) {
        statusEl.textContent = 'Chain capture! Click a highlighted tile to continue, or click "Pass" to stop.';
        // Show valid chain capture moves
        setSelection(
          { q: state.chainCapture.q, r: state.chainCapture.r },
          state.chainCapture.validMoves
        );
        // Show pass button in the turn info area
        showChainPassButton(true);
      } else if (state.isMyTurn) {
        statusEl.textContent = `Your turn. ${state.movesRemaining} ${state.movesRemaining === 1 ? 'move' : 'moves'} remaining. Click a piece to move.`;
        showChainPassButton(false);
      } else {
        statusEl.textContent = "Opponent's turn.";
        showChainPassButton(false);
      }
      break;
    }
    case 'gameOver': {
      phaseEl.textContent = 'Game Over';
      if (state.winner === myRole) {
        statusEl.textContent = 'You captured the enemy capital! You win!';
        statusEl.style.color = '#27AE60';
      } else {
        statusEl.textContent = 'Your capital was captured. You lose!';
        statusEl.style.color = '#E74C3C';
      }
      break;
    }
  }
}

function showChainPassButton(show) {
  let btn = document.getElementById('chain-pass-btn');
  if (show) {
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'chain-pass-btn';
      btn.textContent = 'Pass (Stop Chain)';
      btn.className = 'btn btn-secondary';
      btn.addEventListener('click', () => {
        socket.emit('chain-capture', { pass: true }, (res) => {
          if (!res.success) showStatus('Error: ' + res.reason);
        });
      });
      document.getElementById('turn-info').appendChild(btn);
    }
    btn.style.display = 'inline-block';
  } else if (btn) {
    btn.style.display = 'none';
  }
}

function updateUnitButtons(remaining) {
  const container = document.getElementById('unit-buttons');
  container.innerHTML = '';

  for (const [type, count] of Object.entries(remaining)) {
    if (count <= 0) continue;
    const btn = document.createElement('button');
    btn.className = 'btn unit-btn' + (selectedUnitType === type ? ' selected' : '');
    btn.textContent = `${UNIT_TYPES[type].label} (${count})`;
    btn.addEventListener('click', () => {
      selectedUnitType = type;
      if (type === 'cavalry' || type === 'vehicle') {
        showSpecializationChooser(type);
      } else {
        selectedSpecialization = null;
        hideSpecializationChooser();
      }
      updateUnitButtons(remaining);
    });
    container.appendChild(btn);
  }
}

function showSpecializationChooser(unitType) {
  const panel = document.getElementById('specialization-panel');
  panel.style.display = 'block';
  panel.innerHTML = '<span>Specialization: </span>';

  for (const spec of ['plain', 'forest', 'mountain']) {
    const btn = document.createElement('button');
    btn.className = 'btn spec-btn' + (selectedSpecialization === spec ? ' selected' : '');
    btn.textContent = spec.charAt(0).toUpperCase() + spec.slice(1);
    btn.style.borderBottom = `3px solid ${TERRAIN_OUTLINE_COLORS[spec]}`;
    btn.addEventListener('click', () => {
      selectedSpecialization = spec;
      showSpecializationChooser(unitType); // refresh selection state
    });
    panel.appendChild(btn);
  }
}

function hideSpecializationChooser() {
  document.getElementById('specialization-panel').style.display = 'none';
}

function showUpgradeSpecializationChooser() {
  awaitingSpecialization = true;
  const panel = document.getElementById('specialization-panel');
  panel.style.display = 'block';
  panel.innerHTML = '<span>Choose specialization for new Cavalry: </span>';

  for (const spec of ['plain', 'forest', 'mountain']) {
    const btn = document.createElement('button');
    btn.className = 'btn spec-btn';
    btn.textContent = spec.charAt(0).toUpperCase() + spec.slice(1);
    btn.style.borderBottom = `3px solid ${TERRAIN_OUTLINE_COLORS[spec]}`;
    btn.addEventListener('click', () => {
      socket.emit('choose-specialization', { specialization: spec }, (res) => {
        if (res.success) {
          awaitingSpecialization = false;
          panel.style.display = 'none';
        } else {
          showStatus('Error: ' + res.reason);
        }
      });
    });
    panel.appendChild(btn);
  }
}

function handleCanvasClick(e) {
  if (!localState) return;

  const { px, py } = getCanvasClickCoords(e);
  const hex = pixelToHex(px, py);
  if (!hex) return;

  const key = `${hex.q},${hex.r}`;
  const tile = localState.board[key];
  if (!tile) return;

  switch (localState.phase) {
    case 'cityPlacement':
      handleCityPlacement(hex);
      break;
    case 'capitalSelection':
      handleCapitalSelection(hex);
      break;
    case 'unitPlacement':
      handleUnitPlacement(hex);
      break;
    case 'playing':
      handlePlayingClick(hex, tile);
      break;
  }
}

function handleCityPlacement(hex) {
  if (localState.setupTurn !== myRole) return;
  if (localState.setupInfo.citiesPlaced >= CITIES_PER_PLAYER) return;

  socket.emit('place-city', { q: hex.q, r: hex.r }, (res) => {
    if (!res.success) showStatus('Error: ' + res.reason);
  });
}

function handleCapitalSelection(hex) {
  if (localState.setupInfo.capitalChosen) return;

  socket.emit('select-capital', { q: hex.q, r: hex.r }, (res) => {
    if (!res.success) showStatus('Error: ' + res.reason);
  });
}

function handleUnitPlacement(hex) {
  if (localState.setupTurn !== myRole) return;
  if (!selectedUnitType) {
    showStatus('Select a unit type first.');
    return;
  }
  if ((selectedUnitType === 'cavalry' || selectedUnitType === 'vehicle') && !selectedSpecialization) {
    showStatus('Select a specialization first.');
    return;
  }

  socket.emit('place-unit', {
    q: hex.q,
    r: hex.r,
    unitType: selectedUnitType,
    specialization: selectedUnitType === 'grunt' ? null : selectedSpecialization,
  }, (res) => {
    if (!res.success) {
      showStatus('Error: ' + res.reason);
    } else {
      // Reset specialization so player must choose again for next unit
      selectedSpecialization = null;
    }
  });
}

function handlePlayingClick(hex, tile) {
  if (!localState.isMyTurn) return;

  // If in chain capture mode
  if (localState.chainCapture) {
    const validMove = validMoves.find(m => m.q === hex.q && m.r === hex.r);
    if (validMove) {
      socket.emit('chain-capture', { toQ: hex.q, toR: hex.r, pass: false }, (res) => {
        if (!res.success) showStatus('Error: ' + res.reason);
        if (res.success && res.needsSpecialization) {
          showUpgradeSpecializationChooser();
        }
      });
    }
    return;
  }

  // If awating specialization or spawn, don't process clicks on board
  if (awaitingSpecialization || awaitingSpawnLocation) return;

  // If we have a selection, try to move there
  if (selectedTile) {
    const validMove = validMoves.find(m => m.q === hex.q && m.r === hex.r);
    if (validMove) {
      socket.emit('move-piece', {
        fromQ: selectedTile.q,
        fromR: selectedTile.r,
        toQ: hex.q,
        toR: hex.r,
      }, (res) => {
        if (!res.success) {
          showStatus('Error: ' + res.reason);
        }
        if (res.success && res.needsSpecialization) {
          showUpgradeSpecializationChooser();
        }
        if (res.success && res.needsSpawnLocation) {
          handleSpawnGrunt();
        }
        clearSelection();
      });
      return;
    }

    // Clicking on a different own piece - reselect
    if (tile.occupant && tile.occupant.owner === myRole) {
      selectPiece(hex, tile);
      return;
    }

    clearSelection();
    return;
  }

  // Select a piece
  if (tile.occupant && tile.occupant.owner === myRole) {
    if (localState.movedPieceIds.includes(tile.occupant.id)) {
      showStatus('This piece already moved this turn.');
      return;
    }
    selectPiece(hex, tile);
  }
}

function selectPiece(hex, tile) {
  // Compute valid moves client-side for instant feedback
  const moves = computeValidMoves(localState.board, tile.occupant, hex.q, hex.r);
  setSelection(hex, moves);
}

/**
 * Client-side move computation for highlighting.
 * Must match server logic.
 */
function computeValidMoves(board, piece, fromQ, fromR) {
  const maxSteps = UNIT_TYPES[piece.type].steps;
  const visited = new Set();
  const result = [];

  const queue = [{ q: fromQ, r: fromR, steps: 0 }];
  visited.add(`${fromQ},${fromR}`);

  while (queue.length > 0) {
    const { q, r, steps } = queue.shift();

    if (steps > 0) {
      const key = `${q},${r}`;
      const t = board[key];

      if (t.city) {
        if (t.city.owner !== piece.owner) {
          result.push({ q, r, isCapture: true });
        }
        continue;
      }

      if (t.occupant) {
        if (t.occupant.owner !== piece.owner) {
          result.push({ q, r, isCapture: true });
        }
        continue;
      }

      result.push({ q, r, isCapture: false });
    }

    if (steps < maxSteps) {
      const neighbors = getClientNeighbors(q, r);
      for (const n of neighbors) {
        const key = `${n.q},${n.r}`;
        if (!visited.has(key) && board[key]) {
          visited.add(key);
          queue.push({ q: n.q, r: n.r, steps: steps + 1 });
        }
      }
    }
  }

  return result;
}

/**
 * Client-side neighbor computation.
 */
function getClientNeighbors(q, r) {
  const neighbors = [];
  const currentWidth = ROW_WIDTHS[r];

  if (q > 0) neighbors.push({ q: q - 1, r });
  if (q < currentWidth - 1) neighbors.push({ q: q + 1, r });

  const isEvenRow = r % 2 === 0;

  for (const dr of [-1, 1]) {
    const nr = r + dr;
    if (nr < 0 || nr >= ROW_WIDTHS.length) continue;
    const neighborWidth = ROW_WIDTHS[nr];
    const neighborIsEven = nr % 2 === 0;

    if (isEvenRow && !neighborIsEven) {
      const nq1 = q - 1;
      const nq2 = q;
      if (nq1 >= 0 && nq1 < neighborWidth) neighbors.push({ q: nq1, r: nr });
      if (nq2 >= 0 && nq2 < neighborWidth) neighbors.push({ q: nq2, r: nr });
    } else if (!isEvenRow && neighborIsEven) {
      const nq1 = q;
      const nq2 = q + 1;
      if (nq1 >= 0 && nq1 < neighborWidth) neighbors.push({ q: nq1, r: nr });
      if (nq2 >= 0 && nq2 < neighborWidth) neighbors.push({ q: nq2, r: nr });
    }
  }

  return neighbors;
}

function handleSpawnGrunt() {
  awaitingSpawnLocation = true;
  showStatus('Vehicle captured a city! Click one of your cities to choose spawn location.');

  // Find player's cities
  const cities = [];
  for (const key in localState.board) {
    const tile = localState.board[key];
    if (tile.city && tile.city.owner === myRole) {
      cities.push({ q: tile.q, r: tile.r });
    }
  }

  if (cities.length === 0) {
    awaitingSpawnLocation = false;
    showStatus('No cities available for spawning.');
    return;
  }

  // Highlight cities
  setSelection(null, cities.map(c => ({ ...c, isCapture: false })));

  // Override click handler temporarily
  const origHandler = canvas.onclick;
  canvas.onclick = (e) => {
    const { px, py } = getCanvasClickCoords(e);
    const hex = pixelToHex(px, py);
    if (!hex) return;

    const city = cities.find(c => c.q === hex.q && c.r === hex.r);
    if (city) {
      // Now find adjacent empty tiles to that city
      const adjacentTiles = getClientNeighbors(city.q, city.r)
        .filter(n => {
          const t = localState.board[`${n.q},${n.r}`];
          return t && !t.occupant && !t.city;
        });

      if (adjacentTiles.length === 0) {
        showStatus('No empty tiles adjacent to this city. Choose another.');
        return;
      }

      setSelection({ q: city.q, r: city.r }, adjacentTiles.map(t => ({ ...t, isCapture: false })));

      // Now wait for spawn tile selection
      canvas.onclick = (e2) => {
        const { px: px2, py: py2 } = getCanvasClickCoords(e2);
        const hex2 = pixelToHex(px2, py2);
        if (!hex2) return;

        const spawnTile = adjacentTiles.find(t => t.q === hex2.q && t.r === hex2.r);
        if (spawnTile) {
          socket.emit('spawn-grunt', {
            cityQ: city.q, cityR: city.r,
            spawnQ: spawnTile.q, spawnR: spawnTile.r,
          }, (res) => {
            if (!res.success) showStatus('Error: ' + res.reason);
            awaitingSpawnLocation = false;
            canvas.onclick = origHandler;
            clearSelection();
          });
        }
      };
    }
  };
}

function getValidCityTiles(state) {
  const tiles = [];
  for (const key in state.board) {
    const tile = state.board[key];
    if (tile.occupant || tile.city) continue;
    if (getOwnerHalf(tile.q, tile.r) !== state.myRole) continue;
    tiles.push({ q: tile.q, r: tile.r, isCapture: false });
  }
  return tiles;
}

function getValidUnitTiles(state) {
  const tiles = [];
  for (const key in state.board) {
    const tile = state.board[key];
    if (tile.occupant || tile.city) continue;
    if (getOwnerHalf(tile.q, tile.r) !== state.myRole) continue;

    const neighbors = getClientNeighbors(tile.q, tile.r);
    const adjacentToOwn = neighbors.some(n => {
      const nTile = state.board[`${n.q},${n.r}`];
      if (!nTile) return false;
      if (nTile.city && nTile.city.owner === state.myRole) return true;
      if (nTile.occupant && nTile.occupant.owner === state.myRole) return true;
      return false;
    });

    if (adjacentToOwn) {
      tiles.push({ q: tile.q, r: tile.r, isCapture: false });
    }
  }
  return tiles;
}

function showStatus(msg) {
  const el = document.getElementById('status-text');
  if (el) el.textContent = msg;
}
