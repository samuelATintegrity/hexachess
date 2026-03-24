const { getNeighbors } = require('./HexGrid');
const { UNIT_TYPES } = require('./constants');

/**
 * Get valid moves for a piece using BFS.
 * Returns array of { q, r, isCapture, isCityCapture }
 */
function getValidMoves(board, piece, fromQ, fromR) {
  const maxSteps = UNIT_TYPES[piece.type].steps;
  const visited = new Set();
  const result = [];

  // BFS: queue items are { q, r, steps }
  const queue = [{ q: fromQ, r: fromR, steps: 0 }];
  visited.add(`${fromQ},${fromR}`);

  while (queue.length > 0) {
    const { q, r, steps } = queue.shift();

    if (steps > 0) {
      const tile = board.get(`${q},${r}`);

      // Check for city on this tile
      if (tile.city) {
        if (tile.city.owner !== piece.owner) {
          result.push({ q, r, isCapture: true, isCityCapture: true });
        }
        // Can't move through cities (own or enemy)
        continue;
      }

      // Check for occupant
      if (tile.occupant) {
        if (tile.occupant.owner !== piece.owner) {
          result.push({ q, r, isCapture: true, isCityCapture: false });
        }
        // Can't move through occupied tiles
        continue;
      }

      result.push({ q, r, isCapture: false, isCityCapture: false });
    }

    if (steps < maxSteps) {
      for (const n of getNeighbors(q, r)) {
        const key = `${n.q},${n.r}`;
        if (!visited.has(key) && board.has(key)) {
          visited.add(key);
          queue.push({ q: n.q, r: n.r, steps: steps + 1 });
        }
      }
    }
  }

  return result;
}

/**
 * Get the shortest path length from (fromQ, fromR) to (toQ, toR) for a piece.
 * Returns the number of steps, or -1 if unreachable within max steps.
 */
function getStepsToTarget(board, piece, fromQ, fromR, toQ, toR) {
  const maxSteps = UNIT_TYPES[piece.type].steps;
  const visited = new Set();
  const queue = [{ q: fromQ, r: fromR, steps: 0 }];
  visited.add(`${fromQ},${fromR}`);

  while (queue.length > 0) {
    const { q, r, steps } = queue.shift();

    if (q === toQ && r === toR && steps > 0) return steps;

    if (steps > 0) {
      const tile = board.get(`${q},${r}`);
      // Can't pass through occupied tiles or cities (they block)
      if (tile.occupant || tile.city) continue;
    }

    if (steps < maxSteps) {
      for (const n of getNeighbors(q, r)) {
        const key = `${n.q},${n.r}`;
        if (!visited.has(key) && board.has(key)) {
          visited.add(key);
          queue.push({ q: n.q, r: n.r, steps: steps + 1 });
        }
      }
    }
  }

  return -1;
}

/**
 * Get chain capture continuation moves after a capture on matching terrain.
 * Returns valid continuation moves (only captures on adjacent tiles within remaining steps).
 */
function getChainCaptureMoves(board, piece, fromQ, fromR, remainingSteps) {
  if (remainingSteps <= 0) return [];

  const visited = new Set();
  const result = [];
  const queue = [{ q: fromQ, r: fromR, steps: 0 }];
  visited.add(`${fromQ},${fromR}`);

  while (queue.length > 0) {
    const { q, r, steps } = queue.shift();

    if (steps > 0) {
      const tile = board.get(`${q},${r}`);

      if (tile.city && tile.city.owner !== piece.owner) {
        result.push({ q, r, isCapture: true, isCityCapture: true });
        continue;
      }

      if (tile.occupant) {
        if (tile.occupant.owner !== piece.owner) {
          result.push({ q, r, isCapture: true, isCityCapture: false });
        }
        continue;
      }

      result.push({ q, r, isCapture: false, isCityCapture: false });
    }

    if (steps < remainingSteps) {
      for (const n of getNeighbors(q, r)) {
        const key = `${n.q},${n.r}`;
        if (!visited.has(key) && board.has(key)) {
          visited.add(key);
          queue.push({ q: n.q, r: n.r, steps: steps + 1 });
        }
      }
    }
  }

  return result;
}

/**
 * Execute a move. Returns result object with details of what happened.
 * Does NOT modify the board — caller should apply the changes.
 */
function executeMove(board, piece, fromQ, fromR, toQ, toR) {
  const targetTile = board.get(`${toQ},${toR}`);
  const stepsUsed = getStepsToTarget(board, piece, fromQ, fromR, toQ, toR);

  if (stepsUsed === -1) {
    return { valid: false, reason: 'Cannot reach target tile' };
  }

  const result = {
    valid: true,
    fromQ, fromR, toQ, toR,
    captured: null,
    capturedCity: null,
    capitalCaptured: false,
    upgrade: null,
    spawnGrunt: false,
    chainCapture: false,
    chainCaptureMoves: [],
    remainingSteps: 0,
  };

  // Check for city capture
  if (targetTile.city && targetTile.city.owner !== piece.owner) {
    result.capturedCity = { ...targetTile.city };
    if (targetTile.city.isCapital) {
      result.capitalCaptured = true;
      return result;
    }

    // Non-capital city capture: upgrade logic
    if (piece.type === 'grunt') {
      result.upgrade = 'cavalry'; // caller must prompt for specialization
    } else if (piece.type === 'cavalry') {
      result.upgrade = 'vehicle'; // keeps specialization
    } else if (piece.type === 'vehicle') {
      result.spawnGrunt = true; // caller must prompt for city + adjacent tile
    }

    return result;
  }

  // Check for piece capture
  if (targetTile.occupant && targetTile.occupant.owner !== piece.owner) {
    result.captured = { ...targetTile.occupant };

    // Check chain capture: cavalry/vehicle with matching specialization
    if (piece.specialization && targetTile.terrain === piece.specialization) {
      const maxSteps = UNIT_TYPES[piece.type].steps;
      const remaining = maxSteps - stepsUsed;
      if (remaining > 0) {
        // Need to compute chain moves with the captured piece removed
        const tempBoard = new Map(board);
        const tempTile = { ...targetTile, occupant: { ...piece, id: piece.id }, city: null };
        tempBoard.set(`${toQ},${toR}`, tempTile);
        // Remove piece from old position
        const fromTile = { ...board.get(`${fromQ},${fromR}`), occupant: null };
        tempBoard.set(`${fromQ},${fromR}`, fromTile);

        const chainMoves = getChainCaptureMoves(tempBoard, piece, toQ, toR, remaining);
        if (chainMoves.length > 0) {
          result.chainCapture = true;
          result.chainCaptureMoves = chainMoves;
          result.remainingSteps = remaining;
        }
      }
    }
  }

  return result;
}

module.exports = {
  getValidMoves,
  getChainCaptureMoves,
  executeMove,
  getStepsToTarget,
};
