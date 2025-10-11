import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Alert,
    Clipboard,
    ActivityIndicator,
    Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';

interface EmergencyDebugScreenProps {
    visible: boolean;
    onClose: () => void;
    error?: Error;
}

const EmergencyDebugScreen: React.FC<EmergencyDebugScreenProps> = ({
    visible,
    onClose,
    error
}) => {
    const [logs, setLogs] = useState<any[]>([]);
    const [isExporting, setIsExporting] = useState(false);

    useEffect(() => {
        if (visible) {
            loadEmergencyLogs();
        }
    }, [visible]);

    const loadEmergencyLogs = async () => {
        try {
            // Essayer de récupérer les logs depuis AsyncStorage
            const savedLogs = await AsyncStorage.getItem('debug_logs');
            if (savedLogs) {
                const parsedLogs = JSON.parse(savedLogs);
                setLogs(parsedLogs);
            } else {
                // Créer des logs d'urgence basés sur l'erreur actuelle
                const emergencyLogs = [
                    {
                        timestamp: new Date().toISOString(),
                        level: 'CRASH',
                        component: 'EmergencyDebug',
                        message: 'Application crashed - Emergency debug activated',
                        data: {
                            error: error?.message || 'Unknown error',
                            stack: error?.stack || 'No stack trace available'
                        }
                    }
                ];
                setLogs(emergencyLogs);
            }
        } catch (err) {
            console.error('Erreur chargement logs d\'urgence:', err);
            // Logs de fallback
            setLogs([{
                timestamp: new Date().toISOString(),
                level: 'ERROR',
                component: 'EmergencyDebug',
                message: 'Failed to load emergency logs',
                data: { error: err }
            }]);
        }
    };

    const exportEmergencyLogs = async () => {
        setIsExporting(true);
        try {
            const exportData = {
                exportDate: new Date().toISOString(),
                deviceInfo: {
                    platform: 'React Native',
                    timestamp: Date.now(),
                    emergency: true
                },
                error: {
                    message: error?.message || 'Unknown error',
                    stack: error?.stack || 'No stack trace',
                    name: error?.name || 'Error'
                },
                logs: logs,
                summary: {
                    totalLogs: logs.length,
                    errors: logs.filter(l => l.level === 'ERROR').length,
                    crashes: logs.filter(l => l.level === 'CRASH').length,
                    warnings: logs.filter(l => l.level === 'WARN').length
                }
            };

            const jsonString = JSON.stringify(exportData, null, 2);
            await Clipboard.setString(jsonString);
            
            Alert.alert(
                'Logs d\'urgence exportés !',
                'Les logs ont été copiés dans le presse-papier. Vous pouvez maintenant les coller ici pour analyse.',
                [
                    { text: 'OK', onPress: onClose }
                ]
            );
        } catch (err) {
            Alert.alert('Erreur', 'Impossible d\'exporter les logs d\'urgence: ' + err.message);
        } finally {
            setIsExporting(false);
        }
    };

    const formatTimestamp = (timestamp: string) => {
        try {
            return new Date(timestamp).toLocaleString('fr-FR');
        } catch {
            return timestamp;
        }
    };

    const getLogColor = (level: string) => {
        switch (level) {
            case 'ERROR':
            case 'CRASH':
                return modernColors.error;
            case 'WARN':
                return '#F59E0B';
            case 'LOG':
            default:
                return modernColors.text;
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="fullScreen"
            onRequestClose={onClose}
        >
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <SafeIcon name="warning" size={48} color={modernColors.error} />
                    <Text style={styles.title}>🚨 Debug d'Urgence</Text>
                    <Text style={styles.subtitle}>
                        L'application a crashé. Voici les informations de debug disponibles.
                    </Text>
                </View>

                {error && (
                    <View style={styles.errorSection}>
                        <Text style={styles.sectionTitle}>Erreur détectée:</Text>
                        <Text style={styles.errorText}>{error.message}</Text>
                        {error.stack && (
                            <ScrollView style={styles.stackTrace}>
                                <Text style={styles.stackText}>{error.stack}</Text>
                            </ScrollView>
                        )}
                    </View>
                )}

                <View style={styles.actionsSection}>
                    <TouchableOpacity
                        style={[styles.actionButton, styles.primaryButton]}
                        onPress={exportEmergencyLogs}
                        disabled={isExporting}
                    >
                        {isExporting ? (
                            <ActivityIndicator color="#FFF" />
                        ) : (
                            <SafeIcon name="download" size={20} color="#FFF" />
                        )}
                        <Text style={styles.buttonText}>
                            {isExporting ? 'Export...' : '📋 Copier les logs'}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.actionButton, styles.secondaryButton]}
                        onPress={onClose}
                    >
                        <SafeIcon name="x" size={20} color={modernColors.primary} />
                        <Text style={[styles.buttonText, { color: modernColors.primary }]}>
                            Fermer
                        </Text>
                    </TouchableOpacity>
                </View>

                <ScrollView style={styles.logsContainer}>
                    <Text style={styles.sectionTitle}>
                        Logs disponibles ({logs.length}):
                    </Text>
                    {logs.length > 0 ? (
                        logs.slice(-20).map((log, index) => (
                            <View key={index} style={styles.logEntry}>
                                <View style={styles.logHeader}>
                                    <Text style={[styles.logLevel, { color: getLogColor(log.level) }]}>
                                        {log.level}
                                    </Text>
                                    <Text style={styles.logTime}>
                                        {formatTimestamp(log.timestamp)}
                                    </Text>
                                </View>
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
                        <View style={styles.noLogsContainer}>
                            <SafeIcon name="info" size={32} color={modernColors.textSecondary} />
                            <Text style={styles.noLogsText}>
                                Aucun log disponible.{'\n'}
                                L'erreur s'est produite avant l'initialisation du système de debug.
                            </Text>
                        </View>
                    )}
                </ScrollView>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>
                        💡 Astuce: Appuyez sur "Copier les logs" puis collez le contenu ici pour analyse
                    </Text>
                </View>
            </SafeAreaView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: modernColors.background,
        padding: 16,
    },
    header: {
        alignItems: 'center',
        marginBottom: 24,
        paddingVertical: 16,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: modernColors.error,
        marginTop: 12,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: modernColors.textSecondary,
        marginTop: 8,
        textAlign: 'center',
    },
    errorSection: {
        backgroundColor: modernColors.surface,
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
        borderLeftWidth: 4,
        borderLeftColor: modernColors.error,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: modernColors.text,
        marginBottom: 8,
    },
    errorText: {
        fontSize: 16,
        color: modernColors.error,
        fontFamily: 'monospace',
    },
    stackTrace: {
        maxHeight: 150,
        backgroundColor: '#1a1a1a',
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
        backgroundColor: modernColors.primary,
    },
    secondaryButton: {
        backgroundColor: modernColors.surface,
        borderWidth: 1,
        borderColor: modernColors.primary,
    },
    buttonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFF',
    },
    logsContainer: {
        flex: 1,
        backgroundColor: modernColors.surface,
        borderRadius: 12,
        padding: 12,
        marginBottom: 16,
    },
    logEntry: {
        backgroundColor: modernColors.background,
        padding: 12,
        borderRadius: 8,
        marginBottom: 8,
        borderLeftWidth: 3,
        borderLeftColor: modernColors.primary,
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
    },
    logTime: {
        fontSize: 10,
        color: modernColors.textSecondary,
    },
    logComponent: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 4,
    },
    logMessage: {
        fontSize: 14,
        color: modernColors.text,
        marginBottom: 4,
    },
    logData: {
        fontSize: 12,
        color: modernColors.textSecondary,
        fontFamily: 'monospace',
        backgroundColor: '#1a1a1a',
        padding: 8,
        borderRadius: 4,
        marginTop: 4,
    },
    noLogsContainer: {
        alignItems: 'center',
        padding: 32,
    },
    noLogsText: {
        fontSize: 16,
        color: modernColors.textSecondary,
        textAlign: 'center',
        marginTop: 16,
        lineHeight: 24,
    },
    footer: {
        padding: 16,
        backgroundColor: modernColors.surface,
        borderRadius: 8,
        borderLeftWidth: 4,
        borderLeftColor: modernColors.primary,
    },
    footerText: {
        fontSize: 14,
        color: modernColors.textSecondary,
        textAlign: 'center',
    },
});

export default EmergencyDebugScreen;
