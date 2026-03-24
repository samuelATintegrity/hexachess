const { generateBoard, boardToObject, getNeighbors } = require('./HexGrid');
const { CITIES_PER_PLAYER, UNITS_PER_PLAYER, MOVES_PER_TURN, UNIT_TYPES } = require('./constants');
const { validateCityPlacement, validateCapitalSelection, validateUnitPlacement } = require('./SetupValidator');
const { getValidMoves, executeMove, getChainCaptureMoves, getStepsToTarget } = require('./MoveValidator');

let pieceIdCounter = 0;

function createGameState(roomCode) {
  return {
    roomCode,
    phase: 'waiting',
    board: null,
    players: {
      player1: {
        socketId: null,
        citiesPlaced: 0,
        capitalChosen: false,
        unitsPlaced: { grunt: 0, cavalry: 0, vehicle: 0 },
        ready: false,
      },
      player2: {
        socketId: null,
        citiesPlaced: 0,
        capitalChosen: false,
        unitsPlaced: { grunt: 0, cavalry: 0, vehicle: 0 },
        ready: false,
      },
    },
    currentTurn: 'player1',
    movesRemaining: MOVES_PER_TURN,
    movedPieceIds: new Set(),
    winner: null,
    capitals: { player1: null, player2: null },
    // Chain capture state
    chainCapture: null, // { pieceId, q, r, remainingSteps, piece }
  };
}

/**
 * Serialize the board for a specific player.
 * During setup phases, hide opponent's placements.
 * During playing/gameOver, show everything except opponent's capital.
 */
function serializeBoardForPlayer(gameState, playerRole) {
  const phase = gameState.phase;
  const isSetup = phase === 'cityPlacement' || phase === 'capitalSelection' || phase === 'unitPlacement';
  const obj = {};
  for (const [key, tile] of gameState.board) {
    const t = { ...tile };
    if (t.city) {
      if (isSetup && t.city.owner !== playerRole) {
        // Hide opponent's cities during setup
        t.city = null;
      } else {
        t.city = { ...t.city };
        if (t.city.owner !== playerRole) {
          t.city.isCapital = false;
        }
      }
    }
    if (t.occupant) {
      if (isSetup && t.occupant.owner !== playerRole) {
        // Hide opponent's units during setup
        t.occupant = null;
      } else {
        t.occupant = { ...t.occupant };
      }
    }
    obj[key] = t;
  }
  return obj;
}

/**
 * Count remaining pieces for a player.
 */
function countPlayerPieces(board, playerRole) {
  let count = 0;
  for (const [, tile] of board) {
    if (tile.occupant && tile.occupant.owner === playerRole) count++;
  }
  return count;
}

/**
 * Get the state to send to a player.
 */
function getPlayerState(gameState, playerRole) {
  const state = {
    phase: gameState.phase,
    board: serializeBoardForPlayer(gameState, playerRole),
    currentTurn: gameState.currentTurn,
    movesRemaining: gameState.movesRemaining,
    movedPieceIds: Array.from(gameState.movedPieceIds),
    myRole: playerRole,
    isMyTurn: gameState.currentTurn === playerRole,
    winner: gameState.winner,
    setupInfo: {
      citiesPlaced: gameState.players[playerRole].citiesPlaced,
      capitalChosen: gameState.players[playerRole].capitalChosen,
      unitsPlaced: { ...gameState.players[playerRole].unitsPlaced },
      opponentReady: gameState.players[playerRole === 'player1' ? 'player2' : 'player1'].ready,
    },
    chainCapture: null,
  };

  if (gameState.chainCapture && gameState.currentTurn === playerRole) {
    state.chainCapture = {
      pieceId: gameState.chainCapture.pieceId,
      q: gameState.chainCapture.q,
      r: gameState.chainCapture.r,
      validMoves: gameState.chainCapture.validMoves,
      remainingSteps: gameState.chainCapture.remainingSteps,
    };
  }

  return state;
}

/**
 * Start the game: generate board, move to cityPlacement.
 */
function startGame(gameState) {
  gameState.board = generateBoard();
  gameState.phase = 'cityPlacement';
}

/**
 * Handle city placement action.
 */
function placeCity(gameState, playerRole, q, r) {
  if (gameState.phase !== 'cityPlacement') {
    return { success: false, reason: 'Not in city placement phase' };
  }

  const player = gameState.players[playerRole];
  if (player.citiesPlaced >= CITIES_PER_PLAYER) {
    return { success: false, reason: 'Already placed all cities' };
  }

  const validation = validateCityPlacement(gameState.board, q, r, playerRole);
  if (!validation.valid) return { success: false, reason: validation.reason };

  // Place city
  const tile = gameState.board.get(`${q},${r}`);
  tile.city = { owner: playerRole, isCapital: false };
  player.citiesPlaced++;

  // Check if both players have placed all cities
  if (gameState.players.player1.citiesPlaced >= CITIES_PER_PLAYER &&
      gameState.players.player2.citiesPlaced >= CITIES_PER_PLAYER) {
    gameState.phase = 'capitalSelection';
  }

  return { success: true };
}

