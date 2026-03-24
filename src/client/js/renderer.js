/**
 * Canvas renderer for the hex board.
 */

let canvas, ctx;
let gameState = null;
let selectedTile = null;
let validMoves = [];
let hoverTile = null;

function initRenderer() {
  canvas = document.getElementById('game-canvas');
  ctx = canvas.getContext('2d');

  const size = getBoardSize();
  canvas.width = size.width;
  canvas.height = size.height;

  canvas.addEventListener('mousemove', onMouseMove);
}

function onMouseMove(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const px = (e.clientX - rect.left) * scaleX;
  const py = (e.clientY - rect.top) * scaleY;

  const hex = pixelToHex(px, py);
  if (hex && (!hoverTile || hoverTile.q !== hex.q || hoverTile.r !== hex.r)) {
    hoverTile = hex;
    render();
  } else if (!hex && hoverTile) {
    hoverTile = null;
    render();
  }
}

function setGameState(state) {
  gameState = state;
  // Flip board for player1 so their pieces (rows 0-5) are at the bottom
  setFlipBoard(state.myRole === 'player1');
  render();
}

function setSelection(tile, moves) {
  selectedTile = tile;
  validMoves = moves || [];
  render();
}

function clearSelection() {
  selectedTile = null;
  validMoves = [];
  render();
}

function render() {
  if (!ctx || !gameState) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const board = gameState.board;

  // Draw all tiles
  for (const key in board) {
    const tile = board[key];
    const { x, y } = hexToPixel(tile.q, tile.r);

    // Draw hex fill (terrain)
    drawHex(ctx, x, y, HEX_SIZE - 1);
    ctx.fillStyle = TERRAIN_COLORS[tile.terrain];
    ctx.fill();

    // Territory tint overlay
    const tileOwner = getOwnerHalf(tile.q, tile.r);
    if (tileOwner === gameState.myRole) {
      drawHex(ctx, x, y, HEX_SIZE - 1);
      ctx.fillStyle = 'rgba(52, 152, 219, 0.1)';
      ctx.fill();
    } else {
      drawHex(ctx, x, y, HEX_SIZE - 1);
      ctx.fillStyle = 'rgba(231, 76, 60, 0.1)';
      ctx.fill();
    }

    // Highlight for valid moves
    const isValidMove = validMoves.find(m => m.q === tile.q && m.r === tile.r);
    if (isValidMove) {
      drawHex(ctx, x, y, HEX_SIZE - 1);
      if (isValidMove.isCapture) {
        ctx.fillStyle = 'rgba(231, 76, 60, 0.35)';
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      }
      ctx.fill();
    }

    // Selected tile highlight
    if (selectedTile && selectedTile.q === tile.q && selectedTile.r === tile.r) {
      drawHex(ctx, x, y, HEX_SIZE - 1);
      ctx.fillStyle = 'rgba(52, 152, 219, 0.4)';
      ctx.fill();
    }

    // Hover highlight
    if (hoverTile && hoverTile.q === tile.q && hoverTile.r === tile.r) {
      drawHex(ctx, x, y, HEX_SIZE - 1);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.fill();
    }

    // Hex outline
    drawHex(ctx, x, y, HEX_SIZE - 1);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw city
    if (tile.city) {
      const cityColor = PLAYER_COLORS[tile.city.owner];
      drawStar(ctx, x, y, 14, 6, 5);
      ctx.fillStyle = cityColor;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Show capital indicator for your own cities
      if (tile.city.isCapital && tile.city.owner === gameState.myRole) {
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('C', x, y + 3);
      }
    }

    // Draw piece
    if (tile.occupant) {
      const piece = tile.occupant;
      const pieceColor = PLAYER_COLORS[piece.owner];
      const pieceSize = 10;

      // Enable glow for specialized units
      if (piece.specialization && (piece.type === 'cavalry' || piece.type === 'vehicle')) {
        ctx.shadowColor = SPEC_GLOW_COLORS[piece.specialization];
        ctx.shadowBlur = 10;
      }

      if (piece.type === 'grunt') {
        ctx.beginPath();
        ctx.arc(x, y, pieceSize, 0, Math.PI * 2);
        ctx.fillStyle = pieceColor;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else if (piece.type === 'cavalry') {
        drawTriangle(ctx, x, y, pieceSize + 2);
        ctx.fillStyle = pieceColor;
        ctx.fill();
        // Specialization outline with glow
        if (piece.specialization) {
          ctx.strokeStyle = TERRAIN_OUTLINE_COLORS[piece.specialization];
          ctx.lineWidth = 4;
          ctx.stroke();
        }
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
      } else if (piece.type === 'vehicle') {
        drawRoundedRect(ctx, x, y, pieceSize * 2.2, pieceSize * 1.4, 3);
        ctx.fillStyle = pieceColor;
        ctx.fill();
        // Specialization outline with glow
        if (piece.specialization) {
          ctx.strokeStyle = TERRAIN_OUTLINE_COLORS[piece.specialization];
          ctx.lineWidth = 4;
          ctx.stroke();
        }
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Reset shadow
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;

      // Dim pieces that already moved this turn
      if (gameState.movedPieceIds && gameState.movedPieceIds.includes(piece.id)) {
        drawHex(ctx, x, y, HEX_SIZE - 1);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fill();
      }
    }
  }

  // During setup, draw a thick black border between territories
  const isSetup = gameState.phase === 'cityPlacement' || gameState.phase === 'capitalSelection' || gameState.phase === 'unitPlacement';
  if (isSetup) {
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 4;
    ctx.setLineDash([]);
    for (const key in board) {
      const tile = board[key];
      const tileOwner = getOwnerHalf(tile.q, tile.r);
      // Check each neighbor — if it belongs to the other player, draw a border edge
      const neighbors = getClientNeighbors(tile.q, tile.r);
      for (const n of neighbors) {
        const nKey = `${n.q},${n.r}`;
        if (!board[nKey]) continue;
        const nOwner = getOwnerHalf(n.q, n.r);
        if (tileOwner !== nOwner) {
          // Draw the shared edge between these two hexes
          const { x: x1, y: y1 } = hexToPixel(tile.q, tile.r);
          const { x: x2, y: y2 } = hexToPixel(n.q, n.r);
          drawSharedEdge(ctx, x1, y1, x2, y2, HEX_SIZE - 1);
        }
      }
    }
  }

  // Draw territory labels - "Your Side" at bottom, "Enemy Side" at top
  ctx.font = 'bold 12px Arial';
  ctx.textAlign = 'center';

  // After flip, player's own rows always render at the bottom
  // Use the visual top/bottom positions directly
  const { y: topY } = hexToPixel(2, flipBoard ? 12 : 0);
  const { y: botY } = hexToPixel(2, flipBoard ? 0 : 12);
  const centerX = canvas.width / 2;

  ctx.fillStyle = PLAYER_COLORS[gameState.myRole === 'player1' ? 'player2' : 'player1'];
  ctx.fillText('Enemy Side', centerX, topY - HEX_SIZE - 5);
  ctx.fillStyle = PLAYER_COLORS[gameState.myRole];
  ctx.fillText('Your Side', centerX, botY + HEX_SIZE + 14);
}

function getCanvasClickCoords(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    px: (e.clientX - rect.left) * scaleX,
    py: (e.clientY - rect.top) * scaleY,
  };
}
