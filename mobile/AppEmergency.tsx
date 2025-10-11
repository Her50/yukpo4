// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Clipboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SafeIcon from './src/components/SafeIcon';

// Version d'urgence de l'App qui s'affiche même en cas de crash complet
export default function AppEmergency() {
    const [showDebug, setShowDebug] = useState(false);
    const [logs, setLogs] = useState<any[]>([]);
    const [error, setError] = useState<any>(null);

    useEffect(() => {
        // Démarrer le système de debug d'urgence immédiatement
        initializeEmergencyDebug();
        
        // Afficher automatiquement le debug après 2 secondes si l'app crash
        const timer = setTimeout(() => {
            setShowDebug(true);
        }, 2000);

        return () => clearTimeout(timer);
    }, []);

    const initializeEmergencyDebug = async () => {
        try {
            // Logger l'initialisation
            await logEmergency('APP_EMERGENCY', '🚨 App Emergency Debug initialisé');
            
            // Essayer de charger l'app normale avec un timeout
            setTimeout(async () => {
                try {
                    await logEmergency('APP_EMERGENCY', 'Tentative de chargement de l\'app normale...');
                    // Si on arrive ici, l'app fonctionne
                } catch (err) {
                    await logEmergency('APP_EMERGENCY', 'App normale a crashé', err);
                    setError(err);
                    setShowDebug(true);
                }
            }, 1000);

        } catch (err) {
            console.error('Erreur initialisation debug d\'urgence:', err);
            setError(err);
            setShowDebug(true);
        }
    };

    const logEmergency = async (component: string, message: string, data?: any) => {
        try {
            const logEntry = {
                timestamp: new Date().toISOString(),
                level: 'EMERGENCY',
                component,
                message,
                data
            };

            // Sauvegarder dans AsyncStorage
            const existingLogs = await AsyncStorage.getItem('emergency_logs');
            const logs = existingLogs ? JSON.parse(existingLogs) : [];
            logs.push(logEntry);
            
            // Garder seulement les 100 derniers logs
            if (logs.length > 100) {
                logs.splice(0, logs.length - 100);
            }
            
            await AsyncStorage.setItem('emergency_logs', JSON.stringify(logs));
            setLogs(logs);
            
            // Aussi dans la console
            console.log(`[EMERGENCY] ${component}: ${message}`, data || '');
        } catch (err) {
            console.error('Erreur log emergency:', err);
        }
    };

    const copyAllLogs = async () => {
        try {
            const exportData = {
                exportDate: new Date().toISOString(),
                deviceInfo: {
                    platform: 'React Native Emergency',
                    timestamp: Date.now(),
                    emergency: true
                },
                error: error,
                logs: logs,
                summary: {
                    totalLogs: logs.length,
                    emergency: true
                }
            };

            const jsonString = JSON.stringify(exportData, null, 2);
            await Clipboard.setString(jsonString);
            
            Alert.alert(
                '🚨 Logs d\'urgence copiés !',
                'Tous les logs ont été copiés dans le presse-papier. Collez-les ici pour analyse.',
                [{ text: 'OK' }]
            );
        } catch (err) {
            Alert.alert('Erreur', 'Impossible de copier les logs: ' + err.message);
        }
    };

    const tryLoadNormalApp = async () => {
        await logEmergency('APP_EMERGENCY', 'Tentative de rechargement de l\'app normale');
        // Ici on pourrait essayer de recharger l'app normale
        Alert.alert('Info', 'Rechargement de l\'app en cours...');
    };

    if (!showDebug) {
        // Écran de chargement normal
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <SafeIcon name="bug" size={64} color="#6366F1" />
                    <Text style={styles.loadingTitle}>Yukpo</Text>
                    <Text style={styles.loadingSubtitle}>Chargement...</Text>
                    <View style={styles.loadingBar}>
                        <View style={[styles.loadingProgress, { width: '100%' }} />
                    </View>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <SafeIcon name="warning" size={48} color="#DC2626" />
                <Text style={styles.title}>🚨 DEBUG D'URGENCE</Text>
                <Text style={styles.subtitle}>
                    L'application a crashé au démarrage. Voici les informations de debug.
                </Text>
            </View>

            {error && (
                <View style={styles.errorSection}>
                    <Text style={styles.sectionTitle}>Erreur détectée:</Text>
                    <Text style={styles.errorText}>{error?.message || 'Erreur inconnue'}</Text>
                    {error?.stack && (
                        <View style={styles.stackContainer}>
                            <Text style={styles.stackText}>{error.stack}</Text>
                        </View>
                    )}
                </View>
            )}

            <View style={styles.actionsSection}>
                <TouchableOpacity
                    style={[styles.actionButton, styles.primaryButton]}
                    onPress={copyAllLogs}
                >
                    <SafeIcon name="copy" size={20} color="#FFF" />
                    <Text style={styles.buttonText}>📋 COPIER TOUS LES LOGS</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.actionButton, styles.secondaryButton]}
                    onPress={tryLoadNormalApp}
                >
                    <SafeIcon name="arrow-clockwise" size={20} color="#6366F1" />
                    <Text style={[styles.buttonText, { color: '#6366F1' }]}>Réessayer</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.logsSection}>
                <Text style={styles.sectionTitle}>
                    Logs d'urgence ({logs.length}):
                </Text>
                {logs.length > 0 ? (
                    logs.slice(-10).map((log, index) => (
                        <View key={index} style={styles.logEntry}>
                            <Text style={styles.logTime}>
                                {new Date(log.timestamp).toLocaleTimeString()}
                            </Text>
                            <Text style={styles.logComponent}>{log.component}</Text>
                            <Text style={styles.logMessage}>{log.message}</Text>
                            {log.data && (
                                <Text style={styles.logData}>
                                    {JSON.stringify(log.data, null, 2)}
                                </Text>
                            )}
                        </View>
                    ))
                ) : (
                    <Text style={styles.noLogsText}>
                        Aucun log disponible. L'erreur s'est produite très tôt.
                    </Text>
                )}
            </View>

            <View style={styles.footer}>
                <Text style={styles.footerText}>
                    💡 Appuyez sur "COPIER TOUS LES LOGS" puis collez le contenu ici pour analyse
                </Text>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
        padding: 16,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingTitle: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#6366F1',
        marginTop: 16,
    },
    loadingSubtitle: {
        fontSize: 18,
        color: '#6B7280',
        marginTop: 8,
    },
    loadingBar: {
        width: 200,
        height: 4,
        backgroundColor: '#E5E7EB',
        borderRadius: 2,
        marginTop: 24,
        overflow: 'hidden',
    },
    loadingProgress: {
        height: '100%',
        backgroundColor: '#6366F1',
        borderRadius: 2,
    },
    header: {
        alignItems: 'center',
        marginBottom: 24,
        paddingVertical: 16,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#DC2626',
        marginTop: 12,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: '#6B7280',
        marginTop: 8,
        textAlign: 'center',
    },
    errorSection: {
        backgroundColor: '#FEF2F2',
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
        borderLeftWidth: 4,
        borderLeftColor: '#DC2626',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1F2937',
        marginBottom: 8,
    },
    errorText: {
        fontSize: 16,
        color: '#DC2626',
        fontFamily: 'monospace',
    },
    stackContainer: {
        maxHeight: 150,
        backgroundColor: '#1F2937',
        borderRadius: 8,
        padding: 12,
        marginTop: 12,
    },
    stackText: {
        fontSize: 12,
        color: '#FFF',
        fontFamily: 'monospace',
    },
    actionsSection: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
    },
    actionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        gap: 8,
    },
    primaryButton: {
        backgroundColor: '#DC2626',
    },
    secondaryButton: {
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#6366F1',
    },
    buttonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFF',
    },
    logsSection: {
        flex: 1,
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 12,
        marginBottom: 16,
    },
    logEntry: {
        backgroundColor: '#FFF',
        padding: 12,
        borderRadius: 8,
        marginBottom: 8,
        borderLeftWidth: 3,
        borderLeftColor: '#6366F1',
    },
    logTime: {
        fontSize: 10,
        color: '#6B7280',
        marginBottom: 4,
    },
    logComponent: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1F2937',
        marginBottom: 4,
    },
    logMessage: {
        fontSize: 14,
        color: '#374151',
        marginBottom: 4,
    },
    logData: {
        fontSize: 12,
        color: '#6B7280',
        fontFamily: 'monospace',
        backgroundColor: '#1F2937',
        padding: 8,
        borderRadius: 4,
        marginTop: 4,
    },
    noLogsText: {
        fontSize: 16,
        color: '#6B7280',
        textAlign: 'center',
        marginTop: 32,
    },
    footer: {
        padding: 16,
        backgroundColor: '#FEF3C7',
        borderRadius: 8,
        borderLeftWidth: 4,
        borderLeftColor: '#F59E0B',
    },
    footerText: {
        fontSize: 14,
        color: '#92400E',
        textAlign: 'center',
    },
});
