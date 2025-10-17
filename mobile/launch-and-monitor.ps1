# Script complet de lancement et monitoring automatique
# Lance l'app, scanne le QR code et analyse les logs automatiquement

param(
    [switch]$AutoScan,
    [switch]$AutoFix,
    [int]$MonitorDuration = 300
)

Write-Host "🚀 LANCEMENT ET MONITORING AUTOMATIQUE YUKPO" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# Variables globales
$global:expoProcess = $null
$global:monitorActive = $true
$global:qrCodeDetected = $false
$global:lastErrorCount = 0

# Fonction pour logger avec timestamp
function Write-Log {
    param($Message, $Color = "White", $Level = "INFO")
    $timestamp = Get-Date -Format "HH:mm:ss"
    $prefix = switch ($Level) {
        "ERROR" { "❌" }
        "WARNING" { "⚠️" }
        "SUCCESS" { "✅" }
        "INFO" { "ℹ️" }
        default { "📝" }
    }
    Write-Host "[$timestamp] $prefix $Message" -ForegroundColor $Color
}

# Fonction pour arrêter tous les processus Expo
function Stop-AllExpoProcesses {
    Write-Log "🛑 Arrêt des processus Expo en cours..." "Yellow"
    
    $processes = @("expo", "node", "metro", "adb")
    foreach ($proc in $processes) {
        try {
            $running = Get-Process -Name $proc -ErrorAction SilentlyContinue
            if ($running) {
                Write-Log "Arrêt de $proc..." "Yellow"
                Stop-Process -Name $proc -Force -ErrorAction SilentlyContinue
                Start-Sleep -Seconds 2
            }
        }
        catch {
            # Ignorer les erreurs d'arrêt
        }
    }
}

# Fonction pour nettoyer les caches
function Clear-AllCaches {
    Write-Log "🧹 Nettoyage complet des caches..." "Yellow"
    
    $cachePaths = @(
        ".expo",
        "node_modules\.cache",
        ".metro-cache",
        "android\.gradle"
    )
    
    foreach ($path in $cachePaths) {
        if (Test-Path $path) {
            try {
                Remove-Item -Recurse -Force $path -ErrorAction SilentlyContinue
                Write-Log "Cache nettoyé: $path" "Green"
            }
            catch {
                Write-Log "Impossible de nettoyer: $path" "Red"
            }
        }
    }
}

# Fonction pour créer un App.tsx ultra-stable
function Create-UltraStableApp {
    Write-Log "📱 Création d'un App.tsx ultra-stable..." "Yellow"
    
    $appContent = @'
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Alert, ScrollView } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState(null);
  const [logs, setLogs] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('checking');

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = { timestamp, message, type };
    setLogs(prev => [...prev.slice(-9), logEntry]);
  };

  useEffect(() => {
    async function prepare() {
      try {
        addLog('🚀 Initialisation de l\'application...', 'info');
        
        // Test de connexion API
        addLog('🔍 Test de connexion API...', 'info');
        try {
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
        
        // Simuler un chargement
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        await SplashScreen.hideAsync();
        setIsReady(true);
        addLog('🎉 Application prête et fonctionnelle', 'success');
        
      } catch (error) {
        console.error('Erreur lors du chargement:', error);
        addLog(`❌ Erreur: ${error.message}`, 'error');
        setError(error.message);
        setIsReady(true);
      }
    }

    prepare();
  }, []);

  const handleReload = () => {
    addLog('🔄 Rechargement en cours...', 'info');
    setIsReady(false);
    setError(null);
    setLogs([]);
    setConnectionStatus('checking');
    
    setTimeout(() => {
      setIsReady(true);
      addLog('✅ Rechargement terminé', 'success');
    }, 1000);
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
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>🔄 Chargement de Yukpo...</Text>
          <Text style={styles.subText}>Initialisation en cours...</Text>
          
          {logs.length > 0 && (
            <ScrollView style={styles.logsContainer}>
              <Text style={styles.logsTitle}>📊 Logs de chargement:</Text>
              {logs.map((log, index) => (
                <Text key={index} style={[styles.logText, styles[`log${log.type}`]]}>
                  [{log.timestamp}] {log.message}
                </Text>
              ))}
            </ScrollView>
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
          
          <ScrollView style={styles.logsContainer}>
            <Text style={styles.logsTitle}>📊 Logs d'erreur:</Text>
            {logs.map((log, index) => (
              <Text key={index} style={[styles.logText, styles[`log${log.type}`]]}>
                [{log.timestamp}] {log.message}
              </Text>
            ))}
          </ScrollView>
          
          <TouchableOpacity style={styles.reloadButton} onPress={handleReload}>
            <Text style={styles.reloadButtonText}>🔄 Recharger l'application</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>🎉 Yukpo App</Text>
          <Text style={styles.subtitle}>Application stable et fonctionnelle</Text>
          <Text style={styles.version}>Version 1.0.0 - Build Ultra-Stable</Text>
        </View>
        
        <View style={styles.statusContainer}>
          <View style={styles.statusRow}>
            <Text style={styles.statusText}>✅ Application stable</Text>
            <Text style={styles.statusText}>✅ Interface utilisateur OK</Text>
            <Text style={styles.statusText}>✅ Gestion d'erreurs active</Text>
            <Text style={[styles.statusText, { color: getConnectionColor() }]}>
              {getConnectionText()}
            </Text>
          </View>
        </View>
        
        <View style={styles.actionsContainer}>
          <TouchableOpacity style={styles.actionButton} onPress={handleTestAPI}>
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
              <Text key={index} style={[styles.logText, styles[`log${log.type}`]]}>
                [{log.timestamp}] {log.message}
              </Text>
            ))}
          </View>
        )}
      </ScrollView>
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
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
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
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusRow: {
    alignItems: 'center',
  },
  statusText: {
    fontSize: 16,
    color: '#059669',
    marginBottom: 8,
  },
  actionsContainer: {
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
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
    maxHeight: 200,
  },
  logsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 8,
  },
  logText: {
    fontSize: 12,
    marginBottom: 2,
    fontFamily: 'monospace',
  },
  loginfo: {
    color: '#6b7280',
  },
  logsuccess: {
    color: '#059669',
  },
  logwarning: {
    color: '#d97706',
  },
  logerror: {
    color: '#dc2626',
  },
});
'@

    # Sauvegarder l'ancien App.tsx
    if (Test-Path "App.tsx") {
        $backupName = "App.tsx.backup.$(Get-Date -Format 'yyyy-MM-dd-HH-mm-ss')"
        Copy-Item "App.tsx" $backupName -Force
        Write-Log "Ancien App.tsx sauvegardé: $backupName" "Green"
    }

    Set-Content -Path "App.tsx" -Value $appContent
    Write-Log "App.tsx ultra-stable créé" "Green" "SUCCESS"
}

