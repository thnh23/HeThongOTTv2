import { API_BASE_URL } from './config.js';
import { ApiError } from './error.js';

async function request(method, path, body = undefined, options = {}) {
  let cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (API_BASE_URL.endsWith('/api') && cleanPath.startsWith('/api/')) {
    cleanPath = cleanPath.slice(4);
  }
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${cleanPath}`;

  
  const headers = new Headers(options.headers || {});
  
  // Inject auth token if available
  const token = localStorage.getItem('ottv2_token');
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const isFormData = body instanceof FormData;
  const isUrlSearchParams = body instanceof URLSearchParams;
  if (isFormData) {
    // Bắt buộc xóa Content-Type thủ công để trình duyệt tự động sinh multipart boundary chuẩn
    headers.delete('Content-Type');
  } else if (!isUrlSearchParams && body !== undefined && !headers.has('Content-Type')) {
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
  download: async (path, defaultFilename = 'download') => {
    let cleanPath = path.startsWith('/') ? path : `/${path}`;
    if (API_BASE_URL.endsWith('/api') && cleanPath.startsWith('/api/')) {
      cleanPath = cleanPath.slice(4);
    }
    const url = path.startsWith('http') ? path : `${API_BASE_URL}${cleanPath}`;
    const headers = new Headers();
    const token = localStorage.getItem('ottv2_token');
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    const res = await fetch(url, { headers });
    if (!res.ok) {
      let errorMsg = `Lỗi ${res.status}: ${res.statusText}`;
      try {
        const errJson = await res.json();
        if (errJson?.detail) errorMsg = errJson.detail;
      } catch {
        // ignore
      }
      throw new ApiError(res.status, errorMsg, null, 'DOWNLOAD_ERROR');
    }

    // Lấy tên file từ Content-Disposition header nếu có
    let filename = defaultFilename;
    const disposition = res.headers.get('content-disposition');
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (match && match[1]) {
        filename = match[1].replace(/['"]/g, '').trim();
      }
    }

    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(blobUrl);
  },
};
