export const COLS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];
export const ROWS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export const PIECE_SYMBOLS = {
  R: '👊',
  S: '✂️',
  P: '✋',
};

export const PIECE_NAMES = {
  R: 'Búa (Rock)',
  S: 'Kéo (Scissors)',
  P: 'Bao (Paper)',
};

/**
 * Trạng thái bàn cờ 9x9 khởi đầu chính thức theo rules.json
 * - Phe Đen (B): Hàng 8 & Hàng 9 (18 quân)
 * - Phe Trắng (W): Hàng 1 & Hàng 2 (18 quân)
 * - Hàng 3 đến 7: Trống hoàn toàn
 */
export const INITIAL_BOARD = {
  // Hàng 9 (Phe Đen)
  a9: { player: 'B', type: 'P' },
  b9: { player: 'B', type: 'S' },
  c9: { player: 'B', type: 'R' },
  d9: { player: 'B', type: 'P' },
  e9: { player: 'B', type: 'S' },
  f9: { player: 'B', type: 'R' },
  g9: { player: 'B', type: 'P' },
  h9: { player: 'B', type: 'S' },
  i9: { player: 'B', type: 'R' },

  // Hàng 8 (Phe Đen)
  a8: { player: 'B', type: 'S' },
  b8: { player: 'B', type: 'R' },
  c8: { player: 'B', type: 'P' },
  d8: { player: 'B', type: 'S' },
  e8: { player: 'B', type: 'R' },
  f8: { player: 'B', type: 'P' },
  g8: { player: 'B', type: 'S' },
  h8: { player: 'B', type: 'R' },
  i8: { player: 'B', type: 'P' },

  // Hàng 2 (Phe Trắng)
  a2: { player: 'W', type: 'P' },
  b2: { player: 'W', type: 'R' },
  c2: { player: 'W', type: 'S' },
  d2: { player: 'W', type: 'P' },
  e2: { player: 'W', type: 'R' },
  f2: { player: 'W', type: 'S' },
  g2: { player: 'W', type: 'P' },
  h2: { player: 'W', type: 'R' },
  i2: { player: 'W', type: 'S' },

  // Hàng 1 (Phe Trắng)
  a1: { player: 'W', type: 'R' },
  b1: { player: 'W', type: 'S' },
  c1: { player: 'W', type: 'P' },
  d1: { player: 'W', type: 'R' },
  e1: { player: 'W', type: 'S' },
  f1: { player: 'W', type: 'P' },
  g1: { player: 'W', type: 'R' },
  h1: { player: 'W', type: 'S' },
  i1: { player: 'W', type: 'P' },
};

export const WHITE_GOAL = 'i9';
export const BLACK_GOAL = 'a1';

export const BEATS = {
  R: 'S', // Búa đập Kéo
  S: 'P', // Kéo cắt Bao
  P: 'R', // Bao bọc Búa
};

/**
 * Kiểm tra xem quân tấn công có thể ăn quân phòng thủ không
 */
export function canCapture(attackerType, defenderType) {
  if (!attackerType || !defenderType) return false;
  return BEATS[attackerType] === defenderType;
}

/**
 * Tính các ô lân cận hợp lệ theo 8 hướng (tối đa 8 ô)
 */
export function getAdjacentSquares(sq) {
  if (!sq || sq.length < 2) return [];
  const cIdx = COLS.indexOf(sq[0].toLowerCase());
  const rIdx = ROWS.indexOf(sq[1]);
  if (cIdx === -1 || rIdx === -1) return [];

  const directions = [
    [-1, -1], [0, -1], [1, -1],
    [-1,  0],          [1,  0],
    [-1,  1], [0,  1], [1,  1],
  ];

  const results = [];
  directions.forEach(([dx, dy]) => {
    const nc = cIdx + dx;
    const nr = rIdx + dy;
    if (nc >= 0 && nc < 9 && nr >= 0 && nr < 9) {
      results.push(`${COLS[nc]}${ROWS[nr]}`);
    }
  });

  return results;
}

/**
 * Phân tích chi tiết nước đi hợp lệ và lý do bị chặn từ 1 ô theo luật OTTv2
 * @param {Object} boardState Bản đồ ô cờ {"a1": {player: 'W', type: 'R'}}
 * @param {string} sq Tọa độ ô (ví dụ 'f2')
 */
export function getSquareMoveDetails(boardState = {}, sq) {
  if (!sq) {
    return {
      piece: null,
      legalMoves: [],
      emptyMoves: [],
      captureMoves: [],
      blockedFriendly: [],
      blockedSameType: [],
      blockedDefeated: [],
    };
  }

  const piece = boardState[sq] || null;
  if (!piece) {
    return {
      piece: null,
      legalMoves: [],
      emptyMoves: [],
      captureMoves: [],
      blockedFriendly: [],
      blockedSameType: [],
      blockedDefeated: [],
    };
  }

  const adjacent = getAdjacentSquares(sq);
  const emptyMoves = [];
  const captureMoves = [];
  const blockedFriendly = [];
  const blockedSameType = [];
  const blockedDefeated = [];

  adjacent.forEach((targetSq) => {
    const targetPiece = boardState[targetSq];
    if (!targetPiece) {
      // Ô trống -> Luôn đi được
      emptyMoves.push(targetSq);
    } else if (targetPiece.player === piece.player) {
      // Ô có quân mình -> Bị chặn (không được dẫm lên quân cùng phe)
      blockedFriendly.push({ sq: targetSq, piece: targetPiece });
    } else {
      // Ô có quân địch
      if (targetPiece.type === piece.type) {
        // Cùng loại -> Chặn đường, không ăn nhau
        blockedSameType.push({ sq: targetSq, piece: targetPiece });
      } else if (canCapture(piece.type, targetPiece.type)) {
        // Khác loại & Kẻ mạnh hơn ăn kẻ yếu -> Ăn được
        captureMoves.push({ sq: targetSq, piece: targetPiece });
      } else {
        // Kẻ yếu hơn -> Bị chặn, không vào được ô của kẻ mạnh
        blockedDefeated.push({ sq: targetSq, piece: targetPiece });
      }
    }
  });

  const legalMoves = [
    ...emptyMoves,
    ...captureMoves.map((c) => c.sq),
  ];

  return {
    piece,
    legalMoves,
    emptyMoves,
    captureMoves,
    blockedFriendly,
    blockedSameType,
    blockedDefeated,
  };
}
