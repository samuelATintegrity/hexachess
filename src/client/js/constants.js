const ROW_WIDTHS = [6, 5, 6, 5, 6, 5, 6, 5, 6, 5, 6, 5, 6];

const TERRAIN_COLORS = {
  plain: '#F4D03F',
  forest: '#27AE60',
  mountain: '#8B6914',
};

const TERRAIN_OUTLINE_COLORS = {
  plain: '#FFD700',
  forest: '#00FF7F',
  mountain: '#FF8C00',
};

// Glow colors for specialization (brighter versions for shadow effect)
const SPEC_GLOW_COLORS = {
  plain: '#FFFF00',
  forest: '#00FF88',
  mountain: '#FF6600',
};

const PLAYER_COLORS = {
  player1: '#3498DB',
  player2: '#E74C3C',
};

const UNIT_TYPES = {
  grunt: { steps: 1, label: 'Grunt' },
  cavalry: { steps: 2, label: 'Cavalry' },
  vehicle: { steps: 3, label: 'Vehicle' },
};

const UNITS_PER_PLAYER = {
  grunt: 10,
  cavalry: 5,
  vehicle: 2,
};

const MOVES_PER_TURN = 3;
const CITIES_PER_PLAYER = 3;

function getOwnerHalf(q, r) {
  if (r < 6) return 'player1';
  if (r > 6) return 'player2';
  return q < 3 ? 'player1' : 'player2';
}