/**
 * Handle capital selection action.
 */
function selectCapital(gameState, playerRole, q, r) {
  if (gameState.phase !== 'capitalSelection') {
    return { success: false, reason: 'Not in capital selection phase' };
  }

  const player = gameState.players[playerRole];
  if (player.capitalChosen) {
    return { success: false, reason: 'Already chose capital' };
  }

  const validation = validateCapitalSelection(gameState.board, q, r, playerRole);
  if (!validation.valid) return { success: false, reason: validation.reason };

  // Set capital
  const tile = gameState.board.get(`${q},${r}`);
  tile.city.isCapital = true;
  gameState.capitals[playerRole] = `${q},${r}`;
  player.capitalChosen = true;

  // Check if both players have chosen
  if (gameState.players.player1.capitalChosen && gameState.players.player2.capitalChosen) {
    gameState.phase = 'unitPlacement';
  }

  return { success: true };
}

/**
 * Handle unit placement action.
 */
function placeUnit(gameState, playerRole, q, r, unitType, specialization) {
  if (gameState.phase !== 'unitPlacement') {
    return { success: false, reason: 'Not in unit placement phase' };
  }

  const player = gameState.players[playerRole];
  const maxCount = UNITS_PER_PLAYER[unitType];
  if (maxCount === undefined) {
    return { success: false, reason: 'Invalid unit type' };
  }
  if (player.unitsPlaced[unitType] >= maxCount) {
    return { success: false, reason: `Already placed all ${unitType}s` };
  }

  const validation = validateUnitPlacement(gameState.board, q, r, playerRole, unitType, specialization);
  if (!validation.valid) return { success: false, reason: validation.reason };

  // Place unit
  const tile = gameState.board.get(`${q},${r}`);
  pieceIdCounter++;
  tile.occupant = {
    id: `${playerRole}_${unitType}_${pieceIdCounter}`,
    owner: playerRole,
    type: unitType,
    specialization: unitType === 'grunt' ? null : specialization,
  };
  player.unitsPlaced[unitType]++;

  // Check if both players have placed all units
  const p1Done = Object.entries(UNITS_PER_PLAYER).every(
    ([type, count]) => gameState.players.player1.unitsPlaced[type] >= count
  );
  const p2Done = Object.entries(UNITS_PER_PLAYER).every(
    ([type, count]) => gameState.players.player2.unitsPlaced[type] >= count
  );

  if (p1Done && p2Done) {
    gameState.phase = 'playing';
    gameState.currentTurn = 'player1';
    gameState.movesRemaining = MOVES_PER_TURN;
  }

  return { success: true };
}

/**
 * Handle piece movement action.
 */