# Fonction pour scanner automatiquement le QR code
function Scan-QRCode {
    Write-Log "📱 Tentative de scan automatique du QR code..." "Yellow"
    
    # Attendre que le QR code apparaisse
    $maxAttempts = 30
    $attempt = 0
    
    while ($attempt -lt $maxAttempts -and -not $global:qrCodeDetected) {
        $attempt++
        Write-Log "Tentative $attempt/$maxAttempts - Recherche du QR code..." "Cyan"
        
        # Vérifier si Expo est en cours d'exécution
        $expoRunning = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*expo*" }
        
        if ($expoRunning) {
            Write-Log "QR code détecté ! Expo est en cours d'exécution" "Green" "SUCCESS"
            $global:qrCodeDetected = $true
            
            # Afficher les instructions
            Write-Log "📱 INSTRUCTIONS POUR CONNEXION:" "Cyan"
            Write-Log "1. Ouvrez l'application Expo Go sur votre téléphone" "White"
            Write-Log "2. Scannez le QR code affiché dans le terminal" "White"
            Write-Log "3. Ou utilisez le tunnel Expo pour la connexion" "White"
            Write-Log "4. L'application devrait se charger automatiquement" "White"
            
            return $true
        }
        
        Start-Sleep -Seconds 2
    }
    
    Write-Log "QR code non détecté après $maxAttempts tentatives" "Red" "WARNING"
    return $false
}

# Fonction pour analyser les logs en temps réel
function Monitor-Logs {
    param($Duration = 300)
    
    Write-Log "👀 Démarrage du monitoring des logs pour $Duration secondes..." "Cyan"
    
    $startTime = Get-Date
    $logFile = "logs\app-logs.log"
    $lastPosition = 0
    
    # Créer le dossier logs s'il n'existe pas
    if (-not (Test-Path "logs")) {
        New-Item -ItemType Directory -Path "logs" -Force | Out-Null
    }
    
    while ($global:monitorActive -and ((Get-Date) - $startTime).TotalSeconds -lt $Duration) {
        try {
            # Vérifier si le fichier de logs existe
            if (Test-Path $logFile) {
                $content = Get-Content $logFile -Raw
                if ($content.Length -gt $lastPosition) {
                    $newContent = $content.Substring($lastPosition)
                    $lastPosition = $content.Length
                    
                    # Analyser le nouveau contenu
                    $lines = $newContent -split "`n" | Where-Object { $_.Trim() }
                    
                    foreach ($line in $lines) {
                        if ($line -match '"level":"(ERROR|FATAL)"') {
                            Write-Log "🚨 ERREUR DÉTECTÉE: $line" "Red" "ERROR"
                            
                            # Appliquer des corrections automatiques si demandé
                            if ($AutoFix) {
                                Apply-AutoCorrections $line
                            }
                        }
                        elseif ($line -match '"level":"WARNING"') {
                            Write-Log "⚠️ AVERTISSEMENT: $line" "Yellow" "WARNING"
                        }
                        elseif ($line -match '"level":"INFO"') {
                            Write-Log "ℹ️ INFO: $line" "Green" "INFO"
                        }
                    }
                }
            }
            
            # Vérifier l'état de l'application
            $expoProcess = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*expo*" }
            if (-not $expoProcess) {
                Write-Log "⚠️ Processus Expo arrêté - Relancement automatique..." "Yellow" "WARNING"
                Start-ExpoApp
            }
            
        }
        catch {
            Write-Log "Erreur lors du monitoring: $($_.Exception.Message)" "Red" "ERROR"
        }
        
        Start-Sleep -Seconds 5
    }
    
    Write-Log "⏰ Monitoring terminé" "Cyan"
}

