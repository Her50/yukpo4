// Service API centralise avec gestion d'authentification amelioree
// Remplace les appels fetch directs avec gestion des tokens

import { getValidToken } from '../utils/auth';

interface ApiServiceOptions extends RequestInit {
  isAuthenticated?: boolean;
}

export const apiService = async (
  endpoint: string,
  options: ApiServiceOptions = {}
): Promise<Response> => {
  const { isAuthenticated = true, headers, ...rest } = options;

  const defaultHeaders: HeadersInit = {
      'Content-Type': 'application/json',
  };

  if (isAuthenticated) {
    const token = getValidToken();
    if (token) {
      defaultHeaders['Authorization'] = `Bearer ${token}`;
    } else {
      // Handle cases where authentication is required but token is missing
      console.warn(`Attempted to make authenticated request to ${endpoint} without a token.`);
      // Optionally, throw an error or redirect to login
      // throw new Error('Authentication required, but no token found.');
    }
  }

  const config: RequestInit = {
    ...rest,
    headers: {
      ...defaultHeaders,
      ...headers,
    },
  };

  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'https://yukpomnang.onrender.com';
  const response = await fetch(`${baseUrl}${endpoint}`, config);

  if (!response.ok) {
    // Handle specific error codes, e.g., 401 for unauthorized
    if (response.status === 401 && isAuthenticated) {
      console.error("Unauthorized access. Token might be invalid or expired.");
      // Optionally, trigger a logout or redirect to login page
    }
    // You might want to parse the error response body here
    const errorBody = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(errorBody.message || `API error: ${response.statusText}`);
  }

  return response;
};

// Helper function for GET requests
export const apiGet = async (endpoint: string, options: ApiServiceOptions = {}) => {
  return apiService(endpoint, { ...options, method: 'GET' });
};

// Helper function for POST requests
export const apiPost = async (endpoint: string, data: any, options: ApiServiceOptions = {}) => {
  return apiService(endpoint, {
      ...options,
      method: 'POST',
    body: JSON.stringify(data),
    });
};

// Helper function for PUT requests
export const apiPut = async (endpoint: string, data: any, options: ApiServiceOptions = {}) => {
  return apiService(endpoint, {
      ...options,
      method: 'PUT',
    body: JSON.stringify(data),
  });
};

// Helper function for DELETE requests
export const apiDelete = async (endpoint: string, options: ApiServiceOptions = {}) => {
  return apiService(endpoint, { ...options, method: 'DELETE' });
};
