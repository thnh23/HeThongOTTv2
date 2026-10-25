const defaultProdBackend = 'https://ottv2-backend.onrender.com';
const envApiUrl = import.meta.env.VITE_API_BASE_URL;

// Trong môi trường production, nếu chưa truyền biến môi trường, tự động trỏ về backend Render
let rawBase = (envApiUrl || (import.meta.env.PROD ? `${defaultProdBackend}/api` : '/api')).trim().replace(/\/+$/, '');

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

  // 1. Nếu cấu hình trực tiếp VITE_WS_BASE_URL trong Environment
  if (import.meta.env.VITE_WS_BASE_URL) {
    const base = import.meta.env.VITE_WS_BASE_URL.replace(/\/+$/, '');
    return `${base}${cleanPath}`;
  }

  // 2. Nếu API_BASE_URL là full URL (ví dụ: https://ottv2-backend.onrender.com/api)
  if (API_BASE_URL && API_BASE_URL.startsWith('http')) {
    try {
      const url = new URL(API_BASE_URL);
      const wsProtocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${wsProtocol}//${url.host}${cleanPath}`;
    } catch {
      // Fallback nếu parse URL lỗi
    }
  }

  // 3. Nếu đang chạy local dev trên Vite dev server (port 5173), kết nối trực tiếp backend FastAPI port 8000
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    if (window.location.port === '5173') {
      return `ws://${window.location.hostname}:8000${cleanPath}`;
    }
  }

  // 4. Fallback cho Môi trường Production
  if (import.meta.env.PROD) {
    return `wss://ottv2-backend.onrender.com${cleanPath}`;
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${cleanPath}`;
}
