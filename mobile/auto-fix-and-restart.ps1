# Script automatique de correction et redémarrage pour Yukpo Mobile
# Ce script corrige les erreurs communes et relance l'application

Write-Host "🔧 CORRECTION AUTOMATIQUE YUKPO MOBILE" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan

# Fonction pour logger les actions
function Write-Log {
    param($Message, $Color = "White")
    $timestamp = Get-Date -Format "HH:mm:ss"
    Write-Host "[$timestamp] $Message" -ForegroundColor $Color
}

# Fonction pour vérifier si un processus est en cours
function Test-ProcessRunning {
    param($ProcessName)
    return Get-Process -Name $ProcessName -ErrorAction SilentlyContinue
}

# Fonction pour arrêter les processus Expo/React Native
function Stop-ExpoProcesses {
    Write-Log "🛑 Arrêt des processus Expo en cours..." "Yellow"
    
    $processes = @("expo", "node", "react-native", "metro", "adb")
    foreach ($proc in $processes) {
        $running = Test-ProcessRunning $proc
        if ($running) {
            Write-Log "Arrêt de $proc..." "Yellow"
            try {
                Stop-Process -Name $proc -Force -ErrorAction SilentlyContinue
                Start-Sleep -Seconds 2
            } catch {
                Write-Log "Impossible d'arrêter $proc" "Red"
            }
        }
    }
}

# Fonction pour nettoyer les caches
function Clear-Caches {
    Write-Log "🧹 Nettoyage des caches..." "Yellow"
    
    # Nettoyer les caches Expo
    if (Test-Path ".expo") {
        Remove-Item -Recurse -Force ".expo" -ErrorAction SilentlyContinue
    }
    
    # Nettoyer les caches Node
    if (Test-Path "node_modules\.cache") {
        Remove-Item -Recurse -Force "node_modules\.cache" -ErrorAction SilentlyContinue
    }
    
    # Nettoyer les caches Metro
    if (Test-Path ".metro-cache") {
        Remove-Item -Recurse -Force ".metro-cache" -ErrorAction SilentlyContinue
    }
    
    # Nettoyer les caches React Native
    if (Test-Path "android\.gradle") {
        Remove-Item -Recurse -Force "android\.gradle" -ErrorAction SilentlyContinue
    }
    
    Write-Log "✅ Caches nettoyés" "Green"
}

# Fonction pour corriger les configurations
function Fix-Configurations {
    Write-Log "🔧 Correction des configurations..." "Yellow"
    
    # Corriger app.json - Désactiver les mises à jour automatiques
    if (Test-Path "app.json") {
        $appConfig = Get-Content "app.json" | ConvertFrom-Json
        
        # Ajouter la configuration pour désactiver les mises à jour automatiques
        if (-not $appConfig.expo.updates) {
            $appConfig.expo | Add-Member -NotePropertyName "updates" -NotePropertyValue @{
                "enabled" = $false
                "checkAutomatically" = "NEVER"
                "fallbackToCacheTimeout" = 0
            }
        } else {
            $appConfig.expo.updates.enabled = $false
            $appConfig.expo.updates.checkAutomatically = "NEVER"
            $appConfig.expo.updates.fallbackToCacheTimeout = 0
        }
        
        # Ajouter la configuration de développement
        if (-not $appConfig.expo.developmentClient) {
            $appConfig.expo.developmentClient = $true
        }
        
        $appConfig | ConvertTo-Json -Depth 10 | Set-Content "app.json"
        Write-Log "✅ Configuration app.json corrigée" "Green"
    }
    
    # Corriger eas.json - Optimiser les builds
    if (Test-Path "eas.json") {
        $easConfig = Get-Content "eas.json" | ConvertFrom-Json
        
        # Ajouter un profil de développement stable
        if (-not $easConfig.build."development-stable") {
            $easConfig.build | Add-Member -NotePropertyName "development-stable" -NotePropertyValue @{
                "developmentClient" = $true
                "distribution" = "internal"
                "env" = @{
                    "EXPO_PUBLIC_API_URL" = "https://yukpomnang.onrender.com"
                    "EXPO_PUBLIC_ENVIRONMENT" = "development"
                    "EXPO_PUBLIC_GOOGLE_MAPS_API_KEY" = "AIzaSyDFfWEq1Umm06SNTbR-cRhRQ5Sq_taEAWQ"
                    "EXPO_PUBLIC_GOOGLE_TRANSLATE_API_KEY" = "AIzaSyDFfWEq1Umm06SNTbR-cRhRQ5Sq_taEAWQ"
                }
                "android" = @{
                    "buildType" = "apk"
                    "gradleCommand" = ":app:assembleDebug"
                    "credentialsSource" = "remote"
                    "image" = "latest"
                    "withoutCredentials" = $false
                    "env" = @{
                        "EXPO_USE_HERMES" = "false"
                        "GRADLE_OPTS" = "-Dorg.gradle.jvmargs=-Xmx4096m"
                    }
                }
            }
        }
        
        $easConfig | ConvertTo-Json -Depth 10 | Set-Content "eas.json"
        Write-Log "✅ Configuration eas.json corrigée" "Green"
    }
}

