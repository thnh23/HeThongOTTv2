import { API_BASE_URL } from './config.js';
import { ApiError } from './error.js';

async function request(method, path, body = undefined, options = {}) {
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  
  const headers = new Headers(options.headers || {});
  
  // Inject auth token if available
  const token = localStorage.getItem('ottv2_token');
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const isFormData = body instanceof FormData;
  const isUrlSearchParams = body instanceof URLSearchParams;
  if (!isFormData && !isUrlSearchParams && body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const config = {
    method,
    headers,
    signal: options.signal,
  };

  if (body !== undefined) {
    config.body = (isFormData || isUrlSearchParams) ? body : JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(url, config);
  } catch (err) {
    throw new ApiError(0, err.message || 'Mất kết nối tới máy chủ', null, 'NETWORK_ERROR');
  }

  let payload = null;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
  } else {
    payload = await response.text();
  }

  if (!response.ok) {
    const errorMsg = (payload && payload.detail) ? payload.detail : `Lỗi ${response.status}: ${response.statusText}`;
    throw new ApiError(response.status, errorMsg, payload, 'HTTP_ERROR');
  }

  return payload;
}

export const apiClient = {
  get: (path, options) => request('GET', path, undefined, options),
  post: (path, body, options) => request('POST', path, body, options),
  put: (path, body, options) => request('PUT', path, body, options),
  delete: (path, options) => request('DELETE', path, undefined, options),
};
