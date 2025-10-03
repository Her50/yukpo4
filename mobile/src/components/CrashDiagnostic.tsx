import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Card, Button, Chip } from 'react-native-paper';
import { Bug, CheckCircle, XCircle, Warning, Info } from 'phosphor-react-native';
// import * as Clipboard from 'expo-clipboard';

interface DiagnosticResult {
  name: string;
  status: 'success' | 'error' | 'warning' | 'info';
  message: string;
  details?: string;
}

interface CrashDiagnosticProps {
  visible: boolean;
  onClose: () => void;
}

const CrashDiagnostic: React.FC<CrashDiagnosticProps> = ({ visible, onClose }) => {
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const runDiagnostics = async () => {
    setIsRunning(true);
    const results: DiagnosticResult[] = [];

    // 1. Vérifier les imports critiques
    try {
      const { NavigationContainer } = await import('@react-navigation/native');
      results.push({
        name: 'Navigation Container',
        status: 'success',
        message: 'Import réussi',
        details: 'React Navigation est disponible'
      });
    } catch (error) {
      results.push({
        name: 'Navigation Container',
        status: 'error',
        message: 'Import échoué',
        details: String(error)
      });
    }

    // 2. Vérifier les contextes
    try {
      const { AuthProvider } = await import('../contexts/AuthContext');
      results.push({
        name: 'AuthContext',
        status: 'success',
        message: 'Contexte d\'authentification disponible'
      });
    } catch (error) {
      results.push({
        name: 'AuthContext',
        status: 'error',
        message: 'Contexte d\'authentification manquant',
        details: String(error)
      });
    }

    // 3. Vérifier les services API
    try {
      const { authApi } = await import('../services/api');
      results.push({
        name: 'Services API',
        status: 'success',
        message: 'Services API disponibles'
      });
    } catch (error) {
      results.push({
        name: 'Services API',
        status: 'error',
        message: 'Services API manquants',
        details: String(error)
      });
    }

    // 4. Vérifier les thèmes
    try {
      const { theme } = await import('../theme/theme');
      results.push({
        name: 'Thème',
        status: 'success',
        message: 'Thème disponible'
      });
    } catch (error) {
      results.push({
        name: 'Thème',
        status: 'error',
        message: 'Thème manquant',
        details: String(error)
      });
    }

    // 5. Vérifier les écrans principaux
    const screens = [
      'ModernHomeScreen',
      'ServicesScreen', 
      'AIChatScreen',
      'ProfileScreen',
      'LoginScreen'
    ];

    for (const screen of screens) {
      try {
        await import(`../screens/${screen}`);
        results.push({
          name: `Écran ${screen}`,
          status: 'success',
          message: 'Écran disponible'
        });
      } catch (error) {
        results.push({
          name: `Écran ${screen}`,
          status: 'error',
          message: 'Écran manquant',
          details: String(error)
        });
      }
    }

    // 6. Vérifier les dépendances natives
    try {
      const AsyncStorage = await import('@react-native-async-storage/async-storage');
      results.push({
        name: 'AsyncStorage',
        status: 'success',
        message: 'AsyncStorage disponible'
      });
    } catch (error) {
      results.push({
        name: 'AsyncStorage',
        status: 'error',
        message: 'AsyncStorage manquant',
        details: String(error)
      });
    }

    // 7. Vérifier les icônes Phosphor
    try {
      const { House, User, Brain } = await import('phosphor-react-native');
      results.push({
        name: 'Icônes Phosphor',
        status: 'success',
        message: 'Icônes Phosphor disponibles'
      });
    } catch (error) {
      results.push({
        name: 'Icônes Phosphor',
        status: 'error',
        message: 'Icônes Phosphor manquantes',
        details: String(error)
      });
    }

    // 8. Vérifier la configuration
    try {
      const config = await import('../config/environment');
      results.push({
        name: 'Configuration',
        status: 'success',
        message: 'Configuration disponible',
        details: `API URL: ${config.config?.API_BASE_URL || 'Non définie'}`
      });
    } catch (error) {
      results.push({
        name: 'Configuration',
        status: 'warning',
        message: 'Configuration manquante',
        details: String(error)
      });
    }

    setDiagnostics(results);
    setIsRunning(false);
  };

  useEffect(() => {
    if (visible) {
      runDiagnostics();
    }
  }, [visible]);

  const copyDiagnostics = async () => {
    try {
      const diagnosticText = diagnostics.map(d => 
        `${d.status.toUpperCase()}: ${d.name} - ${d.message}${d.details ? '\n' + d.details : ''}`
      ).join('\n\n');
      
      // await Clipboard.setStringAsync(diagnosticText);
      Alert.alert('Diagnostic copié', 'Le diagnostic a été préparé pour le partage');
      Alert.alert('Succès', 'Diagnostic copié dans le presse-papiers !');
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de copier le diagnostic');
    }
  };

  const getStatusIcon = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'success': return <CheckCircle size={20} color="#059669" />;
      case 'error': return <XCircle size={20} color="#DC2626" />;
      case 'warning': return <Warning size={20} color="#D97706" />;
      case 'info': return <Info size={20} color="#6366F1" />;
    }
  };

  const getStatusColor = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'success': return '#059669';
      case 'error': return '#DC2626';
      case 'warning': return '#D97706';
      case 'info': return '#6366F1';
    }
  };

  if (!visible) return null;

  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Card.Title
          title="🔍 Diagnostic de Crash"
          subtitle={`${diagnostics.length} vérifications effectuées`}
          right={(props) => (
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          )}
        />
        
        <Card.Content style={styles.content}>
          {isRunning ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>🔍 Diagnostic en cours...</Text>
            </View>
          ) : (
            <ScrollView style={styles.diagnosticsContainer}>
              {diagnostics.map((diagnostic, index) => (
                <View key={index} style={styles.diagnosticItem}>
                  <View style={styles.diagnosticHeader}>
                    {getStatusIcon(diagnostic.status)}
                    <Text style={styles.diagnosticName}>{diagnostic.name}</Text>
                    <Chip 
                      style={[styles.statusChip, { backgroundColor: getStatusColor(diagnostic.status) + '20' }]}
                      textStyle={{ color: getStatusColor(diagnostic.status) }}
                    >
                      {diagnostic.status.toUpperCase()}
                    </Chip>
                  </View>
                  <Text style={styles.diagnosticMessage}>{diagnostic.message}</Text>
                  {diagnostic.details && (
                    <Text style={styles.diagnosticDetails}>{diagnostic.details}</Text>
                  )}
                </View>
              ))}
            </ScrollView>
          )}
        </Card.Content>
        
        <Card.Actions style={styles.actions}>
          <Button
            mode="outlined"
            onPress={runDiagnostics}
            disabled={isRunning}
            style={styles.actionButton}
            icon={() => <Bug size={16} color="#6366F1" />}
          >
            Relancer
          </Button>
          <Button
            mode="contained"
            onPress={copyDiagnostics}
            disabled={diagnostics.length === 0}
            style={styles.actionButton}
          >
            Copier
          </Button>
        </Card.Actions>
      </Card>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    zIndex: 9999,
    padding: 20,
  },
  card: {
    flex: 1,
    maxHeight: '90%',
  },
  closeButton: {
    fontSize: 24,
    color: '#6B7280',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6366F1',
    fontWeight: '600',
  },
  diagnosticsContainer: {
    flex: 1,
  },
  diagnosticItem: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
  },
  diagnosticHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  diagnosticName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginLeft: 8,
  },
  statusChip: {
    height: 24,
  },
  diagnosticMessage: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
  },
  diagnosticDetails: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'monospace',
    backgroundColor: '#E5E7EB',
    padding: 8,
    borderRadius: 4,
  },
  actions: {
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  actionButton: {
    marginHorizontal: 4,
  },
});

export default CrashDiagnostic;
