// API client pour les paiements et recharge de tokens
import axios from 'axios';
import { API_BASE_URL } from '@/config/api';
import { API_BASE_URL } from '@/config/api';

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

  const response = await axios.post(${API_BASE_URL}/api/payments/initiate, request, {
    headers: {
      'Authorization': Bearer ,
      'Content-Type': 'application/json'
    }
  });

  return response.data;
}

// Confirmer un paiement
export async function confirmPayment(request: ConfirmPaymentRequest): Promise<InitiatePaymentResponse> {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('Token d\'authentification manquant');
  }

  const response = await axios.post(${API_BASE_URL}/api/payments/confirm, request, {
    headers: {
      'Authorization': Bearer ,
      'Content-Type': 'application/json'
    }
  });

  return response.data;
}

// Récupérer l'historique des paiements
export async function getPaymentHistory(limit: number = 10, offset: number = 0): Promise<PaymentHistoryItem[]> {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('Token d\'authentification manquant');
  }

  const response = await axios.get(${API_BASE_URL}/api/payments/history?limit=&offset=, {
    headers: {
      'Authorization': Bearer ,
      'Content-Type': 'application/json'
    }
  });

  return response.data;
}

// Vérifier le statut d'un paiement
export async function checkPaymentStatus(paymentId: string): Promise<InitiatePaymentResponse> {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('Token d\'authentification manquant');
  }

  const response = await axios.get(${API_BASE_URL}/api/payments/status/, {
    headers: {
      'Authorization': Bearer ,
      'Content-Type': 'application/json'
    }
  });

  return response.data;
}

// Annuler un paiement
export async function cancelPayment(paymentId: string): Promise<InitiatePaymentResponse> {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('Token d\'authentification manquant');
  }

  const response = await axios.post(${API_BASE_URL}/api/payments/cancel, { payment_id: paymentId }, {
    headers: {
      'Authorization': Bearer ,
      'Content-Type': 'application/json'
    }
  });

  return response.data;
}