function movePiece(gameState, playerRole, fromQ, fromR, toQ, toR) {
  if (gameState.phase !== 'playing') {
    return { success: false, reason: 'Not in playing phase' };
  }
  if (gameState.currentTurn !== playerRole) {
    return { success: false, reason: 'Not your turn' };
  }
  if (gameState.movesRemaining <= 0) {
    return { success: false, reason: 'No moves remaining' };
  }
  if (gameState.chainCapture) {
    return { success: false, reason: 'Must resolve chain capture first' };
  }

  const fromTile = gameState.board.get(`${fromQ},${fromR}`);
  if (!fromTile || !fromTile.occupant) {
    return { success: false, reason: 'No piece at source' };
  }

  const piece = fromTile.occupant;
  if (piece.owner !== playerRole) {
    return { success: false, reason: 'Not your piece' };
  }
  if (gameState.movedPieceIds.has(piece.id)) {
    return { success: false, reason: 'This piece already moved this turn' };
  }

  // Validate the move
  const validMoves = getValidMoves(gameState.board, piece, fromQ, fromR);
  const targetMove = validMoves.find(m => m.q === toQ && m.r === toR);
  if (!targetMove) {
    return { success: false, reason: 'Invalid move' };
  }

  // Execute the move
  const moveResult = executeMove(gameState.board, piece, fromQ, fromR, toQ, toR);
  if (!moveResult.valid) {
    return { success: false, reason: moveResult.reason };
  }

  // Apply the move to the board
  const result = {
    success: true,
    captured: moveResult.captured,
    capturedCity: moveResult.capturedCity,
    capitalCaptured: moveResult.capitalCaptured,
    upgrade: moveResult.upgrade,
    spawnGrunt: moveResult.spawnGrunt,
    chainCapture: moveResult.chainCapture,
    fromQ, fromR, toQ, toR,
    needsSpecialization: false,
    needsSpawnLocation: false,
  };

  // Move piece
  const toTile = gameState.board.get(`${toQ},${toR}`);
  fromTile.occupant = null;

  // Handle capture
  if (moveResult.capturedCity) {
    toTile.city = null; // Remove captured city
    toTile.occupant = piece;

    if (moveResult.capitalCaptured) {
      gameState.winner = playerRole;
      gameState.phase = 'gameOver';
      return result;
    }

    // Handle upgrade
    if (moveResult.upgrade === 'cavalry') {
      result.needsSpecialization = true;
      // Temporarily set as cavalry, specialization will be set by follow-up
      piece.type = 'cavalry';
      piece.specialization = null;
      toTile.occupant = piece;
    } else if (moveResult.upgrade === 'vehicle') {
      piece.type = 'vehicle';
      // Keeps specialization
      toTile.occupant = piece;
    } else if (moveResult.spawnGrunt) {
      toTile.occupant = piece;
      result.needsSpawnLocation = true;
    }
  } else if (moveResult.captured) {
    toTile.occupant = piece;
  } else {
    toTile.occupant = piece;
  }

  // Track moved piece
  gameState.movedPieceIds.add(piece.id);
  gameState.movesRemaining--;

  // Handle chain capture
  if (moveResult.chainCapture) {
    gameState.chainCapture = {
      pieceId: piece.id,
      q: toQ,
      r: toR,
      remainingSteps: moveResult.remainingSteps,
      piece: piece,
      validMoves: moveResult.chainCaptureMoves,
    };
    return result;
  }

  // Don't end turn while waiting for specialization/spawn — the follow-up
  // handlers (chooseSpecialization, spawnGrunt) will call checkTurnEnd
  if (!result.needsSpecialization && !result.needsSpawnLocation) {
    checkTurnEnd(gameState);
  }

  return result;
}

/**
 * Handle chain capture continuation.
 */
function chainCaptureAction(gameState, playerRole, toQ, toR, pass) {
  if (!gameState.chainCapture) {
    return { success: false, reason: 'No chain capture active' };
  }
  if (gameState.currentTurn !== playerRole) {
    return { success: false, reason: 'Not your turn' };
  }

  if (pass) {
    gameState.chainCapture = null;
    checkTurnEnd(gameState);
    return { success: true, passed: true };
  }

  const { piece, q: fromQ, r: fromR, validMoves, remainingSteps } = gameState.chainCapture;

  const targetMove = validMoves.find(m => m.q === toQ && m.r === toR);
  if (!targetMove) {
    return { success: false, reason: 'Invalid chain capture move' };
  }

  const toTile = gameState.board.get(`${toQ},${toR}`);
  const fromTile = gameState.board.get(`${fromQ},${fromR}`);

  const result = {
    success: true,
    fromQ, fromR, toQ, toR,
    captured: null,
    capturedCity: null,
    capitalCaptured: false,
    chainCapture: false,
    upgrade: null,
    spawnGrunt: false,
    needsSpecialization: false,
    needsSpawnLocation: false,
  };

  // Move piece
  fromTile.occupant = null;

  // Compute steps used for this chain move
  const stepsUsed = getStepsToTarget(gameState.board, piece, fromQ, fromR, toQ, toR);

  if (toTile.city && toTile.city.owner !== piece.owner) {
    result.capturedCity = { ...toTile.city };
    if (toTile.city.isCapital) {
      result.capitalCaptured = true;
      gameState.winner = playerRole;
      gameState.phase = 'gameOver';
      toTile.city = null;
      toTile.occupant = piece;
      gameState.chainCapture = null;
      return result;
    }
    toTile.city = null;
    toTile.occupant = piece;

    // Upgrade logic
    if (piece.type === 'grunt') {
      piece.type = 'cavalry';
      piece.specialization = null;
      result.upgrade = 'cavalry';
      result.needsSpecialization = true;
    } else if (piece.type === 'cavalry') {
      piece.type = 'vehicle';
      result.upgrade = 'vehicle';
    } else if (piece.type === 'vehicle') {
      result.spawnGrunt = true;
      result.needsSpawnLocation = true;
    }

    gameState.chainCapture = null;
    checkTurnEnd(gameState);
    return result;
  }

  if (toTile.occupant && toTile.occupant.owner !== piece.owner) {
    result.captured = { ...toTile.occupant };
    toTile.occupant = piece;

    // Check for another chain capture
    if (piece.specialization && toTile.terrain === piece.specialization) {
      const newRemaining = remainingSteps - stepsUsed;
      if (newRemaining > 0) {
        const chainMoves = getChainCaptureMoves(gameState.board, piece, toQ, toR, newRemaining);
        if (chainMoves.length > 0) {
          gameState.chainCapture = {
            pieceId: piece.id,
            q: toQ,
            r: toR,
            remainingSteps: newRemaining,
            piece: piece,
            validMoves: chainMoves,
          };
          result.chainCapture = true;
          return result;
        }
      }
    }
  } else {
    toTile.occupant = piece;
  }

  gameState.chainCapture = null;
  checkTurnEnd(gameState);
  return result;
}

