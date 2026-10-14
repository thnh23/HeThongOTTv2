let rawBase = (import.meta.env.VITE_API_BASE_URL || '/api').trim().replace(/\/+$/, '');
// Nếu là full URL http(s):// nhưng người dùng chưa gõ /api ở cuối, tự động thêm /api
if (rawBase.startsWith('http') && !rawBase.endsWith('/api')) {
  rawBase = `${rawBase}/api`;
}
export const API_BASE_URL = rawBase;


/**
 * Tạo URL WebSocket tương thích với cả môi trường Local, Docker và Render Cloud.
 * @param {string} path - Đường dẫn endpoint WebSocket (ví dụ: '/ws/leaderboard' hoặc '/ws/live/:id')
 * @returns {string} WebSocket URL hoàn chỉnh
 */
export function getWebSocketUrl(path) {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  // 1. Nếu cấu hình trực tiếp VITE_WS_BASE_URL trong Render Environment
  if (import.meta.env.VITE_WS_BASE_URL) {
    const base = import.meta.env.VITE_WS_BASE_URL.replace(/\/+$/, '');
    return `${base}${cleanPath}`;
  }

  // 2. Nếu VITE_API_BASE_URL là full URL (ví dụ: https://ottv2-api.onrender.com/api)
  if (import.meta.env.VITE_API_BASE_URL && import.meta.env.VITE_API_BASE_URL.startsWith('http')) {
    try {
      const url = new URL(import.meta.env.VITE_API_BASE_URL);
      const wsProtocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${wsProtocol}//${url.host}${cleanPath}`;
    } catch {
      // Fallback nếu parse URL lỗi
    }
  }

  // 3. Fallback cho Localhost / Same-Origin / Nginx reverse proxy
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${cleanPath}`;
}
