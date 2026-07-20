import { client } from './client'

export const groupsApi = {
  list: () => client.get('/groups').then(r => r.data),
  create: (body) => client.post('/groups', body).then(r => r.data),
  get: (id) => client.get(`/groups/${id}`).then(r => r.data),
  update: (id, body) => client.patch(`/groups/${id}`, body).then(r => r.data),
  remove: (id) => client.delete(`/groups/${id}`),

  // Members
  addMember: (groupId, email) =>
    client.post(`/groups/${groupId}/members`, { email }).then(r => r.data),
  removeMember: (groupId, userId) =>
    client.delete(`/groups/${groupId}/members/${userId}`),

  // Expenses
  addExpense: (groupId, body) =>
    client.post(`/groups/${groupId}/expenses`, body).then(r => r.data),
  deleteExpense: (groupId, expenseId) =>
    client.delete(`/groups/${groupId}/expenses/${expenseId}`),

  // Settlement
  settlement: (groupId) =>
    client.get(`/groups/${groupId}/settlement`).then(r => r.data),
}
