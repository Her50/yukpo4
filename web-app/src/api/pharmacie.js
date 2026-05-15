import { api } from './client'

export const pharmacieApi = {
  search: (q, ville) => api.get(`/api/pharmacies/search?q=${encodeURIComponent(q || '')}&ville=${encodeURIComponent(ville || '')}`),
  onDuty: (ville) => api.get(`/api/pharmacies/on-duty${ville ? `?ville=${encodeURIComponent(ville)}` : ''}`),
  getById: (id) => api.get(`/api/pharmacies/${id}`),
  searchMedicines: (q, ville) => api.get(`/api/medicines/nearby?q=${encodeURIComponent(q || '')}&ville=${encodeURIComponent(ville || '')}`),
  searchByMeds: (medications) => api.post('/api/pharmacies/search-by-medications', { medications }),
}
