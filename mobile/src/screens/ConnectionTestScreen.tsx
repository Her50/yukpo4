import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { API_BASE_URL } from '../config/api';

const ConnectionTestScreen: React.FC = () => {
  const [testResults, setTestResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const addResult = (test: string, success: boolean, message: string, details?: any) => {
    setTestResults(prev => [...prev, {
      test,
      success,
      message,
      details,
      timestamp: new Date().toLocaleTimeString()
    }]);
  };

  const testBackendConnection = async () => {
    try {
      addResult('Backend Health Check', false, 'Testing...', null);
      
      const response = await fetch(`${API_BASE_URL}/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (response.ok) {
        const data = await response.json();
        addResult('Backend Health Check', true, '✅ Backend accessible', data);
      } else {
        addResult('Backend Health Check', false, `❌ HTTP ${response.status}`, null);
      }
    } catch (error) {
      addResult('Backend Health Check', false, `❌ Erreur: ${error.message}`, null);
    }
  };

  const testAuthEndpoint = async () => {
    try {
      addResult('Auth Endpoint Test', false, 'Testing...', null);
      
      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (response.status === 401) {
        addResult('Auth Endpoint Test', true, '✅ Endpoint accessible (401 = non authentifié)', null);
      } else if (response.ok) {
        const data = await response.json();
        addResult('Auth Endpoint Test', true, '✅ Utilisateur authentifié', data);
      } else {
        addResult('Auth Endpoint Test', false, `❌ HTTP ${response.status}`, null);
      }
    } catch (error) {
      addResult('Auth Endpoint Test', false, `❌ Erreur: ${error.message}`, null);
    }
  };

  const testLoginEndpoint = async () => {
    try {
      addResult('Login Endpoint Test', false, 'Testing...', null);
      
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: 'test@example.com', 
          password: 'testpassword' 
        }),
      });
      
      const data = await response.json();
      
      if (response.status === 401 || response.status === 400) {
        addResult('Login Endpoint Test', true, '✅ Endpoint fonctionne (erreur normale)', data);
      } else if (response.ok) {
        addResult('Login Endpoint Test', true, '✅ Login réussi', data);
      } else {
        addResult('Login Endpoint Test', false, `❌ HTTP ${response.status}`, data);
      }
    } catch (error) {
      addResult('Login Endpoint Test', false, `❌ Erreur: ${error.message}`, null);
    }
  };

  const runAllTests = async () => {
    setIsLoading(true);
    setTestResults([]);
    
    await testBackendConnection();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await testAuthEndpoint();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await testLoginEndpoint();
    
    setIsLoading(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🔧 Test de Connexion Backend</Text>
        <Text style={styles.subtitle}>URL: {API_BASE_URL}</Text>
      </View>

      <TouchableOpacity 
        style={[styles.testButton, isLoading && styles.disabledButton]}
        onPress={runAllTests}
        disabled={isLoading}
      >
        <Text style={styles.testButtonText}>
          {isLoading ? '⏳ Tests en cours...' : '🚀 Lancer tous les tests'}
        </Text>
      </TouchableOpacity>

      <ScrollView style={styles.resultsContainer}>
        {testResults.map((result, index) => (
          <View key={index} style={[
            styles.resultItem,
            result.success ? styles.successItem : styles.errorItem
          ]}>
            <View style={styles.resultHeader}>
              <Text style={styles.resultTest}>{result.test}</Text>
              <Text style={styles.resultTime}>{result.timestamp}</Text>
            </View>
            <Text style={styles.resultMessage}>{result.message}</Text>
            {result.details && (
              <Text style={styles.resultDetails}>
                {JSON.stringify(result.details, null, 2)}
              </Text>
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    padding: 20,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  testButton: {
    backgroundColor: '#6366F1',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 20,
  },
  disabledButton: {
    backgroundColor: '#9CA3AF',
  },
  testButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resultsContainer: {
    flex: 1,
  },
  resultItem: {
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    borderLeftWidth: 4,
  },
  successItem: {
    backgroundColor: '#F0FDF4',
    borderLeftColor: '#10B981',
  },
  errorItem: {
    backgroundColor: '#FEF2F2',
    borderLeftColor: '#EF4444',
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  resultTest: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  resultTime: {
    fontSize: 12,
    color: '#666',
  },
  resultMessage: {
    fontSize: 14,
    color: '#333',
    marginBottom: 5,
  },
  resultDetails: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
    backgroundColor: '#F9F9F9',
    padding: 8,
    borderRadius: 4,
  },
});

export default ConnectionTestScreen;
