import { client } from './client'

export const incomeApi = {
  list:    (params = {}) => client.get('/income', { params }).then(r => r.data),
  create:  (body)        => client.post('/income', body).then(r => r.data),
  update:  (id, body)    => client.put(`/income/${id}`, body).then(r => r.data),
  remove:  (id)          => client.delete(`/income/${id}`),

  // Analytics
  summary:       ()               => client.get('/income/summary').then(r => r.data),
  byType:        (year)           => client.get('/income/by-type', { params: { year } }).then(r => r.data),
  monthlyTrend:  (months = 12)    => client.get('/income/monthly-trend', { params: { months } }).then(r => r.data),
}
