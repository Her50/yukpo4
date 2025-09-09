// Service d'API pour vérifier l'existence d'un service similaire (anti-doublon)
import axios from 'axios';

export async function checkServiceDoublon(payload: { titre: string; categorie: string; gps?: string }) {
  const token = localStorage.getItem('token');
  if (!token) throw new Error('Token manquant');
  const res = await axios.get('/api/services/check-duplicate', {
    params: payload,
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data; // { exists: boolean, service?: any }
}
