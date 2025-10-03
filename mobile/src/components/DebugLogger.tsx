import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import { Copy, Share as ShareIcon, Trash } from 'phosphor-react-native';
import React, { useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Button, Card, IconButton } from 'react-native-paper';

interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  message: string;
  data?: any;
}

interface DebugLoggerProps {
  visible: boolean;
  onClose: () => void;
}

const DebugLogger: React.FC<DebugLoggerProps> = ({ visible, onClose }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);

  // Intercepter console.log, console.warn, console.error
  useEffect(() => {
    if (!visible) return;

    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    const addLog = (level: LogEntry['level'], ...args: any[]) => {
      const message = args.map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');

      const newLog: LogEntry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        data: args.length > 1 ? args : undefined
      };

      setLogs(prev => {
        const updated = [...prev, newLog].slice(-1000); // Garder seulement les 1000 derniers logs
        return updated;
      });
    };

    console.log = (...args) => {
      originalLog(...args);
      addLog('INFO', ...args);
    };

    console.warn = (...args) => {
      originalWarn(...args);
      addLog('WARN', ...args);
    };

    console.error = (...args) => {
      originalError(...args);
      addLog('ERROR', ...args);
    };

    // Log de démarrage
    addLog('INFO', '🚀 DebugLogger initialisé');
    addLog('INFO', '📱 Application Yukpomnang démarrée');
    addLog('INFO', `⏰ Timestamp: ${new Date().toISOString()}`);

    return () => {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
    };
  }, [visible]);

  const copyAllLogs = async () => {
    try {
      // Générer un rapport complet avec métadonnées système
      const timestamp = new Date().toISOString();
      const reportHeader = `
=== RAPPORT DE DEBUG YUKPOMNANG ===
Généré le: ${timestamp}
Version: 1.0.0 - Build EAS Preview
Plateforme: ${Platform.OS} ${Platform.Version}
Bundle ID: ${Constants.expoConfig?.bundleIdentifier || 'N/A'}
Environment: ${process.env.EXPO_PUBLIC_ENVIRONMENT || 'development'}
API URL: ${process.env.EXPO_PUBLIC_API_URL || 'Non définie'}
WebSocket: ${process.env.EXPO_PUBLIC_WEBSOCKET_ENABLED || 'Non défini'}

=== LOGS DE L'APPLICATION ===
`;

      const logText = logs.map(log =>
        `[${log.timestamp}] ${log.level}: ${log.message}${log.data ? '\n  Data: ' + JSON.stringify(log.data, null, 2) : ''}`
      ).join('\n');

      const fullReport = reportHeader + logText + '\n\n=== FIN DU RAPPORT ===';

      // Copier dans le presse-papiers
      await Clipboard.setStringAsync(fullReport);

      // Proposer aussi de partager directement
      Alert.alert(
        '📋 Rapport copié !',
        `Rapport complet copié dans le presse-papiers !\n\nContenu:\n• ${logs.length} logs capturés\n• Métadonnées système\n• Timestamp: ${timestamp}\n\nVoulez-vous aussi le partager ?`,
        [
          { text: 'Non, merci', style: 'cancel' },
          {
            text: 'Partager',
            onPress: () => shareFullReport(fullReport)
          }
        ]
      );

    } catch (error) {
      console.error('[DebugLogger] Erreur copie:', error);
      Alert.alert('❌ Erreur', 'Impossible de copier le rapport de debug');
    }
  };

  const shareFullReport = async (report: string) => {
    try {
      const shareOptions = {
        title: '🐛 Rapport de Debug Yukpomnang',
        message: report,
        url: undefined,
      };

      await Share.share(shareOptions);
    } catch (error) {
      console.error('[DebugLogger] Erreur partage:', error);
      Alert.alert('⚠️ Partage échoué', 'Le rapport est dans votre presse-papiers, mais le partage a échoué.');
    }
  };

  const shareLogs = async () => {
    try {
      const logText = logs.map(log =>
        `[${log.timestamp}] ${log.level}: ${log.message}${log.data ? '\n' + JSON.stringify(log.data, null, 2) : ''}`
      ).join('\n\n');

      await Share.share({
        message: `Logs Yukpomnang - ${new Date().toISOString()}\n\n${logText}`,
        title: 'Logs de débogage Yukpomnang'
      });
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de partager les logs');
    }
  };

  const clearLogs = () => {
    Alert.alert(
      'Effacer les logs',
      'Êtes-vous sûr de vouloir effacer tous les logs ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Effacer', style: 'destructive', onPress: () => setLogs([]) }
      ]
    );
  };

  const getLogColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'ERROR': return '#DC2626';
      case 'WARN': return '#D97706';
      case 'INFO': return '#059669';
      case 'DEBUG': return '#6366F1';
      default: return '#6B7280';
    }
  };

  if (!visible) return null;

  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Card.Title
          title="🔍 Debug Logger"
          subtitle={`${logs.length} logs capturés`}
          right={(props) => (
            <View style={styles.headerActions}>
              <IconButton
                {...props}
                icon={() => <Copy size={20} color="#6366F1" />}
                onPress={copyAllLogs}
              />
              <IconButton
                {...props}
                icon={() => <ShareIcon size={20} color="#6366F1" />}
                onPress={shareLogs}
              />
              <IconButton
                {...props}
                icon={() => <Trash size={20} color="#DC2626" />}
                onPress={clearLogs}
              />
              <IconButton
                {...props}
                icon="close"
                onPress={onClose}
              />
            </View>
          )}
        />

        <Card.Content style={styles.content}>
          <ScrollView
            style={styles.logsContainer}
            showsVerticalScrollIndicator={true}
            onContentSizeChange={() => {
              if (autoScroll) {
                // Auto-scroll vers le bas
              }
            }}
          >
            {logs.length === 0 ? (
              <Text style={styles.emptyText}>Aucun log capturé</Text>
            ) : (
              logs.map((log, index) => (
                <View key={index} style={styles.logEntry}>
                  <View style={styles.logHeader}>
                    <Text style={[styles.logLevel, { color: getLogColor(log.level) }]}>
                      {log.level}
                    </Text>
                    <Text style={styles.logTimestamp}>
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </Text>
                  </View>
                  <Text style={styles.logMessage}>{log.message}</Text>
                  {log.data && (
                    <Text style={styles.logData}>
                      {JSON.stringify(log.data, null, 2)}
                    </Text>
                  )}
                </View>
              ))
            )}
          </ScrollView>
        </Card.Content>

        <Card.Actions style={styles.actions}>
          <Button
            mode="outlined"
            onPress={() => setAutoScroll(!autoScroll)}
            style={styles.actionButton}
          >
            {autoScroll ? 'Auto-scroll: ON' : 'Auto-scroll: OFF'}
          </Button>
          <Button
            mode="contained"
            onPress={copyAllLogs}
            style={styles.actionButton}
            icon={() => <Copy size={16} color="#FFF" />}
          >
            Copier tout
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
  headerActions: {
    flexDirection: 'row',
  },
  content: {
    flex: 1,
    padding: 0,
  },
  logsContainer: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    padding: 12,
  },
  emptyText: {
    color: '#6B7280',
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 20,
  },
  logEntry: {
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  logLevel: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  logTimestamp: {
    fontSize: 10,
    color: '#9CA3AF',
    fontFamily: 'monospace',
  },
  logMessage: {
    color: '#F3F4F6',
    fontSize: 13,
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  logData: {
    color: '#D1D5DB',
    fontSize: 11,
    fontFamily: 'monospace',
    backgroundColor: '#374151',
    padding: 8,
    borderRadius: 4,
    marginTop: 4,
  },
  actions: {
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  actionButton: {
    marginHorizontal: 4,
  },
});

export default DebugLogger;
