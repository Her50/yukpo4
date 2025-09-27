import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { runFullConnectivityTest, ConnectivityTestResult } from '../services/connectivityTest';

const LogViewer: React.FC = () => {
  const [logs, setLogs] = useState<string[]>([]);
  const [testResults, setTestResults] = useState<ConnectivityTestResult[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev.slice(-9), `[${timestamp}] ${message}`]);
  };

  const runTest = async () => {
    addLog('🚀 Début du test de connectivité...');
    
    try {
      const results = await runFullConnectivityTest();
      setTestResults(results);
      
      results.forEach(result => {
        if (result.status === 'success') {
          addLog(`✅ ${result.endpoint} - OK`);
        } else {
          addLog(`❌ ${result.endpoint} - ${result.message}`);
        }
      });
      
      addLog('🏁 Test terminé');
    } catch (error) {
      addLog(`💥 Erreur: ${error}`);
    }
  };

  useEffect(() => {
    addLog('📱 LogViewer initialisé');
    addLog('🔗 Prêt pour les tests de connectivité');
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>📋 Logs en Temps Réel</Text>
      
      <ScrollView style={styles.logsContainer}>
        {logs.map((log, index) => (
          <Text key={index} style={styles.logText}>
            {log}
          </Text>
        ))}
      </ScrollView>

      <TouchableOpacity style={styles.button} onPress={runTest}>
        <Text style={styles.buttonText}>🧪 Lancer Test Connectivité</Text>
      </TouchableOpacity>

      {testResults.length > 0 && (
        <View style={styles.resultsContainer}>
          <Text style={styles.resultsTitle}>📊 Résultats Détailés:</Text>
          {testResults.map((result, index) => (
            <View key={index} style={styles.resultItem}>
              <Text style={styles.resultEndpoint}>{result.endpoint}</Text>
              <Text style={[
                styles.resultStatus, 
                result.status === 'success' ? styles.success : styles.error
              ]}>
                {result.status.toUpperCase()}
              </Text>
              <Text style={styles.resultMessage}>{result.message}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  logsContainer: {
    flex: 1,
    backgroundColor: '#000',
    borderRadius: 8,
    padding: 10,
    marginBottom: 15,
    maxHeight: 300,
  },
  logText: {
    color: '#00ff00',
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 2,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 15,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resultsContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  resultItem: {
    marginBottom: 10,
    padding: 10,
    backgroundColor: '#f9f9f9',
    borderRadius: 5,
  },
  resultEndpoint: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  resultStatus: {
    fontSize: 12,
    fontWeight: 'bold',
    marginVertical: 2,
  },
  success: {
    color: 'green',
  },
  error: {
    color: 'red',
  },
  resultMessage: {
    fontSize: 12,
    color: '#666',
  },
});

export default LogViewer;
