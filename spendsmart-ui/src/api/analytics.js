import { client } from './client';

export const analyticsApi = {
  summary: (params = {}) =>
    client.get('/analytics/summary', { params }).then((r) => r.data),

  byCategory: (params = {}) =>
    client.get('/analytics/by-category', { params }).then((r) => r.data),

  daily: (params = {}) =>
    client.get('/analytics/daily', { params }).then((r) => r.data),

  monthlyTrend: (months = 6) =>
    client.get('/analytics/monthly-trend', { params: { months } }).then((r) => r.data),

  topMerchants: (params = {}) =>
    client.get('/analytics/top-merchants', { params }).then((r) => r.data),

  budgetStatus: (month) =>
    client
      .get('/analytics/budget-status', { params: month ? { month } : {} })
      .then((r) => r.data),

  monthlyByCategory: (params = {}) =>
    client.get('/analytics/monthly-by-category', { params }).then((r) => r.data),

  categoryInsights: (year) =>
    client.get('/analytics/category-insights', { params: year ? { year } : {} }).then((r) => r.data),

  financialTips: () =>
    client.get('/analytics/financial-tips').then((r) => r.data),

  /** Budget alerts — categories at 80%+ of this month's budget */
  alerts: (month) =>
    client.get('/analytics/alerts', { params: month ? { month } : {} }).then((r) => r.data),
};