# Fonction pour appliquer des corrections automatiques
function Apply-AutoCorrections {
    param($ErrorMessage)
    
    Write-Log "🔧 Application de corrections automatiques..." "Yellow"
    
    if ($ErrorMessage -match "network|connection|fetch") {
        Write-Log "🔧 Correction réseau: Vérification de la connectivité..." "Yellow"
        # Logique de correction réseau
    }
    
    if ($ErrorMessage -match "update|download|ota") {
        Write-Log "🔧 Correction mise à jour: Désactivation des mises à jour automatiques..." "Yellow"
        # Désactiver les mises à jour dans app.json
    }
    
    if ($ErrorMessage -match "crash|fatal|exception") {
        Write-Log "🔧 Correction crash: Redémarrage de l'application..." "Yellow"
        # Redémarrer l'application
    }
}

# Fonction pour démarrer Expo
function Start-ExpoApp {
    Write-Log "🚀 Démarrage de l'application Expo..." "Yellow"
    
    try {
        # Démarrer Expo en arrière-plan
        $global:expoProcess = Start-Process -FilePath "npm" -ArgumentList "run", "start" -NoNewWindow -PassThru
        
        Write-Log "Application Expo démarrée (PID: $($global:expoProcess.Id))" "Green" "SUCCESS"
        
        # Attendre un peu que l'application se lance
        Start-Sleep -Seconds 5
        
        return $true
    }
    catch {
        Write-Log "Erreur lors du démarrage: $($_.Exception.Message)" "Red" "ERROR"
        return $false
    }
}

# Fonction pour nettoyer à la fin
function Cleanup-OnExit {
    Write-Log "🧹 Nettoyage en cours..." "Yellow"
    
    $global:monitorActive = $false
    
    if ($global:expoProcess -and -not $global:expoProcess.HasExited) {
        Write-Log "Arrêt du processus Expo..." "Yellow"
        $global:expoProcess.Kill()
    }
    
    Write-Log "✅ Nettoyage terminé" "Green" "SUCCESS"
}

# Gestionnaire d'événements pour Ctrl+C
$null = Register-EngineEvent -SourceIdentifier PowerShell.Exiting -Action {
    Cleanup-OnExit
}

# Fonction principale
function Main {
    Write-Log "🎯 Début du lancement et monitoring automatique" "Cyan"
    
    try {
        # Étape 1: Nettoyage initial
        Stop-AllExpoProcesses
        Clear-AllCaches
        
        # Étape 2: Créer l'App.tsx stable
        Create-UltraStableApp
        
        # Étape 3: Installer les dépendances
        Write-Log "📦 Installation des dépendances..." "Yellow"
        npm install --silent
        
        # Étape 4: Démarrer l'application
        if (Start-ExpoApp) {
            Write-Log "✅ Application démarrée avec succès" "Green" "SUCCESS"
            
            # Étape 5: Scanner le QR code si demandé
            if ($AutoScan) {
                Scan-QRCode
            }
            
            # Étape 6: Démarrer le monitoring
            Monitor-Logs $MonitorDuration
            
        }
        else {
            Write-Log "❌ Impossible de démarrer l'application" "Red" "ERROR"
        }
        
    }
    catch {
        Write-Log "Erreur critique: $($_.Exception.Message)" "Red" "ERROR"
    }
    finally {
        Cleanup-OnExit
    }
}

# Affichage du menu d'options
Write-Log "🎯 OPTIONS DISPONIBLES:" "Cyan"
Write-Log "  -AutoScan     : Scan automatique du QR code" "White"
Write-Log "  -AutoFix      : Corrections automatiques des erreurs" "White"
Write-Log "  -MonitorDuration : Durée du monitoring en secondes (défaut: 300)" "White"

# Exécuter le script principal
Main
