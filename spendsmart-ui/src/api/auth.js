import { client } from './client';

export const authApi = {
  register: (data) => client.post('/auth/register', data).then((r) => r.data),

  verifyEmail: (token) =>
    client.post('/auth/verify-email', { token }).then((r) => r.data),

  login: async (email, password) => {
    const res = await client.post('/auth/login', { email, password });
    const { access_token, refresh_token, user } = res.data;
    localStorage.setItem('access_token', access_token);
    localStorage.setItem('refresh_token', refresh_token);
    return user;
  },

  logout: async () => {
    try {
      await client.post('/auth/logout');
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    }
  },

  me: () => client.get('/auth/me').then((r) => r.data),

  forgotPassword: (email) =>
    client.post('/auth/forgot-password', { email }).then((r) => r.data),

  resetPassword: ({ email, otp, new_password }) =>
    client
      .post('/auth/reset-password', { email, otp, new_password })
      .then((r) => r.data),

  socialLogin: async (id_token) => {
    const res = await client.post('/auth/social', { id_token })
    const { access_token, refresh_token, user } = res.data
    localStorage.setItem('access_token', access_token)
    localStorage.setItem('refresh_token', refresh_token)
    return user
  },
};
