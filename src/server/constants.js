const ROW_WIDTHS = [6, 5, 6, 5, 6, 5, 6, 5, 6, 5, 6, 5, 6];

const TERRAIN_TYPES = ['plain', 'forest', 'mountain'];

const UNIT_TYPES = {
  grunt: { steps: 1, shape: 'circle' },
  cavalry: { steps: 2, shape: 'triangle' },
  vehicle: { steps: 3, shape: 'rectangle' },
};

const UNITS_PER_PLAYER = {
  grunt: 10,
  cavalry: 5,
  vehicle: 2,
};

const MOVES_PER_TURN = 3;
const CITIES_PER_PLAYER = 3;

// Player 1 owns rows 0-5 + first half of row 6
// Player 2 owns rows 7-12 + second half of row 6
function getOwnerHalf(q, r) {
  if (r < 6) return 'player1';
  if (r > 6) return 'player2';
  // Row 6 has width 6, split: q 0-2 -> player1, q 3-5 -> player2
  return q < 3 ? 'player1' : 'player2';
}

module.exports = {
  ROW_WIDTHS,
  TERRAIN_TYPES,
  UNIT_TYPES,
  UNITS_PER_PLAYER,
  MOVES_PER_TURN,
  CITIES_PER_PLAYER,
  getOwnerHalf,
};
