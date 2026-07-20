import { client } from './client'

export const incomeApi = {
  list: (params = {}) => client.get('/income', { params }).then(r => r.data),
  create: (body) => client.post('/income', body).then(r => r.data),
  update: (id, body) => client.put(`/income/${id}`, body).then(r => r.data),
  remove: (id) => client.delete(`/income/${id}`),
}
