import { client } from './client';

export const expensesApi = {
  list: (params = {}) =>
    client.get('/expenses', { params }).then((r) => r.data),

  create: (data) => client.post('/expenses', data).then((r) => r.data),

  bulkCreate: (expenses) =>
    client.post('/expenses/bulk', { expenses }).then((r) => r.data),

  get: (id) => client.get(`/expenses/${id}`).then((r) => r.data),

  update: (id, data) =>
    client.put(`/expenses/${id}`, data).then((r) => r.data),

  delete: (id) => client.delete(`/expenses/${id}`),

  restore: (id) =>
    client.post(`/expenses/${id}/restore`).then((r) => r.data),

  bulkCategorize: (body) =>
    client.post('/expenses/bulk-categorize', body).then((r) => r.data),
};

export const categoriesApi = {
  list: () => client.get('/categories').then((r) => r.data),
};
