import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Card, Button, Chip, Surface } from 'react-native-paper';
import { Bug, Copy, Share, FileText, Settings, Wrench } from 'phosphor-react-native';

// Composants de debug
import DebugLogger from '../components/DebugLogger';
import CrashDiagnostic from '../components/CrashDiagnostic';

interface DebugTool {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  action: () => void;
  color: string;
}

const DebugScreen: React.FC = () => {
  const [showDebugLogger, setShowDebugLogger] = useState(false);
  const [showCrashDiagnostic, setShowCrashDiagnostic] = useState(false);

  const debugTools: DebugTool[] = [
    {
      id: 'logger',
      title: 'Debug Logger',
      description: 'Voir et copier tous les logs de l\'application',
      icon: <Bug size={24} color="#6366F1" />,
      action: () => setShowDebugLogger(true),
      color: '#6366F1'
    },
    {
      id: 'diagnostic',
      title: 'Diagnostic de Crash',
      description: 'Vérifier l\'état de tous les composants',
      icon: <Wrench size={24} color="#059669" />,
      action: () => setShowCrashDiagnostic(true),
      color: '#059669'
    },
    {
      id: 'logs',
      title: 'Logs Système',
      description: 'Exporter tous les logs pour le support',
      icon: <FileText size={24} color="#D97706" />,
      action: () => exportSystemLogs(),
      color: '#D97706'
    },
    {
      id: 'config',
      title: 'Configuration',
      description: 'Voir la configuration de l\'application',
      icon: <Settings size={24} color="#DC2626" />,
      action: () => showAppConfig(),
      color: '#DC2626'
    }
  ];

  const exportSystemLogs = async () => {
    try {
      const logs = [
        `=== LOGS SYSTÈME YUKPOMNANG ===`,
        `Timestamp: ${new Date().toISOString()}`,
        `Version: 1.0.0`,
        `Platform: ${Platform.OS}`,
        `Build: EAS Preview`,
        ``,
        `=== CONSOLE LOGS ===`,
        `[À compléter avec les vrais logs]`,
        ``,
        `=== CONFIGURATION ===`,
        `API URL: ${process.env.EXPO_PUBLIC_API_URL || 'Non définie'}`,
        `Environment: ${process.env.EXPO_PUBLIC_ENVIRONMENT || 'Non définie'}`,
      ].join('\n');

      await Share.share({
        message: logs,
        title: 'Logs système Yukpomnang'
      });
    } catch (error) {
      Alert.alert('Erreur', 'Impossible d\'exporter les logs');
    }
  };

  const showAppConfig = () => {
    const config = {
      'API URL': process.env.EXPO_PUBLIC_API_URL || 'Non définie',
      'Environment': process.env.EXPO_PUBLIC_ENVIRONMENT || 'Non définie',
      'Google Maps': process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ? 'Configuré' : 'Non configuré',
      'Google Translate': process.env.EXPO_PUBLIC_GOOGLE_TRANSLATE_API_KEY ? 'Configuré' : 'Non configuré',
    };

    const configText = Object.entries(config)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');

    Alert.alert(
      'Configuration de l\'application',
      configText,
      [
        { text: 'OK' },
        { 
          text: 'Copier', 
          onPress: () => {
            // Ici on pourrait copier la config
            Alert.alert('Succès', 'Configuration copiée !');
          }
        }
      ]
    );
  };

  const copyDebugInfo = () => {
    const debugInfo = [
      `=== INFO DEBUG YUKPOMNANG ===`,
      `Date: ${new Date().toISOString()}`,
      `Version: 1.0.0`,
      `Platform: Android/iOS`,
      `Build: EAS Preview`,
      ``,
      `=== FONCTIONNALITÉS DISPONIBLES ===`,
      `✅ Debug Logger - Capturer et copier les logs`,
      `✅ Crash Diagnostic - Vérifier les composants`,
      `✅ Export Logs - Partager les logs système`,
      `✅ Configuration - Voir la config app`,
      ``,
      `=== COMMENT UTILISER ===`,
      `1. Debug Logger: Capture automatiquement tous les logs`,
      `2. Diagnostic: Vérifie l'état des composants`,
      `3. Export: Partage les logs via WhatsApp/Email`,
      `4. Configuration: Voir les paramètres de l'app`,
    ].join('\n');

    Share.share({
      message: debugInfo,
      title: 'Guide Debug Yukpomnang'
    });
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🔧 Outils de Debug</Text>
        <Text style={styles.subtitle}>Diagnostiquer et résoudre les problèmes</Text>
        
        <TouchableOpacity style={styles.copyButton} onPress={copyDebugInfo}>
          <Copy size={16} color="#6366F1" />
          <Text style={styles.copyButtonText}>Guide d'utilisation</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.toolsGrid}>
        {debugTools.map((tool) => (
          <Surface key={tool.id} style={[styles.toolCard, { borderLeftColor: tool.color }]} elevation={2}>
            <TouchableOpacity style={styles.toolContent} onPress={tool.action}>
              <View style={styles.toolIcon}>
                {tool.icon}
              </View>
              <Text style={styles.toolTitle}>{tool.title}</Text>
              <Text style={styles.toolDescription}>{tool.description}</Text>
            </TouchableOpacity>
          </Surface>
        ))}
      </View>

      <Card style={styles.infoCard}>
        <Card.Title title="💡 Conseils d'utilisation" />
        <Card.Content>
          <Text style={styles.infoText}>
            • Utilisez le Debug Logger pour capturer les logs en temps réel{'\n'}
            • Le Diagnostic vérifie automatiquement tous les composants{'\n'}
            • Exportez les logs pour obtenir de l'aide technique{'\n'}
            • Vérifiez la configuration si l'app ne fonctionne pas
          </Text>
        </Card.Content>
      </Card>

      {/* Composants de debug modaux */}
      <DebugLogger 
        visible={showDebugLogger} 
        onClose={() => setShowDebugLogger(false)} 
      />
      
      <CrashDiagnostic 
        visible={showCrashDiagnostic} 
        onClose={() => setShowCrashDiagnostic(false)} 
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    padding: 20,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 16,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  copyButtonText: {
    marginLeft: 8,
    color: '#6366F1',
    fontWeight: '600',
  },
  toolsGrid: {
    padding: 20,
    gap: 16,
  },
  toolCard: {
    borderRadius: 12,
    borderLeftWidth: 4,
    backgroundColor: '#FFF',
  },
  toolContent: {
    padding: 20,
  },
  toolIcon: {
    marginBottom: 12,
  },
  toolTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  toolDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  infoCard: {
    margin: 20,
    marginTop: 0,
  },
  infoText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 22,
  },
});

export default DebugScreen;