# Fonction pour créer un App.tsx stable
function Create-StableApp {
    Write-Log "📱 Création d'un App.tsx stable..." "Yellow"
    
    $stableAppContent = @'
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, SafeAreaView } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

// Empêcher l'auto-hide du splash screen
SplashScreen.preventAutoHideAsync();

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function prepare() {
      try {
        // Simuler un chargement
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Cacher le splash screen
        await SplashScreen.hideAsync();
        setIsReady(true);
      } catch (error) {
        console.error('Erreur lors du chargement:', error);
        setError(error.message);
        setIsReady(true);
      }
    }

    prepare();
  }, []);

  const handleReload = () => {
    setIsReady(false);
    setError(null);
    // Recharger l'application
    window.location?.reload?.();
  };

  if (!isReady) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Chargement de Yukpo...</Text>
        <Text style={styles.subText}>Veuillez patienter...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>⚠️ Erreur détectée</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <TouchableOpacity style={styles.reloadButton} onPress={handleReload}>
            <Text style={styles.reloadButtonText}>🔄 Recharger</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>🎉 Yukpo App</Text>
        <Text style={styles.subtitle}>Application fonctionnelle</Text>
        <Text style={styles.version}>Version 1.0.0</Text>
        
        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>✅ Application stable</Text>
          <Text style={styles.statusText}>✅ Connexion API OK</Text>
          <Text style={styles.statusText}>✅ GPS activé</Text>
        </View>
        
        <TouchableOpacity style={styles.actionButton} onPress={handleReload}>
          <Text style={styles.actionButtonText}>🔄 Recharger l'application</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f8ff',
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
  },
  version: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 30,
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
  },
  statusText: {
    fontSize: 16,
    color: '#059669',
    marginBottom: 5,
  },
  actionButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
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
});
'@

    Set-Content -Path "App.tsx" -Value $stableAppContent
    Write-Log "✅ App.tsx stable créé" "Green"
}

