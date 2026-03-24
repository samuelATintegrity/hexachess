/**
 * Hex math utilities for flat-top hexagons with offset row layout.
 */

const HEX_SIZE = 32; // radius (center to vertex)
const HEX_WIDTH = HEX_SIZE * 2;
const HEX_HEIGHT = Math.sqrt(3) * HEX_SIZE;
const MAX_ROW_WIDTH = 6;
const BOARD_PADDING = 40;

/**
 * Get pixel position for a hex tile at (q, r).
 * Uses flat-top orientation with offset rows.
 */
function hexToPixel(q, r) {
  const rowWidth = ROW_WIDTHS[r];
  // Total width of the widest row
  const maxPixelWidth = MAX_ROW_WIDTH * (HEX_SIZE * 1.5 + HEX_SIZE * 0.5);

  // Each hex center is spaced by 1.5 * HEX_SIZE horizontally
  const colSpacing = HEX_SIZE * 1.5;

  // Width of this row in pixels
  const rowPixelWidth = (rowWidth - 1) * colSpacing;
  const maxRowPixelWidth = (MAX_ROW_WIDTH - 1) * colSpacing;

  // Center offset for narrower rows
  const xOffset = (maxRowPixelWidth - rowPixelWidth) / 2;

  const x = BOARD_PADDING + xOffset + q * colSpacing;
  const y = BOARD_PADDING + r * HEX_HEIGHT * 0.5 + HEX_HEIGHT / 2;

  // Alternate row vertical offset for hex tiling
  // Even rows and odd rows interlock
  const yFinal = BOARD_PADDING + r * (HEX_HEIGHT * 0.5 + 1);

  return { x: x + HEX_SIZE, y: yFinal + HEX_SIZE };
}

/**
 * Get total canvas size needed for the board.
 */
function getBoardSize() {
  const maxColSpacing = HEX_SIZE * 1.5;
  const width = BOARD_PADDING * 2 + (MAX_ROW_WIDTH - 1) * maxColSpacing + HEX_SIZE * 2;
  const height = BOARD_PADDING * 2 + (ROW_WIDTHS.length - 1) * (HEX_HEIGHT * 0.5 + 1) + HEX_SIZE * 2;
  return { width, height };
}

/**
 * Draw a flat-top hexagon at (cx, cy).
 */
function drawHex(ctx, cx, cy, size) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i);
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

  // Quick bounding box check
  if (dx > size || dy > size * Math.sqrt(3) / 2) return false;

  // Hex boundary check
  return (size * Math.sqrt(3) / 2 - dy) * size >= (dx - size / 2) * size * Math.sqrt(3) / 2
    || dx <= size / 2;
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
