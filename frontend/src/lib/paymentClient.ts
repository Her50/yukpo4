// API client pour les paiements et recharge de tokens
import axios from 'axios';

export interface InitiatePaymentRequest {
  amount_xaf: number;
  payment_method: string;
  currency: string;
  phone_number?: string;
}

export interface InitiatePaymentResponse {
  payment_id: string;
  payment_url?: string;
  instructions: string;
  status: string;
}

export interface ConfirmPaymentRequest {
  payment_id: string;
  transaction_id?: string;
  status: string;
}

export interface PaymentHistoryItem {
  id: number;
  amount_xaf: number;
  currency: string;
  payment_method: string;
  status: string;
  created_at: string;
  tokens_purchased: number;
}

// Initier un paiement
export async function initiatePayment(request: InitiatePaymentRequest): Promise<InitiatePaymentResponse> {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('Token d\'authentification manquant');
  }

  const response = await axios.post('/api/payments/initiate', request, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  return response.data;
}

// Confirmer un paiement
export async function confirmPayment(request: ConfirmPaymentRequest): Promise<any> {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('Token d\'authentification manquant');
  }

  const response = await axios.post('/api/payments/confirm', request, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  return response.data;
}

// Récupérer l'historique des paiements
export async function getPaymentHistory(limit = 20, offset = 0): Promise<PaymentHistoryItem[]> {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('Token d\'authentification manquant');
  }

  const response = await axios.get(`/api/payments/history?limit=${limit}&offset=${offset}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  return response.data;
}

// Simuler la confirmation d'un paiement Mobile Money (pour développement)
export async function simulatePaymentConfirmation(paymentId: string, success = true): Promise<any> {
  return confirmPayment({
    payment_id: paymentId,
    transaction_id: `sim_${Date.now()}`,
    status: success ? 'success' : 'failed'
  });
}