/**
 * Handle specialization choice after city capture upgrade (grunt -> cavalry).
 */
function chooseSpecialization(gameState, playerRole, specialization) {
  if (gameState.currentTurn !== playerRole) {
    return { success: false, reason: 'Not your turn' };
  }

  const validSpecs = ['plain', 'forest', 'mountain'];
  if (!validSpecs.includes(specialization)) {
    return { success: false, reason: 'Invalid specialization' };
  }

  // Find the piece that was just upgraded (it will be cavalry with null specialization)
  for (const [, tile] of gameState.board) {
    if (tile.occupant && tile.occupant.owner === playerRole &&
        tile.occupant.type === 'cavalry' && tile.occupant.specialization === null) {
      tile.occupant.specialization = specialization;
      checkTurnEnd(gameState);
      return { success: true };
    }
  }

  return { success: false, reason: 'No piece awaiting specialization' };
}

/**
 * Handle spawn grunt after vehicle captures non-capital city.
 */
function spawnGrunt(gameState, playerRole, cityQ, cityR, spawnQ, spawnR) {
  if (gameState.currentTurn !== playerRole) {
    return { success: false, reason: 'Not your turn' };
  }

  // Validate that cityQ, cityR has a city owned by the player
  const cityTile = gameState.board.get(`${cityQ},${cityR}`);
  if (!cityTile || !cityTile.city || cityTile.city.owner !== playerRole) {
    return { success: false, reason: 'Invalid city' };
  }

  // Validate spawnQ, spawnR is adjacent to the city and empty
  const neighbors = getNeighbors(cityQ, cityR);
  const isAdjacent = neighbors.some(n => n.q === spawnQ && n.r === spawnR);
  if (!isAdjacent) {
    return { success: false, reason: 'Spawn location must be adjacent to chosen city' };
  }

  const spawnTile = gameState.board.get(`${spawnQ},${spawnR}`);
  if (!spawnTile || spawnTile.occupant || spawnTile.city) {
    return { success: false, reason: 'Spawn location is not empty' };
  }

  // Spawn the grunt
  pieceIdCounter++;
  spawnTile.occupant = {
    id: `${playerRole}_grunt_${pieceIdCounter}`,
    owner: playerRole,
    type: 'grunt',
    specialization: null,
  };

  // The spawned unit CAN act this turn if moves remain
  // (don't add it to movedPieceIds)

  checkTurnEnd(gameState);
  return { success: true, spawnedPieceId: spawnTile.occupant.id };
}

/**
 * Check if the turn should end and switch to the other player.
 */
function checkTurnEnd(gameState) {
  if (gameState.movesRemaining <= 0) {
    switchTurn(gameState);
    return;
  }

  // Check if current player has any unmoved pieces
  const currentPlayer = gameState.currentTurn;
  let hasUnmovedPieces = false;
  for (const [, tile] of gameState.board) {
    if (tile.occupant && tile.occupant.owner === currentPlayer &&
        !gameState.movedPieceIds.has(tile.occupant.id)) {
      hasUnmovedPieces = true;
      break;
    }
  }

  if (!hasUnmovedPieces) {
    switchTurn(gameState);
  }
}

/**
 * Switch turn to the other player.
 */
function switchTurn(gameState) {
  gameState.currentTurn = gameState.currentTurn === 'player1' ? 'player2' : 'player1';
  gameState.movesRemaining = Math.min(MOVES_PER_TURN, countPlayerPieces(gameState.board, gameState.currentTurn));
  gameState.movedPieceIds = new Set();
  gameState.chainCapture = null;
}

module.exports = {
  createGameState,
  getPlayerState,
  startGame,
  placeCity,
  selectCapital,
  placeUnit,
  movePiece,
  chainCaptureAction,
  chooseSpecialization,
  spawnGrunt,
  serializeBoardForPlayer,
};
