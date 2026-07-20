import api from './client'

export const bankAccountsApi = {
  list: () =>
    api.get('/bank-accounts').then(r => r.data),

  create: (body) =>
    api.post('/bank-accounts', body).then(r => r.data),

  update: (id, body) =>
    api.patch(`/bank-accounts/${id}`, body).then(r => r.data),

  setDefault: (id) =>
    api.post(`/bank-accounts/${id}/set-default`).then(r => r.data),

  delete: (id) =>
    api.delete(`/bank-accounts/${id}`),
}
