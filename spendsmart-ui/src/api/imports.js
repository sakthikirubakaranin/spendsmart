import { client as api } from './client'

export const importsApi = {
  /** Upload a statement file. Returns preview with parsed transactions. */
  upload(file) {
    const form = new FormData()
    form.append('file', file)
    return api.post('/imports/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data)
  },

  /** Confirm a reviewed import — saves expenses to DB. */
  confirm(importId, transactions) {
    return api.post('/imports/confirm', {
      import_id: importId,
      transactions,
    }).then(r => r.data)
  },

  /** Past import history for the current user. */
  history() {
    return api.get('/imports/history').then(r => r.data)
  },

  /** Delete an import history record. */
  deleteHistory(importId) {
    return api.delete(`/imports/history/${importId}`)
  },
}
