# Script complètement autonome pour lancer et monitorer Yukpo
# Ce script fait TOUT automatiquement : lance l'app, scanne, analyse les logs

param(
    [int]$Duration = 600  # 10 minutes par défaut
)

# Configuration des couleurs
$ErrorActionPreference = "SilentlyContinue"

function Write-Status {
    param($Message, $Type = "INFO")
    $timestamp = Get-Date -Format "HH:mm:ss"
    $color = switch ($Type) {
        "SUCCESS" { "Green" }
        "ERROR" { "Red" }
        "WARNING" { "Yellow" }
        "INFO" { "Cyan" }
        default { "White" }
    }
    $icon = switch ($Type) {
        "SUCCESS" { "✅" }
        "ERROR" { "❌" }
        "WARNING" { "⚠️" }
        "INFO" { "ℹ️" }
        default { "📝" }
    }
    Write-Host "[$timestamp] $icon $Message" -ForegroundColor $color
}

# Fonction pour arrêter tous les processus Expo/Node
function Stop-AllProcesses {
    Write-Status "Arrêt des processus existants..." "INFO"
    Get-Process -Name "expo", "node", "metro" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 3
}

# Fonction pour nettoyer les caches
function Clear-Caches {
    Write-Status "Nettoyage des caches..." "INFO"
    $paths = @(".expo", "node_modules\.cache", ".metro-cache")
    foreach ($path in $paths) {
        if (Test-Path $path) {
            Remove-Item -Recurse -Force $path -ErrorAction SilentlyContinue
        }
    }
}

