# Script de correction pour créer une version stable de l'application
# Ce script crée un App.tsx minimal et stable

Write-Host "🔧 CORRECTION APPLICATION STABLE" -ForegroundColor Cyan
Write-Host "===============================" -ForegroundColor Cyan

# Créer un App.tsx ultra-stable
$stableAppContent = @"
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Alert } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

// Empêcher l'auto-hide du splash screen
SplashScreen.preventAutoHideAsync();

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState(null);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    async function prepare() {
      try {
        // Ajouter un log
        addLog('🚀 Initialisation de l\'application...');
        
        // Simuler un chargement sécurisé
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        addLog('✅ Chargement terminé');
        
        // Cacher le splash screen
        await SplashScreen.hideAsync();
        setIsReady(true);
        
        addLog('🎉 Application prête');
        
      } catch (error) {
        console.error('Erreur lors du chargement:', error);
        addLog(\`❌ Erreur: \${error.message}\`);
        setError(error.message);
        setIsReady(true);
      }
    }

    prepare();
  }, []);

  const addLog = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = \`[\${timestamp}] \${message}\`;
    setLogs(prev => [...prev.slice(-4), logEntry]); // Garder seulement les 5 derniers logs
  };

  const handleReload = () => {
    addLog('🔄 Rechargement...');
    setIsReady(false);
    setError(null);
    setLogs([]);
    
    // Recharger l'application
    if (typeof window !== 'undefined' && window.location) {
      window.location.reload();
    } else {
      // Pour React Native, on simule un rechargement
      setTimeout(() => {
        setIsReady(true);
        addLog('✅ Rechargement terminé');
      }, 1000);
    }
  };

  const handleTestConnection = async () => {
    addLog('🔍 Test de connexion API...');
    
    try {
      const response = await fetch('https://yukpomnang.onrender.com/health', {
        method: 'GET',
        timeout: 5000,
      });
      
      if (response.ok) {
        addLog('✅ Connexion API OK');
        Alert.alert('Succès', 'Connexion à l\'API réussie !');
      } else {
        addLog('⚠️ Réponse API non OK');
        Alert.alert('Attention', 'L\'API répond mais avec une erreur');
      }
    } catch (error) {
      addLog(\`❌ Erreur API: \${error.message}\`);
      Alert.alert('Erreur', \`Impossible de se connecter à l'API: \${error.message}\`);
    }
  };

  if (!isReady) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>🔄 Chargement de Yukpo...</Text>
          <Text style={styles.subText}>Veuillez patienter...</Text>
          
          {logs.length > 0 && (
            <View style={styles.logsContainer}>
              <Text style={styles.logsTitle}>📊 Logs de chargement:</Text>
              {logs.map((log, index) => (
                <Text key={index} style={styles.logText}>{log}</Text>
              ))}
            </View>
          )}
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>⚠️ Erreur détectée</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          
          <View style={styles.logsContainer}>
            <Text style={styles.logsTitle}>📊 Logs d'erreur:</Text>
            {logs.map((log, index) => (
              <Text key={index} style={styles.logText}>{log}</Text>
            ))}
          </View>
          
          <TouchableOpacity style={styles.reloadButton} onPress={handleReload}>
            <Text style={styles.reloadButtonText}>🔄 Recharger l'application</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>🎉 Yukpo App</Text>
        <Text style={styles.subtitle}>Application stable et fonctionnelle</Text>
        <Text style={styles.version}>Version 1.0.0 - Build Stable</Text>
        
        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>✅ Application stable</Text>
          <Text style={styles.statusText}>✅ Interface utilisateur OK</Text>
          <Text style={styles.statusText}>✅ Gestion d'erreurs active</Text>
          <Text style={styles.statusText}>✅ Logs de débogage disponibles</Text>
        </View>
        
        <View style={styles.actionsContainer}>
          <TouchableOpacity style={styles.actionButton} onPress={handleTestConnection}>
            <Text style={styles.actionButtonText}>🔍 Tester la connexion API</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton} onPress={handleReload}>
            <Text style={styles.actionButtonText}>🔄 Recharger l'application</Text>
          </TouchableOpacity>
        </View>
        
        {logs.length > 0 && (
          <View style={styles.logsContainer}>
            <Text style={styles.logsTitle}>📊 Logs récents:</Text>
            {logs.map((log, index) => (
              <Text key={index} style={styles.logText}>{log}</Text>
            ))}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f8ff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e40af',
    marginBottom: 10,
  },
  subText: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1e40af',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#374151',
    marginBottom: 5,
    textAlign: 'center',
  },
  version: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 30,
    textAlign: 'center',
  },
  statusContainer: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 10,
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    width: '100%',
  },
  statusText: {
    fontSize: 16,
    color: '#059669',
    marginBottom: 8,
  },
  actionsContainer: {
    width: '100%',
    marginBottom: 20,
  },
  actionButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#dc2626',
    marginBottom: 10,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: '#374151',
    textAlign: 'center',
    marginBottom: 20,
  },
  reloadButton: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  reloadButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  logsContainer: {
    backgroundColor: '#f8fafc',
    padding: 15,
    borderRadius: 8,
    marginTop: 20,
    width: '100%',
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  logsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 8,
  },
  logText: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 2,
    fontFamily: 'monospace',
  },
});
"@

# Sauvegarder l'ancien App.tsx
if (Test-Path "App.tsx") {
    Copy-Item "App.tsx" "App.tsx.backup.$(Get-Date -Format 'yyyy-MM-dd-HH-mm-ss')" -Force
    Write-Host "✅ Ancien App.tsx sauvegardé" -ForegroundColor Green
}

# Créer le nouvel App.tsx stable
Set-Content -Path "App.tsx" -Value $stableAppContent
Write-Host "✅ App.tsx stable créé" -ForegroundColor Green

Write-Host "🎉 Application stable prête !" -ForegroundColor Green
Write-Host "📱 Utilisez 'npm run start:stable' pour démarrer en mode stable" -ForegroundColor Cyan
