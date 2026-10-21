import React, { useMemo, useState } from 'react';
import './BoardSVG.css';

const COLS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];
const ROWS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

const PIECE_SYMBOLS = {
  R: '👊', // Rock / Búa
  S: '✂️', // Scissors / Kéo
  P: '✋', // Paper / Bao
};

const PIECE_NAMES = {
  R: 'Búa',
  S: 'Kéo',
  P: 'Bao',
};

export function BoardSVG({
  boardState = {},
  selectedSquare = null,
  highlightedSquares = [],
  capturableSquares = [],
  obstacles = [], // Top 32 obstacle squares (e.g. ['c3', 'c7', 'g3', 'g7', 'e5'])
  theme = 'wood', // 'wood' (Lichess classic) or 'academic'
  lastMove = null,
  onSquareClick = () => {},
  size = 540,
}) {
  const [hoveredSquare, setHoveredSquare] = useState(null);

  const cellSize = 52;
  const padding = 34;
  const totalSize = cellSize * 9 + padding * 2;

  // Normalize board state whether it is a map {"a1": {player, type}} or 2D matrix
  const normalizedBoard = useMemo(() => {
    const raw = boardState?.board || boardState || {};

    if (typeof raw === 'object' && !Array.isArray(raw)) {
      return raw;
    }

    if (Array.isArray(raw)) {
      const map = {};
      const numRows = raw.length;
      raw.forEach((rowStr, rIdx) => {
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

  const activeCol = hoveredSquare ? hoveredSquare[0] : selectedSquare ? selectedSquare[0] : null;
  const activeRow = hoveredSquare ? hoveredSquare[1] : selectedSquare ? selectedSquare[1] : null;

  // Colors based on theme
  const isWood = theme === 'wood';
  const outerPlateFill = isWood ? '#C89B6D' : '#F1F5F9';
  const outerPlateStroke = isWood ? '#A07048' : '#CBD5E1';
  const lightCellColor = isWood ? '#F0D9B5' : '#FFFFFF';
  const darkCellColor = isWood ? '#B58863' : '#E2E8F0';
  const labelColor = isWood ? '#6F4E37' : '#475569';
  const activeLabelColor = isWood ? '#1D4ED8' : '#1D4ED8';

  return (
    <div className="board-container">
      <svg
        className="board-svg"
        viewBox={`0 0 ${totalSize} ${totalSize}`}
        style={{ maxWidth: '100%', height: 'auto', width: size }}
        role="img"
        aria-label="Bàn cờ chiến thuật OTTv2 9x9 phong cách Lichess"
      >
        <defs>
          {/* Piece Gradients */}
          <linearGradient id="gradWhitePiece" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="60%" stopColor="#F8FAFC" />
            <stop offset="100%" stopColor="#E2E8F0" />
          </linearGradient>

          <linearGradient id="gradBlackPiece" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#334155" />
            <stop offset="70%" stopColor="#1E293B" />
            <stop offset="100%" stopColor="#0F172A" />
          </linearGradient>

          {/* Goal Radial Gradients */}
          <radialGradient id="gradGoldGoal" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(245, 158, 11, 0.45)" />
            <stop offset="100%" stopColor="rgba(245, 158, 11, 0.15)" />
          </radialGradient>

          <radialGradient id="gradCyanGoal" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(2, 132, 199, 0.45)" />
            <stop offset="100%" stopColor="rgba(2, 132, 199, 0.15)" />
          </radialGradient>

          {/* Top 32 Obstacle Pattern */}
          <pattern id="obstaclePattern" width="10" height="10" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="10" stroke="#334155" strokeWidth="3" />
          </pattern>

          {/* Arrowhead marker for move trajectory */}
          <marker
            id="moveArrowhead"
            markerWidth="10"
            markerHeight="10"
            refX="7"
            refY="5"
            orient="auto"
          >
            <polygon points="0 1, 9 5, 0 9" fill="#1D4ED8" />
          </marker>
        </defs>

        {/* Board Background Outer Plate */}
        <rect
          x={padding - 6}
          y={padding - 6}
          width={cellSize * 9 + 12}
          height={cellSize * 9 + 12}
          rx="12"
          fill={outerPlateFill}
          stroke={outerPlateStroke}
          strokeWidth="2.5"
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
            const isObstacle = obstacles.includes(sqName);

            const isSelected = selectedSquare === sqName;
            const isHighlighted = highlightedSquares.includes(sqName);
            const isCapturable = capturableSquares.includes(sqName);
            const isLastFrom = lastMove?.from === sqName;
            const isLastTo = lastMove?.to === sqName;
            const isHovered = hoveredSquare === sqName;

            let fillColor = isDark ? darkCellColor : lightCellColor;

            if (isObstacle) {
              fillColor = '#475569';
            } else if (isCapturable) {
              fillColor = 'rgba(239, 68, 68, 0.42)';
            } else if (isLastTo) {
              fillColor = 'rgba(29, 78, 216, 0.35)';
            } else if (isLastFrom) {
              fillColor = 'rgba(129, 140, 248, 0.35)';
            } else if (isSelected) {
              fillColor = 'rgba(245, 158, 11, 0.45)';
            } else if (isHighlighted) {
              fillColor = 'rgba(16, 185, 129, 0.38)';
            } else if (isWhiteGoal) {
              fillColor = 'url(#gradGoldGoal)';
            } else if (isBlackGoal) {
              fillColor = 'url(#gradCyanGoal)';
            }

            const piece = normalizedBoard[sqName];

            return (
              <g
                key={sqName}
                className={`cell-square ${isObstacle ? 'obstacle-cell' : ''}`}
                onClick={() => {
                  if (!isObstacle) onSquareClick(sqName, piece);
                }}
                onMouseEnter={() => setHoveredSquare(sqName)}
                onMouseLeave={() => setHoveredSquare(null)}
              >
                <title>
                  {sqName}
                  {isObstacle ? ' — Ô chướng ngại vật Top 32 (Không thể di chuyển vào)' : ''}
                  {isWhiteGoal ? ' — Ô đích phe Trắng (Mã W2)' : ''}
                  {isBlackGoal ? ' — Ô đích phe Đen (Mã B2)' : ''}
                  {piece ? ` (${piece.player === 'W' ? 'Trắng' : 'Đen'} ${PIECE_NAMES[piece.type]})` : ' (Trống)'}
                </title>

                {/* Cell Base Rect */}
                <rect
                  x={x}
                  y={y}
                  width={cellSize}
                  height={cellSize}
                  fill={fillColor}
                  stroke={
                    isCapturable
                      ? '#EF4444'
                      : isSelected
                      ? '#F59E0B'
                      : isHighlighted
                      ? '#10B981'
                      : isLastTo
                      ? '#1D4ED8'
                      : isLastFrom
                      ? '#6366F1'
                      : isWhiteGoal
                      ? '#D97706'
                      : isBlackGoal
                      ? '#0284C7'
                      : isHovered && !isObstacle
                      ? 'rgba(29, 78, 216, 0.45)'
                      : 'rgba(0, 0, 0, 0.04)'
                  }
                  strokeWidth={
                    isCapturable || isSelected || isHighlighted || isLastTo || isLastFrom || isWhiteGoal || isBlackGoal
                      ? 2.2
                      : 0.5
                  }
                />

                {/* Top 32 Obstacle Graphic */}
                {isObstacle && (
                  <g pointerEvents="none">
                    <rect
                      x={x + 3}
                      y={y + 3}
                      width={cellSize - 6}
                      height={cellSize - 6}
                      rx="6"
                      fill="#334155"
                      stroke="#1E293B"
                      strokeWidth="1.5"
                    />
                    <text
                      x={x + cellSize / 2}
                      y={y + cellSize / 2 + 5}
                      fontSize="17"
                      textAnchor="middle"
                    >
                      🧱
                    </text>
                  </g>
                )}

                {/* Goal Markers: Elegant corner ribbon */}
                {isWhiteGoal && (
                  <g pointerEvents="none">
                    <polygon
                      points={`${x + cellSize - 13},${y} ${x + cellSize},${y} ${x + cellSize},${y + 13}`}
                      fill="#F59E0B"
                    />
                    <text
                      x={x + cellSize - 2}
                      y={y + 7.5}
                      fontSize="6.5"
                      fill="#FFFFFF"
                      fontWeight="900"
                      textAnchor="end"
                    >
                      W
                    </text>
                    {!piece && (
                      <g>
                        <circle cx={x + cellSize / 2} cy={y + cellSize / 2} r="14" fill="rgba(245, 158, 11, 0.22)" />
                        <text
                          x={x + cellSize / 2}
                          y={y + cellSize / 2 + 5}
                          fontSize="15"
                          textAnchor="middle"
                        >
                          👑
                        </text>
                      </g>
                    )}
                  </g>
                )}

                {isBlackGoal && (
                  <g pointerEvents="none">
                    <polygon
                      points={`${x},${y + cellSize - 13} ${x},${y + cellSize} ${x + 13},${y + cellSize}`}
                      fill="#0284C7"
                    />
                    <text
                      x={x + 2}
                      y={y + cellSize - 2.5}
                      fontSize="6.5"
                      fill="#FFFFFF"
                      fontWeight="900"
                      textAnchor="start"
                    >
                      B
                    </text>
                    {!piece && (
                      <g>
                        <circle cx={x + cellSize / 2} cy={y + cellSize / 2} r="14" fill="rgba(2, 132, 199, 0.22)" />
                        <text
                          x={x + cellSize / 2}
                          y={y + cellSize / 2 + 5}
                          fontSize="15"
                          textAnchor="middle"
                        >
                          🎯
                        </text>
                      </g>
                    )}
                  </g>
                )}

                {/* Highlight dot indicator for legal empty square */}
                {isHighlighted && !piece && !isObstacle && (
                  <circle
                    cx={x + cellSize / 2}
                    cy={y + cellSize / 2}
                    r="6.5"
                    fill="#10B981"
                    opacity="0.95"
                    className="highlight-target-dot"
                  />
                )}

                {/* Capturable square attack indicator */}
                {isCapturable && (
                  <g pointerEvents="none">
                    <rect
                      x={x + 2}
                      y={y + 2}
                      width={cellSize - 4}
                      height={cellSize - 4}
                      fill="none"
                      stroke="#EF4444"
                      strokeWidth="2.2"
                      strokeDasharray="4 2"
                      className="capturable-target-pulse"
                    />
                    <text
                      x={x + cellSize - 3}
                      y={y + 11}
                      fontSize="9"
                      textAnchor="end"
                      fill="#DC2626"
                      fontWeight="bold"
                    >
                      ⚔️
                    </text>
                  </g>
                )}

                {/* Piece Rendering */}
                {piece && !isObstacle && (
                  <g
                    className="board-piece-group"
                    transform={`translate(${x + cellSize / 2}, ${y + cellSize / 2})`}
                  >
                    {/* Shadow & Base Circle */}
                    <circle
                      r="19"
                      className="piece-circle"
                      fill={piece.player === 'W' ? 'url(#gradWhitePiece)' : 'url(#gradBlackPiece)'}
                      stroke={
                        piece.player === 'W'
                          ? '#94A3B8'
                          : '#0284C7'
                      }
                      strokeWidth={piece.player === 'W' ? '1.8' : '2.2'}
                      filter="drop-shadow(0px 3px 5px rgba(0,0,0,0.35))"
                    />

                    {/* Inner Accent Ring for Black pieces */}
                    {piece.player === 'B' && (
                      <circle
                        r="16"
                        fill="none"
                        stroke="rgba(56, 189, 248, 0.4)"
                        strokeWidth="1"
                      />
                    )}

                    {/* Emoji Glyph */}
                    <text
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize="17"
                      className="piece-emoji"
                      y="-1"
                    >
                      {PIECE_SYMBOLS[piece.type] || piece.type}
                    </text>

                    {/* Miniature Accessible Letter Badge (R/S/P) */}
                    <g transform="translate(8, 8)">
                      <circle
                        r="5.5"
                        fill={piece.player === 'W' ? '#0F172A' : '#0284C7'}
                      />
                      <text
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize="7"
                        fontWeight="800"
                        fontFamily="var(--font-mono)"
                        fill="#FFFFFF"
                      >
                        {piece.type}
                      </text>
                    </g>
                  </g>
                )}
              </g>
            );
          })
        )}

        {/* Animated Move Vector Line Overlay between From and To */}
        {lastMoveFromCenter && lastMoveToCenter && (
          <g className="move-indicator-layer">
            <circle
              cx={lastMoveFromCenter.x}
              cy={lastMoveFromCenter.y}
              r="15"
              fill="none"
              stroke="#6366F1"
              strokeWidth="2"
              strokeDasharray="3 3"
              opacity="0.85"
            />
            <line
              x1={lastMoveFromCenter.x}
              y1={lastMoveFromCenter.y}
              x2={lastMoveToCenter.x}
              y2={lastMoveToCenter.y}
              stroke="#1D4ED8"
              strokeWidth="3"
              strokeDasharray="4 3"
              strokeLinecap="round"
              markerEnd="url(#moveArrowhead)"
              opacity="0.95"
            />
            <circle
              cx={lastMoveToCenter.x}
              cy={lastMoveToCenter.y}
              r="20"
              fill="none"
              stroke="#1D4ED8"
              strokeWidth="2.4"
              className="pulse-ring"
            />
          </g>
        )}

        {/* Column Labels (a-i) */}
        {COLS.map((col, idx) => {
          const x = padding + idx * cellSize + cellSize / 2;
          const isActive = activeCol === col;
          return (
            <React.Fragment key={`lbl-col-${col}`}>
              <text
                x={x}
                y={padding - 12}
                textAnchor="middle"
                fontSize="12"
                fill={isActive ? activeLabelColor : labelColor}
                fontWeight={isActive ? '800' : '700'}
                fontFamily="var(--font-mono)"
              >
                {col}
              </text>
              <text
                x={x}
                y={padding + cellSize * 9 + 18}
                textAnchor="middle"
                fontSize="12"
                fill={isActive ? activeLabelColor : labelColor}
                fontWeight={isActive ? '800' : '700'}
                fontFamily="var(--font-mono)"
              >
                {col}
              </text>
            </React.Fragment>
          );
        })}

        {/* Row Labels (1-9) */}
        {ROWS.map((row, idx) => {
          const y = padding + (8 - idx) * cellSize + cellSize / 2 + 4;
          const isActive = activeRow === row;
          return (
            <React.Fragment key={`lbl-row-${row}`}>
              <text
                x={padding - 14}
                y={y}
                textAnchor="middle"
                fontSize="12"
                fill={isActive ? activeLabelColor : labelColor}
                fontWeight={isActive ? '800' : '700'}
                fontFamily="var(--font-mono)"
              >
                {row}
              </text>
              <text
                x={padding + cellSize * 9 + 14}
                y={y}
                textAnchor="middle"
                fontSize="12"
                fill={isActive ? activeLabelColor : labelColor}
                fontWeight={isActive ? '800' : '700'}
                fontFamily="var(--font-mono)"
              >
                {row}
              </text>
            </React.Fragment>
          );
        })}
      </svg>

      {/* Board Legend Bar */}
      <div className="board-legend">
        <div className="legend-group">
          <div className="legend-item">
            <span className="legend-piece legend-white">W</span>
            <span>Trắng (Đi trước)</span>
          </div>
          <div className="legend-item">
            <span className="legend-piece legend-black">B</span>
            <span>Đen</span>
          </div>
          {obstacles.length > 0 && (
            <div className="legend-item">
              <span className="legend-obstacle">🧱</span>
              <span>Ô Cản Top 32</span>
            </div>
          )}
        </div>
        <div className="legend-group goal-legend-group">
          <span className="goal-tag gold-tag" title="Nếu quân Trắng vào ô i9, Trắng thắng ngay (Mã W2)">
            👑 i9: Đích Trắng
          </span>
          <span className="goal-tag cyan-tag" title="Nếu quân Đen vào ô a1, Đen thắng ngay (Mã B2)">
            🎯 a1: Đích Đen
          </span>
        </div>
        <div className="legend-group rules-mini-legend">
          <span>👊 R ăn ✂️ S</span>
          <span>•</span>
          <span>✂️ S ăn ✋ P</span>
          <span>•</span>
          <span>✋ P ăn 👊 R</span>
        </div>
      </div>
    </div>
  );
}

export default BoardSVG;
