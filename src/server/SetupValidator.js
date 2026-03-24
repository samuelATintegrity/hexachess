const { getNeighbors } = require('./HexGrid');
const { getOwnerHalf, CITIES_PER_PLAYER, UNITS_PER_PLAYER, ROW_WIDTHS } = require('./constants');

/**
 * Validate city placement.
 * City must be on the player's half and tile must be empty.
 */
function validateCityPlacement(board, q, r, playerRole) {
  const key = `${q},${r}`;
  const tile = board.get(key);
  if (!tile) return { valid: false, reason: 'Invalid tile' };
  if (tile.occupant || tile.city) return { valid: false, reason: 'Tile is occupied' };
  if (getOwnerHalf(q, r) !== playerRole) return { valid: false, reason: 'Must place on your half' };
  return { valid: true };
}

/**
 * Validate capital selection.
 * Must be one of the player's placed cities.
 */
function validateCapitalSelection(board, q, r, playerRole) {
  const key = `${q},${r}`;
  const tile = board.get(key);
  if (!tile) return { valid: false, reason: 'Invalid tile' };
  if (!tile.city || tile.city.owner !== playerRole) {
    return { valid: false, reason: 'Must select one of your cities' };
  }
  return { valid: true };
}

/**
 * Validate unit placement.
 * First unit must be adjacent to a city.
 * Subsequent units must be adjacent to a city or previously placed unit.
 * Tile must be empty and on the player's half.
 */
function validateUnitPlacement(board, q, r, playerRole, unitType, specialization) {
  const key = `${q},${r}`;
  const tile = board.get(key);
  if (!tile) return { valid: false, reason: 'Invalid tile' };
  if (tile.occupant || tile.city) return { valid: false, reason: 'Tile is occupied' };
  if (getOwnerHalf(q, r) !== playerRole) return { valid: false, reason: 'Must place on your half' };

  // Check adjacency to a city or placed unit of the same player
  const neighbors = getNeighbors(q, r);
  const adjacentToOwn = neighbors.some(n => {
    const nTile = board.get(`${n.q},${n.r}`);
    if (!nTile) return false;
    if (nTile.city && nTile.city.owner === playerRole) return true;
    if (nTile.occupant && nTile.occupant.owner === playerRole) return true;
    return false;
  });

  if (!adjacentToOwn) {
    return { valid: false, reason: 'Must be adjacent to your city or placed unit' };
  }

  // Validate specialization
  if (unitType === 'grunt' && specialization) {
    return { valid: false, reason: 'Grunts cannot have specialization' };
  }
  if ((unitType === 'cavalry' || unitType === 'vehicle') && !specialization) {
    return { valid: false, reason: 'Cavalry and Vehicle must have a specialization' };
  }

  return { valid: true };
}

/**
 * Get all valid placement tiles for a player during unit placement.
 */
function getValidPlacementTiles(board, playerRole) {
  const validTiles = [];

  for (const [key, tile] of board) {
    if (tile.occupant || tile.city) continue;
    if (getOwnerHalf(tile.q, tile.r) !== playerRole) continue;

    const neighbors = getNeighbors(tile.q, tile.r);
    const adjacentToOwn = neighbors.some(n => {
      const nTile = board.get(`${n.q},${n.r}`);
      if (!nTile) return false;
      if (nTile.city && nTile.city.owner === playerRole) return true;
      if (nTile.occupant && nTile.occupant.owner === playerRole) return true;
      return false;
    });

    if (adjacentToOwn) {
      validTiles.push({ q: tile.q, r: tile.r });
    }
  }

  return validTiles;
}

module.exports = {
  validateCityPlacement,
  validateCapitalSelection,
  validateUnitPlacement,
  getValidPlacementTiles,
};
