import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export const client = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// ── Attach access token to every request ──────────────────────────────────────
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Token refresh on 401 ──────────────────────────────────────────────────────
// Skip refresh logic for auth endpoints — they don't use tokens and
// a 401 from /auth/login should surface as an error to the caller.
const AUTH_ENDPOINTS = ['/auth/login', '/auth/register', '/auth/refresh'];

let isRefreshing = false;
let failedQueue = [];

function processQueue(error, token = null) {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token)));
  failedQueue = [];
}

function _logout() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  window.location.href = '/login';
}

client.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    // Don't intercept auth endpoints — let errors bubble up to the caller
    const isAuthEndpoint = AUTH_ENDPOINTS.some((path) =>
      original.url?.includes(path)
    );
    if (isAuthEndpoint) return Promise.reject(error);

    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            original.headers.Authorization = `Bearer ${token}`;
            return client(original);
          })
          .catch((err) => Promise.reject(err));
      }

      original._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) {
        isRefreshing = false;
        _logout();
        return Promise.reject(error);
      }

      try {
        const res = await axios.post(`${BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        });
        const { access_token, refresh_token } = res.data;
        localStorage.setItem('access_token', access_token);
        localStorage.setItem('refresh_token', refresh_token);
        client.defaults.headers.common.Authorization = `Bearer ${access_token}`;
        processQueue(null, access_token);
        original.headers.Authorization = `Bearer ${access_token}`;
        return client(original);
      } catch (err) {
        processQueue(err, null);
        _logout();
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
