import { client } from './client';

export const budgetsApi = {
  get: (month) =>
    client.get('/budgets', { params: month ? { month } : {} }).then((r) => r.data),

  upsert: (month, budgets) =>
    client.put('/budgets', { month, budgets }).then((r) => r.data),

  copy: (from_month, to_month) =>
    client.post('/budgets/copy', { from_month, to_month }).then((r) => r.data),
};
