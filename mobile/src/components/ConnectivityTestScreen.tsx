import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { runFullConnectivityTest, ConnectivityResult } from '../services/connectivityTest';
import { locationApi } from '../services/api';

interface TestResult {
  name: string;
  result: ConnectivityResult;
  timestamp: number;
}

const ConnectivityTestScreen: React.FC = () => {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const runTest = async (testName: string, testFn: () => Promise<ConnectivityResult>) => {
    console.log(`[ConnectivityTest] Starting test: ${testName}`);
    const result = await testFn();
    
    setTestResults(prev => [...prev, {
      name: testName,
      result,
      timestamp: Date.now(),
    }]);
    
    return result;
  };

  const runAllTests = async () => {
    setIsLoading(true);
    setTestResults([]);
    
    try {
      // Test 1: Backend Health
      await runTest('Backend Health', async () => {
        const response = await fetch('https://yukpomnang.onrender.com/healthz');
        return {
          success: response.ok,
          endpoint: '/healthz',
          status: response.status,
        };
      });

      // Test 2: API User Profile
      await runTest('User API', async () => {
        try {
          const result = await fetch('https://yukpomnang.onrender.com/api/user/me');
          return {
            success: result.status !== 404,
            endpoint: '/api/user/me',
            status: result.status,
          };
        } catch (error: any) {
          return {
            success: false,
            endpoint: '/api/user/me',
            error: error.message,
          };
        }
      });

      // Test 3: GPS Location API
      await runTest('GPS Location API', async () => {
        try {
          const result = await fetch('https://yukpomnang.onrender.com/api/user/me/gps_location');
          return {
            success: result.status !== 404,
            endpoint: '/api/user/me/gps_location',
            status: result.status,
          };
        } catch (error: any) {
          return {
            success: false,
            endpoint: '/api/user/me/gps_location',
            error: error.message,
          };
        }
      });

      // Test 4: Services API
      await runTest('Services API', async () => {
        try {
          const result = await fetch('https://yukpomnang.onrender.com/api/services');
          return {
            success: result.status !== 404,
            endpoint: '/api/services',
            status: result.status,
          };
        } catch (error: any) {
          return {
            success: false,
            endpoint: '/api/services',
            error: error.message,
          };
        }
      });

      // Test 5: GPS Update (simulation)
      await runTest('GPS Update Test', async () => {
        try {
          // Simulation d'une mise à jour GPS
          const testData = { latitude: 4.0505, longitude: 9.7022 };
          const result = await fetch('https://yukpomnang.onrender.com/api/user/me/gps_location', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testData),
          });
          
          return {
            success: result.status === 200 || result.status === 401, // 401 = pas authentifié mais endpoint existe
            endpoint: '/api/user/me/gps_location',
            status: result.status,
          };
        } catch (error: any) {
          return {
            success: false,
            endpoint: '/api/user/me/gps_location',
            error: error.message,
          };
        }
      });

    } catch (error) {
      console.error('[ConnectivityTest] Error during tests:', error);
      Alert.alert('Erreur', 'Erreur lors des tests de connectivité');
    } finally {
      setIsLoading(false);
    }
  };

  const clearResults = () => {
    setTestResults([]);
  };

  const getStatusColor = (success: boolean) => {
    return success ? '#4CAF50' : '#F44336';
  };

  const getStatusIcon = (success: boolean) => {
    return success ? '✅' : '❌';
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>🔧 Test de Connectivité Mobile</Text>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.testButton]}
          onPress={runAllTests}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>
            {isLoading ? '🔄 Test en cours...' : '🚀 Lancer les Tests'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.button, styles.clearButton]}
          onPress={clearResults}
        >
          <Text style={styles.buttonText}>🗑️ Effacer</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>📊 Résultats des Tests</Text>
      
      {testResults.length === 0 ? (
        <Text style={styles.noResults}>Aucun test effectué</Text>
      ) : (
        testResults.map((test, index) => (
          <View key={index} style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <Text style={styles.testName}>{test.name}</Text>
              <Text style={styles.statusIcon}>
                {getStatusIcon(test.result.success)}
              </Text>
            </View>
            
            <Text style={styles.endpoint}>
              📍 Endpoint: {test.result.endpoint}
            </Text>
            
            {test.result.status && (
              <Text style={styles.status}>
                📊 Status: {test.result.status}
              </Text>
            )}
            
            {test.result.responseTime && (
              <Text style={styles.responseTime}>
                ⏱️ Temps: {test.result.responseTime}ms
              </Text>
            )}
            
            {test.result.error && (
              <Text style={styles.error}>
                ❌ Erreur: {test.result.error}
              </Text>
            )}
            
            <Text style={styles.timestamp}>
              🕒 {new Date(test.timestamp).toLocaleTimeString()}
            </Text>
          </View>
        ))
      )}
      
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>ℹ️ Informations</Text>
        <Text style={styles.infoText}>
          • Backend URL: https://yukpomnang.onrender.com
        </Text>
        <Text style={styles.infoText}>
          • Ces tests vérifient la connectivité vers le backend
        </Text>
        <Text style={styles.infoText}>
          • Les erreurs 401 sont normales (pas d'authentification)
        </Text>
        <Text style={styles.infoText}>
          • Les erreurs 404 indiquent des endpoints manquants
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  button: {
    padding: 12,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  testButton: {
    backgroundColor: '#2196F3',
  },
  clearButton: {
    backgroundColor: '#FF9800',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  noResults: {
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
    marginTop: 20,
  },
  resultCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  testName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  statusIcon: {
    fontSize: 20,
  },
  endpoint: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  status: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  responseTime: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  error: {
    fontSize: 14,
    color: '#F44336',
    marginBottom: 4,
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
  },
  infoCard: {
    backgroundColor: '#E3F2FD',
    padding: 16,
    borderRadius: 8,
    marginTop: 20,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#1976D2',
  },
  infoText: {
    fontSize: 14,
    color: '#1976D2',
    marginBottom: 4,
  },
});

export default ConnectivityTestScreen;
