import { client } from './client'

export const usersApi = {
  /** Full profile + account stats */
  profile: () => client.get('/users/profile').then(r => r.data),

  /** Update full_name and/or monthly_income */
  updateProfile: (body) => client.put('/users/profile', body).then(r => r.data),

  /** Change password — requires current_password + new_password */
  changePassword: (body) => client.put('/users/change-password', body).then(r => r.data),

  /** Hard-delete the account and all its data */
  deleteAccount: () => client.delete('/users/account'),
}