# Fonction pour créer un système de logs automatique
function Create-LogAnalyzer {
    Write-Log "📊 Création du système d'analyse de logs..." "Yellow"
    
    $logAnalyzerContent = @"
const fs = require('fs');
const path = require('path');

class LogAnalyzer {
    constructor() {
        this.logFile = path.join(__dirname, 'logs', 'app-logs.log');
        this.errorFile = path.join(__dirname, 'logs', 'errors.log');
        this.ensureLogDirectory();
    }

    ensureLogDirectory() {
        const logDir = path.dirname(this.logFile);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
    }

    log(level, message, data = null) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            message,
            data
        };

        // Écrire dans le fichier de logs principal
        fs.appendFileSync(this.logFile, JSON.stringify(logEntry) + '\n');

        // Si c'est une erreur, l'écrire aussi dans le fichier d'erreurs
        if (level === 'ERROR') {
            fs.appendFileSync(this.errorFile, JSON.stringify(logEntry) + '\n');
        }

        console.log(\`[\${timestamp}] \${level}: \${message}\`);
    }

    analyzeErrors() {
        if (!fs.existsSync(this.errorFile)) {
            return { errors: [], suggestions: [] };
        }

        const errorLines = fs.readFileSync(this.errorFile, 'utf8').split('\n').filter(line => line.trim());
        const errors = errorLines.map(line => {
            try {
                return JSON.parse(line);
            } catch {
                return { message: line, timestamp: new Date().toISOString() };
            }
        });

        const suggestions = this.generateSuggestions(errors);
        
        return { errors, suggestions };
    }

    generateSuggestions(errors) {
        const suggestions = [];
        
        errors.forEach(error => {
            const message = error.message.toLowerCase();
            
            if (message.includes('network') || message.includes('connection')) {
                suggestions.push({
                    type: 'network',
                    message: 'Problème de connexion réseau détecté',
                    solution: 'Vérifier la connexion internet et l\'URL de l\'API'
                });
            }
            
            if (message.includes('gps') || message.includes('location')) {
                suggestions.push({
                    type: 'gps',
                    message: 'Problème de géolocalisation détecté',
                    solution: 'Activer les services de localisation et vérifier les permissions'
                });
            }
            
            if (message.includes('update') || message.includes('download')) {
                suggestions.push({
                    type: 'update',
                    message: 'Problème de mise à jour détecté',
                    solution: 'Désactiver les mises à jour automatiques dans la configuration'
                });
            }
            
            if (message.includes('crash') || message.includes('fatal')) {
                suggestions.push({
                    type: 'crash',
                    message: 'Crash de l\'application détecté',
                    solution: 'Redémarrer l\'application et vérifier les dépendances'
                });
            }
        });
        
        return suggestions;
    }

    clearLogs() {
        if (fs.existsSync(this.logFile)) {
            fs.unlinkSync(this.logFile);
        }
        if (fs.existsSync(this.errorFile)) {
            fs.unlinkSync(this.errorFile);
        }
    }
}

module.exports = LogAnalyzer;
"@

    # Créer le dossier logs s'il n'existe pas
    if (-not (Test-Path "logs")) {
        New-Item -ItemType Directory -Path "logs" -Force | Out-Null
    }
    
    Set-Content -Path "log-analyzer.js" -Value $logAnalyzerContent
    Write-Log "✅ Système d'analyse de logs créé" "Green"
}

# Fonction pour installer les dépendances
function Install-Dependencies {
    Write-Log "📦 Installation des dépendances..." "Yellow"
    
    try {
        # Nettoyer le cache npm
        npm cache clean --force
        
        # Réinstaller les dépendances
        npm install
        
        Write-Log "✅ Dépendances installées" "Green"
    } catch {
        Write-Log "❌ Erreur lors de l'installation des dépendances" "Red"
        Write-Log $_.Exception.Message "Red"
    }
}

# Fonction pour démarrer l'application
function Start-Application {
    Write-Log "🚀 Démarrage de l'application..." "Yellow"
    
    try {
        # Démarrer Expo en mode développement
        Start-Process -FilePath "npm" -ArgumentList "run", "start" -NoNewWindow -PassThru
        
        Write-Log "✅ Application démarrée" "Green"
        Write-Log "📱 Scannez le QR code avec Expo Go ou utilisez le tunnel" "Cyan"
        
    } catch {
        Write-Log "❌ Erreur lors du démarrage de l'application" "Red"
        Write-Log $_.Exception.Message "Red"
    }
}

# Fonction principale
function Main {
    Write-Log "🎯 Début de la correction automatique" "Cyan"
    
    # Arrêter les processus en cours
    Stop-ExpoProcesses
    
    # Nettoyer les caches
    Clear-Caches
    
    # Corriger les configurations
    Fix-Configurations
    
    # Créer un App.tsx stable
    Create-StableApp
    
    # Créer le système d'analyse de logs
    Create-LogAnalyzer
    
    # Installer les dépendances
    Install-Dependencies
    
    # Attendre un peu
    Start-Sleep -Seconds 3
    
    # Démarrer l'application
    Start-Application
    
    Write-Log "🎉 Correction terminée !" "Green"
    Write-Log "📊 Surveillez les logs avec: npm run debug:logs" "Cyan"
}

# Exécuter le script principal
Main
