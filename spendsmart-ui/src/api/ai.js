import { client } from './client'

export const aiApi = {
  /**
   * Ask a natural-language question about the user's expenses.
   * @param {string} question
   * @param {number} months  — how many months of history to include (default 6)
   * @returns {Promise<{answer: string, model_used: string}>}
   */
  query: (question, months = 6) =>
    client.post('/ai/query', { question, months }).then(r => r.data),

  /**
   * Get current AI settings (provider name, whether a BYOK key is saved).
   * The actual key is never returned.
   * @returns {Promise<{provider: string|null, has_key: boolean, using_default: boolean}>}
   */
  getSettings: () =>
    client.get('/ai/settings').then(r => r.data),

  /**
   * Save a BYOK provider + API key. Key is encrypted server-side.
   * @param {string} provider  — 'gemini' | 'openai' | 'anthropic' | 'groq'
   * @param {string} api_key
   */
  saveSettings: (provider, api_key) =>
    client.put('/ai/settings', { provider, api_key }).then(r => r.data),

  /**
   * Remove BYOK config — reverts to server's default Gemini key.
   */
  removeSettings: () =>
    client.delete('/ai/settings').then(r => r.data),
}
