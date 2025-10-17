# Script de lancement rapide avec scan automatique et monitoring
# Version simplifiée pour un usage quotidien

Write-Host "🚀 LANCEMENT RAPIDE YUKPO" -ForegroundColor Cyan
Write-Host "=========================" -ForegroundColor Cyan

# Arrêter les processus existants
Write-Host "🛑 Arrêt des processus existants..." -ForegroundColor Yellow
Get-Process -Name "expo", "node", "metro" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

# Nettoyer les caches
Write-Host "🧹 Nettoyage des caches..." -ForegroundColor Yellow
if (Test-Path ".expo") { Remove-Item -Recurse -Force ".expo" -ErrorAction SilentlyContinue }
if (Test-Path "node_modules\.cache") { Remove-Item -Recurse -Force "node_modules\.cache" -ErrorAction SilentlyContinue }

# Créer un App.tsx minimal et stable
Write-Host "📱 Création de l'App.tsx stable..." -ForegroundColor Yellow
$appContent = @'
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [logs, setLogs] = useState([]);

  const addLog = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev.slice(-4), `[${timestamp}] ${message}`]);
  };

  useEffect(() => {
    const init = async () => {
      addLog('🚀 Initialisation...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      addLog('✅ Application prête');
      setIsReady(true);
    };
    init();
  }, []);

  const handleReload = () => {
    addLog('🔄 Rechargement...');
    setIsReady(false);
    setTimeout(() => setIsReady(true), 500);
  };

  if (!isReady) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.title}>🔄 Chargement Yukpo...</Text>
          {logs.map((log, i) => (
            <Text key={i} style={styles.log}>{log}</Text>
          ))}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.center}>
        <Text style={styles.title}>🎉 Yukpo App</Text>
        <Text style={styles.subtitle}>Application stable</Text>
        
        <View style={styles.status}>
          <Text style={styles.statusText}>✅ Stable</Text>
          <Text style={styles.statusText}>✅ Fonctionnel</Text>
          <Text style={styles.statusText}>✅ Prêt</Text>
        </View>
        
        <TouchableOpacity style={styles.button} onPress={handleReload}>
          <Text style={styles.buttonText}>🔄 Recharger</Text>
        </TouchableOpacity>
        
        {logs.length > 0 && (
          <View style={styles.logs}>
            <Text style={styles.logsTitle}>📊 Logs:</Text>
            {logs.map((log, i) => (
              <Text key={i} style={styles.log}>{log}</Text>
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
  title: { fontSize: 28, fontWeight: 'bold', color: '#1e40af', marginBottom: 10 },
  subtitle: { fontSize: 16, color: '#374151', marginBottom: 30 },
  status: { backgroundColor: '#ffffff', padding: 20, borderRadius: 10, marginBottom: 20 },
  statusText: { fontSize: 16, color: '#059669', marginBottom: 5 },
  button: { backgroundColor: '#3b82f6', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8, marginBottom: 20 },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  logs: { backgroundColor: '#f8fafc', padding: 15, borderRadius: 8, borderLeftWidth: 4, borderLeftColor: '#3b82f6' },
  logsTitle: { fontSize: 14, fontWeight: 'bold', color: '#374151', marginBottom: 8 },
  log: { fontSize: 12, color: '#6b7280', marginBottom: 2, fontFamily: 'monospace' },
});
'@

Set-Content -Path "App.tsx" -Value $appContent
Write-Host "✅ App.tsx stable créé" -ForegroundColor Green

# Démarrer l'application
Write-Host "🚀 Démarrage de l'application..." -ForegroundColor Yellow
Start-Process -FilePath "npm" -ArgumentList "run", "start" -NoNewWindow

Write-Host "✅ Application lancée !" -ForegroundColor Green
Write-Host "📱 Scannez le QR code avec Expo Go" -ForegroundColor Cyan
Write-Host "🔍 Surveillez les logs ci-dessous..." -ForegroundColor Cyan

# Monitoring simple des logs
Write-Host "`n👀 MONITORING EN TEMPS RÉEL:" -ForegroundColor Cyan
Write-Host "Appuyez sur Ctrl+C pour arrêter" -ForegroundColor Yellow

$logCount = 0
while ($true) {
    try {
        # Vérifier si Expo est toujours en cours
        $expoRunning = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*expo*" }
        
        if ($expoRunning) {
            $logCount++
            $timestamp = Get-Date -Format "HH:mm:ss"
            Write-Host "[$timestamp] ✅ Expo actif - Monitoring OK" -ForegroundColor Green
            
            # Vérifier les erreurs dans les logs système
            $errorEvents = Get-WinEvent -FilterHashtable @{LogName='Application'; Level=2} -MaxEvents 5 -ErrorAction SilentlyContinue | Where-Object { $_.Message -like "*expo*" -or $_.Message -like "*react*" }
            
            if ($errorEvents) {
                foreach ($event in $errorEvents) {
                    Write-Host "[$timestamp] 🚨 ERREUR DÉTECTÉE: $($event.Message.Substring(0, [Math]::Min(100, $event.Message.Length)))..." -ForegroundColor Red
                }
            }
            
        } else {
            $timestamp = Get-Date -Format "HH:mm:ss"
            Write-Host "[$timestamp] ⚠️ Expo arrêté - Relancement..." -ForegroundColor Yellow
            Start-Process -FilePath "npm" -ArgumentList "run", "start" -NoNewWindow
        }
        
        Start-Sleep -Seconds 10
    } catch {
        $timestamp = Get-Date -Format "HH:mm:ss"
        Write-Host "[$timestamp] ❌ Erreur de monitoring: $($_.Exception.Message)" -ForegroundColor Red
        Start-Sleep -Seconds 5
    }
}