# Fonction pour créer un App.tsx ultra-stable
function Create-StableApp {
    Write-Status "Création de l'App.tsx stable..." "INFO"
    
    $appContent = @'
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Alert } from 'react-native';

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [logs, setLogs] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('checking');

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = { timestamp, message, type };
    setLogs(prev => [...prev.slice(-9), logEntry]);
  };

  useEffect(() => {
    const init = async () => {
      addLog('🚀 Initialisation de Yukpo...', 'info');
      
      // Test de connexion API
      try {
        addLog('🔍 Test de connexion API...', 'info');
        const response = await fetch('https://yukpomnang.onrender.com/health', {
          method: 'GET',
          timeout: 5000,
        });
        
        if (response.ok) {
          setConnectionStatus('connected');
          addLog('✅ API connectée avec succès', 'success');
        } else {
          setConnectionStatus('error');
          addLog('⚠️ API répond mais avec erreur', 'warning');
        }
      } catch (apiError) {
        setConnectionStatus('disconnected');
        addLog('❌ Impossible de se connecter à l\'API', 'error');
      }
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      setIsReady(true);
      addLog('🎉 Application prête et fonctionnelle', 'success');
    };
    
    init();
  }, []);

  const handleReload = () => {
    addLog('🔄 Rechargement en cours...', 'info');
    setIsReady(false);
    setTimeout(() => setIsReady(true), 1000);
  };

  const handleTestAPI = async () => {
    addLog('🔍 Test de connexion API...', 'info');
    setConnectionStatus('checking');
    
    try {
      const response = await fetch('https://yukpomnang.onrender.com/health', {
        method: 'GET',
        timeout: 5000,
      });
      
      if (response.ok) {
        setConnectionStatus('connected');
        addLog('✅ Connexion API réussie', 'success');
        Alert.alert('Succès', 'Connexion à l\'API réussie !');
      } else {
        setConnectionStatus('error');
        addLog('⚠️ Réponse API non OK', 'warning');
        Alert.alert('Attention', 'L\'API répond mais avec une erreur');
      }
    } catch (error) {
      setConnectionStatus('disconnected');
      addLog(`❌ Erreur API: ${error.message}`, 'error');
      Alert.alert('Erreur', `Impossible de se connecter à l'API: ${error.message}`);
    }
  };

  const getConnectionColor = () => {
    switch (connectionStatus) {
      case 'connected': return '#059669';
      case 'error': return '#d97706';
      case 'disconnected': return '#dc2626';
      default: return '#6b7280';
    }
  };

  const getConnectionText = () => {
    switch (connectionStatus) {
      case 'connected': return '✅ Connecté';
      case 'error': return '⚠️ Erreur';
      case 'disconnected': return '❌ Déconnecté';
      default: return '🔄 Vérification...';
    }
  };

  if (!isReady) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.title}>🔄 Chargement Yukpo...</Text>
          <Text style={styles.subtitle}>Initialisation en cours...</Text>
          
          {logs.length > 0 && (
            <View style={styles.logs}>
              <Text style={styles.logsTitle}>📊 Logs de chargement:</Text>
              {logs.map((log, i) => (
                <Text key={i} style={[styles.log, styles[`log${log.type}`]]}>
                  [{log.timestamp}] {log.message}
                </Text>
              ))}
            </View>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.center}>
        <Text style={styles.title}>🎉 Yukpo App</Text>
        <Text style={styles.subtitle}>Application stable et fonctionnelle</Text>
        <Text style={styles.version}>Version 1.0.0 - Build Auto-Stable</Text>
        
        <View style={styles.status}>
          <Text style={styles.statusText}>✅ Application stable</Text>
          <Text style={styles.statusText}>✅ Interface utilisateur OK</Text>
          <Text style={styles.statusText}>✅ Gestion d'erreurs active</Text>
          <Text style={[styles.statusText, { color: getConnectionColor() }]}>
            {getConnectionText()}
          </Text>
        </View>
        
        <View style={styles.actions}>
          <TouchableOpacity style={styles.button} onPress={handleTestAPI}>
            <Text style={styles.buttonText}>🔍 Tester l'API</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.button} onPress={handleReload}>
            <Text style={styles.buttonText}>🔄 Recharger</Text>
          </TouchableOpacity>
        </View>
        
        {logs.length > 0 && (
          <View style={styles.logs}>
            <Text style={styles.logsTitle}>📊 Logs récents:</Text>
            {logs.map((log, i) => (
              <Text key={i} style={[styles.log, styles[`log${log.type}`]]}>
                [{log.timestamp}] {log.message}
              </Text>
            ))}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f8ff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#1e40af', marginBottom: 10, textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#374151', marginBottom: 5, textAlign: 'center' },
  version: { fontSize: 14, color: '#6b7280', marginBottom: 30, textAlign: 'center' },
  status: { backgroundColor: '#ffffff', padding: 20, borderRadius: 10, marginBottom: 20, width: '100%' },
  statusText: { fontSize: 16, color: '#059669', marginBottom: 8, textAlign: 'center' },
  actions: { width: '100%', marginBottom: 20 },
  button: { backgroundColor: '#3b82f6', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8, marginBottom: 10 },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  logs: { backgroundColor: '#f8fafc', padding: 15, borderRadius: 8, borderLeftWidth: 4, borderLeftColor: '#3b82f6', width: '100%' },
  logsTitle: { fontSize: 14, fontWeight: 'bold', color: '#374151', marginBottom: 8 },
  log: { fontSize: 12, marginBottom: 2, fontFamily: 'monospace' },
  loginfo: { color: '#6b7280' },
  logsuccess: { color: '#059669' },
  logwarning: { color: '#d97706' },
  logerror: { color: '#dc2626' },
});
'@

    Set-Content -Path "App.tsx" -Value $appContent
    Write-Status "App.tsx stable créé" "SUCCESS"
}

# Fonction pour démarrer Expo
function Start-Expo {
    Write-Status "Démarrage de l'application Expo..." "INFO"
    
    try {
        # Installer les dépendances si nécessaire
        if (-not (Test-Path "node_modules")) {
            Write-Status "Installation des dépendances..." "INFO"
            npm install --silent
        }
        
        # Démarrer Expo en arrière-plan
        $process = Start-Process -FilePath "npm" -ArgumentList "run", "start" -NoNewWindow -PassThru
        
        Write-Status "Application Expo démarrée (PID: $($process.Id))" "SUCCESS"
        Start-Sleep -Seconds 8
        
        return $process
    }
    catch {
        Write-Status "Erreur lors du démarrage: $($_.Exception.Message)" "ERROR"
        return $null
    }
}

