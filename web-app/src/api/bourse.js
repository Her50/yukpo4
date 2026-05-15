import { api } from './client'

export const bourseApi = {
  // --- Recherche livres ---
  search: (filters) => {
    const p = new URLSearchParams()
    Object.entries(filters).forEach(([k, v]) => { if (v !== '' && v != null) p.set(k, v) })
    return api.get(`/api/bourse-livre/search?${p}`)
  },
  browseByClass: (classe) => api.get(`/api/bourse-livre/v2/browse-by-class?classe=${encodeURIComponent(classe)}`),
  getById: (id) => api.get(`/api/bourse-livre/${id}`),

  // --- Mes livres ---
  getMesLivres: () => api.get('/api/bourse-livre/mes-livres'),
  createLivre: (data) => api.post('/api/bourse-livre', data),
  updateLivre: (id, data) => api.put(`/api/bourse-livre/${id}`, data),
  deleteLivre: (id) => api.delete(`/api/bourse-livre/${id}`),
  updateAvailability: (id, is_available) => api.patch(`/api/bourse-livre/${id}/availability`, { is_available }),

  // --- Troc ---
  getTrocMatchings: (livreId) => api.post('/api/troc-livres/match', { livre_id: livreId }),
  createDirectTroc: (livre_offert_id, livre_souhaite_id) =>
    api.post('/api/troc-livres/direct', { livre_offert_id, livre_souhaite_id }),
  createChaineTroc: (chaine_id) =>
    api.post('/api/troc-livres/chaines', { chaine_id }),
  getMesTrocs: (statut) => api.get(`/api/troc-livres/my-trocs${statut && statut !== 'all' ? `?statut=${statut}` : ''}`),
  getTrocDetails: (id) => api.get(`/api/troc-livres/${id}`),
  acceptTroc: (id) => api.post(`/api/troc-livres/${id}/accept`, {}),
  refuseTroc: (id) => api.post(`/api/troc-livres/${id}/refuse`, {}),
  completeTroc: (id) => api.post(`/api/troc-livres/${id}/complete`, {}),

  // --- Classes / programmes ---
  getClasses: () => api.get('/api/bourse-livre/v2/classes-programmes'),
}
