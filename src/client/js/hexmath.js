/**
 * Hex math utilities for pointy-top hexagons with offset row layout.
 * Rows alternate between 6 and 5 tiles, with 5-tile rows offset right.
 */

const HEX_SIZE = 30; // radius (center to vertex)
const HEX_WIDTH = Math.sqrt(3) * HEX_SIZE;  // pointy-top width
const HEX_HEIGHT = HEX_SIZE * 2;             // pointy-top height
const MAX_ROW_WIDTH = 6;
const BOARD_PADDING = 40;

/**
 * Get pixel position for a hex tile at (q, r).
 * Pointy-top orientation, rows of 6 and 5 alternating.
 * 5-tile rows are offset to the right by half a hex width.
 */
function hexToPixel(q, r) {
  const rowWidth = ROW_WIDTHS[r];
  const isNarrowRow = rowWidth === 5;

  // Horizontal spacing between hex centers
  const colSpacing = HEX_WIDTH; // sqrt(3) * size

  // Center the board: offset narrow rows by half a hex width
  const xOffset = isNarrowRow ? colSpacing / 2 : 0;

  const x = BOARD_PADDING + xOffset + q * colSpacing + HEX_WIDTH / 2;

  // Vertical spacing: 1.5 * size between rows for pointy-top
  const rowSpacing = HEX_SIZE * 1.5;
  const y = BOARD_PADDING + r * rowSpacing + HEX_SIZE;

  return { x, y };
}

/**
 * Get total canvas size needed for the board.
 */
function getBoardSize() {
  const width = BOARD_PADDING * 2 + MAX_ROW_WIDTH * HEX_WIDTH;
  const rowSpacing = HEX_SIZE * 1.5;
  const height = BOARD_PADDING * 2 + (ROW_WIDTHS.length - 1) * rowSpacing + HEX_SIZE * 2;
  return { width, height };
}

/**
 * Draw a pointy-top hexagon at (cx, cy).
 */
function drawHex(ctx, cx, cy, size) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    const hx = cx + size * Math.cos(angle);
    const hy = cy + size * Math.sin(angle);
    if (i === 0) ctx.moveTo(hx, hy);
    else ctx.lineTo(hx, hy);
  }
  ctx.closePath();
}

/**
 * Check if a point (px, py) is inside a hexagon at (cx, cy).
 */
function pointInHex(px, py, cx, cy, size) {
  const dx = Math.abs(px - cx);
  const dy = Math.abs(py - cy);
  // Bounding box check for pointy-top
  if (dx > size * Math.sqrt(3) / 2 || dy > size) return false;
  // Hex edge check
  return size - dy >= (dx / (Math.sqrt(3) / 2)) * 0.5;
}

/**
 * Find which hex tile a pixel coordinate falls on.
 * Returns { q, r } or null.
 */
function pixelToHex(px, py) {
  let closest = null;
  let minDist = Infinity;

  for (let r = 0; r < ROW_WIDTHS.length; r++) {
    const rowWidth = ROW_WIDTHS[r];
    for (let q = 0; q < rowWidth; q++) {
      const { x, y } = hexToPixel(q, r);
      const dist = Math.sqrt((px - x) ** 2 + (py - y) ** 2);
      if (dist < minDist && dist < HEX_SIZE) {
        minDist = dist;
        closest = { q, r };
      }
    }
  }

  return closest;
}

/**
 * Draw a star shape (for cities).
 */
function drawStar(ctx, cx, cy, outerRadius, innerRadius, points) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const angle = (Math.PI / 180) * (360 / (points * 2) * i - 90);
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const sx = cx + radius * Math.cos(angle);
    const sy = cy + radius * Math.sin(angle);
    if (i === 0) ctx.moveTo(sx, sy);
    else ctx.lineTo(sx, sy);
  }
  ctx.closePath();
}

/**
 * Draw a triangle (for cavalry).
 */
function drawTriangle(ctx, cx, cy, size) {
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const angle = (Math.PI / 180) * (120 * i - 90);
    const tx = cx + size * Math.cos(angle);
    const ty = cy + size * Math.sin(angle);
    if (i === 0) ctx.moveTo(tx, ty);
    else ctx.lineTo(tx, ty);
  }
  ctx.closePath();
}

/**
 * Draw a rounded rectangle (for vehicle).
 */
function drawRoundedRect(ctx, cx, cy, w, h, radius) {
  const x = cx - w / 2;
  const y = cy - h / 2;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
