import { API_BASE_URL } from '../config/api';

export const testBackendConnection = async () => {
  try {
    console.log('[Backend Test] Testing connection to:', API_BASE_URL);
    
    // Test health endpoint
    const healthResponse = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    console.log('[Backend Test] Health status:', healthResponse.status);
    
    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      console.log('[Backend Test] Health data:', healthData);
      return { success: true, data: healthData };
    } else {
      console.error('[Backend Test] Health check failed:', healthResponse.status);
      return { success: false, error: `HTTP ${healthResponse.status}` };
    }
  } catch (error) {
    console.error('[Backend Test] Connection error:', error);
    return { success: false, error: error.message };
  }
};

export const testAuthEndpoint = async () => {
  try {
    console.log('[Auth Test] Testing auth endpoint...');
    
    const authResponse = await fetch(`${API_BASE_URL}/api/auth/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    console.log('[Auth Test] Auth status:', authResponse.status);
    
    if (authResponse.status === 401) {
      console.log('[Auth Test] Auth endpoint working (401 = not authenticated)');
      return { success: true, message: 'Auth endpoint accessible' };
    } else if (authResponse.ok) {
      const authData = await authResponse.json();
      console.log('[Auth Test] Auth data:', authData);
      return { success: true, data: authData };
    } else {
      console.error('[Auth Test] Auth check failed:', authResponse.status);
      return { success: false, error: `HTTP ${authResponse.status}` };
    }
  } catch (error) {
    console.error('[Auth Test] Connection error:', error);
    return { success: false, error: error.message };
  }
};
