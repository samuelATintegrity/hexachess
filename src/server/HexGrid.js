const { ROW_WIDTHS, TERRAIN_TYPES } = require('./constants');

/**
 * Generate all tile coordinates for the hex grid.
 * Returns array of { q, r } objects.
 */
function generateTileCoords() {
  const tiles = [];
  for (let r = 0; r < ROW_WIDTHS.length; r++) {
    const width = ROW_WIDTHS[r];
    for (let q = 0; q < width; q++) {
      tiles.push({ q, r });
    }
  }
  return tiles;
}

/**
 * Get all valid neighbor coordinates for a tile at (q, r).
 * Uses offset-style rows where odd rows (width 5) are shifted right.
 */
function getNeighbors(q, r) {
  const neighbors = [];
  const currentWidth = ROW_WIDTHS[r];

  // Same row neighbors
  if (q > 0) neighbors.push({ q: q - 1, r });
  if (q < currentWidth - 1) neighbors.push({ q: q + 1, r });

  // Row above (r - 1) and row below (r + 1)
  const isEvenRow = r % 2 === 0; // even rows have width 6

  for (const dr of [-1, 1]) {
    const nr = r + dr;
    if (nr < 0 || nr >= ROW_WIDTHS.length) continue;
    const neighborWidth = ROW_WIDTHS[nr];
    const neighborIsEven = nr % 2 === 0;

    // When going from a wide row (6) to a narrow row (5):
    //   tile q in wide row connects to q-1 and q in narrow row
    // When going from a narrow row (5) to a wide row (6):
    //   tile q in narrow row connects to q and q+1 in wide row

    if (isEvenRow && !neighborIsEven) {
      // Wide (6) to narrow (5): neighbors are q-1 and q in the narrow row
      const nq1 = q - 1;
      const nq2 = q;
      if (nq1 >= 0 && nq1 < neighborWidth) neighbors.push({ q: nq1, r: nr });
      if (nq2 >= 0 && nq2 < neighborWidth) neighbors.push({ q: nq2, r: nr });
    } else if (!isEvenRow && neighborIsEven) {
      // Narrow (5) to wide (6): neighbors are q and q+1 in the wide row
      const nq1 = q;
      const nq2 = q + 1;
      if (nq1 >= 0 && nq1 < neighborWidth) neighbors.push({ q: nq1, r: nr });
      if (nq2 >= 0 && nq2 < neighborWidth) neighbors.push({ q: nq2, r: nr });
    }
  }

  return neighbors;
}

/**
 * Generate a random board with terrain.
 * Returns a Map<string, Tile> keyed by "q,r".
 */
function generateBoard() {
  const board = new Map();
  const coords = generateTileCoords();

  for (const { q, r } of coords) {
    const terrain = TERRAIN_TYPES[Math.floor(Math.random() * TERRAIN_TYPES.length)];
    board.set(`${q},${r}`, {
      q,
      r,
      terrain,
      occupant: null,
      city: null,
    });
  }

  return board;
}

/**
 * Convert board Map to plain object for JSON serialization.
 */
function boardToObject(board) {
  const obj = {};
  for (const [key, tile] of board) {
    obj[key] = tile;
  }
  return obj;
}

/**
 * Convert plain object back to Map.
 */
function objectToBoard(obj) {
  const board = new Map();
  for (const [key, tile] of Object.entries(obj)) {
    board.set(key, tile);
  }
  return board;
}

module.exports = {
  generateTileCoords,
  getNeighbors,
  generateBoard,
  boardToObject,
  objectToBoard,
};
