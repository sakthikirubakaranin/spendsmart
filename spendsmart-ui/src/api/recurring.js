import { client } from './client'

export const recurringApi = {
  list: (params = {}) =>
    client.get('/recurring', { params }).then(r => r.data),

  create: (body) =>
    client.post('/recurring', body).then(r => r.data),

  update: (id, body) =>
    client.put(`/recurring/${id}`, body).then(r => r.data),

  remove: (id) =>
    client.delete(`/recurring/${id}`),

  markPaid: (id) =>
    client.post(`/recurring/${id}/mark-paid`).then(r => r.data),
}