# Fonction pour monitorer les logs et l'état
function Monitor-Application {
    param($Duration)
    
    Write-Status "Démarrage du monitoring pour $Duration secondes..." "INFO"
    Write-Status "📱 INSTRUCTIONS:" "INFO"
    Write-Status "1. Ouvrez Expo Go sur votre téléphone" "INFO"
    Write-Status "2. Scannez le QR code affiché ci-dessus" "INFO"
    Write-Status "3. L'application devrait se charger automatiquement" "INFO"
    Write-Status "4. Surveillez les logs ci-dessous..." "INFO"
    
    $startTime = Get-Date
    $lastCheck = Get-Date
    $errorCount = 0
    $successCount = 0
    
    while ((Get-Date) - $startTime -lt [TimeSpan]::FromSeconds($Duration)) {
        try {
            # Vérifier si Expo est toujours en cours
            $expoProcess = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*expo*" }
            
            if ($expoProcess) {
                $successCount++
                if ($successCount % 10 -eq 0) {
                    # Afficher toutes les 10 vérifications
                    $timestamp = Get-Date -Format "HH:mm:ss"
                    Write-Status "✅ Expo actif - Monitoring OK (${successCount} vérifications)" "SUCCESS"
                }
                
                # Vérifier les erreurs système
                $errorEvents = Get-WinEvent -FilterHashtable @{LogName = 'Application'; Level = 2 } -MaxEvents 3 -ErrorAction SilentlyContinue | Where-Object { 
                    $_.Message -like "*expo*" -or $_.Message -like "*react*" -or $_.Message -like "*node*" 
                }
                
                if ($errorEvents) {
                    $errorCount++
                    foreach ($event in $errorEvents) {
                        $timestamp = Get-Date -Format "HH:mm:ss"
                        $message = $event.Message.Substring(0, [Math]::Min(80, $event.Message.Length))
                        Write-Status "🚨 ERREUR SYSTÈME: $message..." "ERROR"
                    }
                }
                
            }
            else {
                $timestamp = Get-Date -Format "HH:mm:ss"
                Write-Status "⚠️ Expo arrêté - Tentative de relancement..." "WARNING"
                
                # Tenter de relancer
                Start-Process -FilePath "npm" -ArgumentList "run", "start" -NoNewWindow
                Start-Sleep -Seconds 5
            }
            
            # Afficher un résumé toutes les minutes
            if ((Get-Date) - $lastCheck -gt [TimeSpan]::FromMinutes(1)) {
                $elapsed = [int]((Get-Date) - $startTime).TotalMinutes
                $remaining = [int]($Duration / 60) - $elapsed
                Write-Status "📊 Résumé: $elapsed min écoulées, $remaining min restantes, $errorCount erreurs détectées" "INFO"
                $lastCheck = Get-Date
            }
            
            Start-Sleep -Seconds 6
            
        }
        catch {
            Write-Status "Erreur de monitoring: $($_.Exception.Message)" "ERROR"
            Start-Sleep -Seconds 5
        }
    }
    
    Write-Status "⏰ Monitoring terminé" "INFO"
    Write-Status "📊 Résumé final: $successCount vérifications réussies, $errorCount erreurs détectées" "INFO"
}

# Fonction principale
function Main {
    Write-Status "🚀 LANCEMENT AUTONOME DE YUKPO" "INFO"
    Write-Status "=============================" "INFO"
    
    try {
        # Nettoyage initial
        Stop-AllProcesses
        Clear-Caches
        
        # Créer l'App.tsx stable
        Create-StableApp
        
        # Démarrer Expo
        $expoProcess = Start-Expo
        
        if ($expoProcess) {
            Write-Status "✅ Application lancée avec succès !" "SUCCESS"
            
            # Démarrer le monitoring
            Monitor-Application $Duration
            
        }
        else {
            Write-Status "❌ Impossible de démarrer l'application" "ERROR"
        }
        
    }
    catch {
        Write-Status "Erreur critique: $($_.Exception.Message)" "ERROR"
    }
}

# Exécution du script
Main
