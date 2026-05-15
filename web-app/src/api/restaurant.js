import { api } from './client'

export const restaurantApi = {
  list: (ville) => api.get(`/api/restaurant/public/list${ville ? `?ville=${encodeURIComponent(ville)}` : ''}`),
  search: (q, ville) => api.get(`/api/restaurant/public/search?q=${encodeURIComponent(q || '')}&ville=${encodeURIComponent(ville || '')}`),
  getMenu: (serviceId) => api.get(`/api/restaurant/public/${serviceId}/menu`),
  placeOrder: (serviceId, items, tableId) => api.post(`/api/restaurant/public/${serviceId}/order`, { items, table_id: tableId }),
  getOrderStatus: (orderId) => api.get(`/api/restaurant/public/orders/${orderId}/status`),
  getHistory: () => api.get('/api/restaurant/public/orders/history'),
  rateOrder: (orderId, note, commentaire) => api.post(`/api/restaurant/public/orders/${orderId}/rate`, { note, commentaire }),
}
