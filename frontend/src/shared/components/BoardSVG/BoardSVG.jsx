import React, { useMemo } from 'react';
import './BoardSVG.css';

const COLS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];
const ROWS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

const PIECE_SYMBOLS = {
  R: '👊', // Rock / Búa
  S: '✂️', // Scissors / Kéo
  P: '✋', // Paper / Bao
};

export function BoardSVG({
  boardState = {},
  selectedSquare = null,
  highlightedSquares = [],
  lastMove = null,
  onSquareClick = () => {},
  size = 540,
}) {
  const cellSize = 52;
  const padding = 34;
  const totalSize = cellSize * 9 + padding * 2;

  // Normalize board state whether it is a map {"a1": {player, type}} or 2D matrix
  const normalizedBoard = useMemo(() => {
    const raw = boardState?.board || boardState || {};

    // Case 1: Already an object map like {"a1": {player: 'W', type: 'R'}}
    if (typeof raw === 'object' && !Array.isArray(raw)) {
      return raw;
    }

    // Case 2: Array of 12 strings or 9 strings (e.g. ["RS.PRS...", ...])
    if (Array.isArray(raw)) {
      const map = {};
      const numRows = raw.length;
      raw.forEach((rowStr, rIdx) => {
        // row index 0 is top row
        const rowNum = String(numRows - rIdx);
        for (let cIdx = 0; cIdx < rowStr.length && cIdx < 9; cIdx++) {
          const ch = rowStr[cIdx];
          const colName = COLS[cIdx];
          const sq = `${colName}${rowNum}`;
          if (ch >= 'A' && ch <= 'Z') {
            map[sq] = { player: 'W', type: ch };
          } else if (ch >= 'a' && ch <= 'z') {
            map[sq] = { player: 'B', type: ch.toUpperCase() };
          }
        }
      });
      return map;
    }

    return {};
  }, [boardState]);

  // Helper to get center coordinates of square "e5"
  const getSquareCenter = (sq) => {
    if (!sq || sq.length < 2) return null;
    const cIdx = COLS.indexOf(sq[0].toLowerCase());
    const rIdx = ROWS.indexOf(sq[1]);
    if (cIdx === -1 || rIdx === -1) return null;
    return {
      x: padding + cIdx * cellSize + cellSize / 2,
      y: padding + (8 - rIdx) * cellSize + cellSize / 2,
    };
  };

  const lastMoveFromCenter = lastMove?.from ? getSquareCenter(lastMove.from) : null;
  const lastMoveToCenter = lastMove?.to ? getSquareCenter(lastMove.to) : null;

  return (
    <div className="board-container">
      <svg
        className="board-svg"
        viewBox={`0 0 ${totalSize} ${totalSize}`}
        width={size}
        height={size}
        role="img"
        aria-label="Bàn cờ chiến thuật OTTv2"
      >
        <defs>
          {/* Piece Gradients */}
          <linearGradient id="gradWhitePiece" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#E2E8F0" />
          </linearGradient>
          <linearGradient id="gradBlackPiece" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1E293B" />
            <stop offset="100%" stopColor="#0B1120" />
          </linearGradient>

          {/* Arrowhead marker for move trajectory */}
          <marker
            id="moveArrowhead"
            markerWidth="8"
            markerHeight="8"
            refX="6"
            refY="4"
            orient="auto"
          >
            <polygon points="0 1, 8 4, 0 7" fill="#22D3EE" />
          </marker>
        </defs>

        {/* Board Background Outer */}
        <rect
          x={padding - 6}
          y={padding - 6}
          width={cellSize * 9 + 12}
          height={cellSize * 9 + 12}
          rx="12"
          fill="#0B0F19"
          stroke="rgba(255, 255, 255, 0.14)"
          strokeWidth="2"
        />

        {/* 9x9 Cells */}
        {COLS.map((col, cIdx) =>
          ROWS.map((row, rIdx) => {
            const sqName = `${col}${row}`;
            const x = padding + cIdx * cellSize;
            const y = padding + (8 - rIdx) * cellSize; // row 1 at bottom, row 9 at top

            const isDark = (cIdx + rIdx) % 2 === 0;
            const isWhiteGoal = sqName === 'i9';
            const isBlackGoal = sqName === 'a1';

            const isSelected = selectedSquare === sqName;
            const isHighlighted = highlightedSquares.includes(sqName);
            const isLastFrom = lastMove?.from === sqName;
            const isLastTo = lastMove?.to === sqName;

            let fillColor = isDark ? '#111728' : '#161F36';

            if (isLastFrom) {
              fillColor = 'rgba(99, 102, 241, 0.28)';
            } else if (isLastTo) {
              fillColor = 'rgba(34, 211, 238, 0.25)';
            } else if (isHighlighted) {
              fillColor = 'rgba(52, 211, 153, 0.28)';
            } else if (isSelected) {
              fillColor = 'rgba(245, 158, 11, 0.35)';
            }

            const piece = normalizedBoard[sqName];

            return (
              <g
                key={sqName}
                className="cell-square"
                onClick={() => onSquareClick(sqName, piece)}
              >
                {/* Cell Base Rect */}
                <rect
                  x={x}
                  y={y}
                  width={cellSize}
                  height={cellSize}
                  fill={fillColor}
                  stroke={
                    isSelected
                      ? '#F59E0B'
                      : isHighlighted
                      ? '#34D399'
                      : isLastTo
                      ? '#22D3EE'
                      : isLastFrom
                      ? '#818CF8'
                      : isWhiteGoal
                      ? '#FBBF24'
                      : isBlackGoal
                      ? '#38BDF8'
                      : 'rgba(255, 255, 255, 0.05)'
                  }
                  strokeWidth={
                    isSelected || isHighlighted || isLastTo || isLastFrom || isWhiteGoal || isBlackGoal
                      ? 2
                      : 1
                  }
                />

                {/* Goal Markers */}
                {isWhiteGoal && (
                  <text
                    x={x + cellSize - 4}
                    y={y + 11}
                    fontSize="9"
                    fill="#FBBF24"
                    fontWeight="700"
                    textAnchor="end"
                  >
                    👑 Đích W
                  </text>
                )}
                {isBlackGoal && (
                  <text
                    x={x + 4}
                    y={y + cellSize - 4}
                    fontSize="9"
                    fill="#38BDF8"
                    fontWeight="700"
                    textAnchor="start"
                  >
                    🎯 Đích B
                  </text>
                )}

                {/* Highlight dot indicator */}
                {isHighlighted && !piece && (
                  <circle
                    cx={x + cellSize / 2}
                    cy={y + cellSize / 2}
                    r="5"
                    fill="#34D399"
                    opacity="0.85"
                  />
                )}

                {/* Piece Rendering */}
                {piece && (
                  <g
                    className="board-piece-group"
                    transform={`translate(${x + cellSize / 2}, ${y + cellSize / 2})`}
                  >
                    <circle
                      r="18"
                      className="piece-circle"
                      fill={piece.player === 'W' ? 'url(#gradWhitePiece)' : 'url(#gradBlackPiece)'}
                      stroke={piece.player === 'W' ? '#94A3B8' : '#22D3EE'}
                      strokeWidth={piece.player === 'W' ? '1.5' : '2'}
                      filter="drop-shadow(0px 3px 6px rgba(0,0,0,0.55))"
                    />
                    <text
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize="17"
                      className="piece-emoji"
                    >
                      {PIECE_SYMBOLS[piece.type] || piece.type}
                    </text>
                  </g>
                )}
              </g>
            );
          })
        )}

        {/* Animated Move Vector Line Overlay between From and To */}
        {lastMoveFromCenter && lastMoveToCenter && (
          <g className="move-indicator-layer">
            {/* Origin Ripple */}
            <circle
              cx={lastMoveFromCenter.x}
              cy={lastMoveFromCenter.y}
              r="14"
              fill="none"
              stroke="#818CF8"
              strokeWidth="1.5"
              strokeDasharray="3 3"
              opacity="0.7"
            />
            {/* Directional Trajectory Line */}
            <line
              x1={lastMoveFromCenter.x}
              y1={lastMoveFromCenter.y}
              x2={lastMoveToCenter.x}
              y2={lastMoveToCenter.y}
              stroke="#22D3EE"
              strokeWidth="2.5"
              strokeDasharray="4 3"
              strokeLinecap="round"
              markerEnd="url(#moveArrowhead)"
              opacity="0.9"
            />
            {/* Target Pulse */}
            <circle
              cx={lastMoveToCenter.x}
              cy={lastMoveToCenter.y}
              r="20"
              fill="none"
              stroke="#22D3EE"
              strokeWidth="2"
              className="pulse-ring"
            />
          </g>
        )}

        {/* Column Labels (a-i) */}
        {COLS.map((col, idx) => {
          const x = padding + idx * cellSize + cellSize / 2;
          return (
            <React.Fragment key={`lbl-col-${col}`}>
              <text
                x={x}
                y={padding - 12}
                textAnchor="middle"
                fontSize="12"
                fill="var(--text-muted)"
                fontWeight="600"
              >
                {col}
              </text>
              <text
                x={x}
                y={padding + cellSize * 9 + 18}
                textAnchor="middle"
                fontSize="12"
                fill="var(--text-muted)"
                fontWeight="600"
              >
                {col}
              </text>
            </React.Fragment>
          );
        })}

        {/* Row Labels (1-9) */}
        {ROWS.map((row, idx) => {
          const y = padding + (8 - idx) * cellSize + cellSize / 2 + 4;
          return (
            <React.Fragment key={`lbl-row-${row}`}>
              <text
                x={padding - 14}
                y={y}
                textAnchor="middle"
                fontSize="12"
                fill="var(--text-muted)"
                fontWeight="600"
              >
                {row}
              </text>
              <text
                x={padding + cellSize * 9 + 14}
                y={y}
                textAnchor="middle"
                fontSize="12"
                fill="var(--text-muted)"
                fontWeight="600"
              >
                {row}
              </text>
            </React.Fragment>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="board-legend">
        <div className="legend-group">
          <div className="legend-item">
            <span className="legend-piece legend-white">W</span>
            <span>Trắng (White)</span>
          </div>
          <div className="legend-item">
            <span className="legend-piece legend-black">B</span>
            <span>Đen (Black)</span>
          </div>
        </div>
        <div className="legend-group rules-mini-legend">
          <span>👊 Búa ăn ✂️ Kéo</span>
          <span>•</span>
          <span>✂️ Kéo ăn ✋ Bao</span>
          <span>•</span>
          <span>✋ Bao ăn 👊 Búa</span>
        </div>
      </div>
    </div>
  );
}
