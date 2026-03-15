// @ts-nocheck
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Clipboard,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { modernColors } from '../theme/modernTheme';
import { useDebugLogger } from '../utils/DebugLogger';
import SafeIcon from './SafeIcon';
import { useLanguageSafe } from '../contexts/LanguageContext';

interface CrashRecoveryScreenProps {
    error?: Error;
    onRetry?: () => void;
    onContinue?: () => void;
}

const CrashRecoveryScreen: React.FC<CrashRecoveryScreenProps> = ({
    error,
    onRetry,
    onContinue
}) => {
    const [logs, setLogs] = useState<any[]>([]);
    const [isExporting, setIsExporting] = useState(false);
    const [logsSummary, setLogsSummary] = useState<any>(null);
    const logger = useDebugLogger();

    useEffect(() => {
        loadLogs();
    }, []);

    const loadLogs = async () => {
        try {
            const allLogs = logger.getLogs();
            const summary = logger.getSummary();
            setLogs(allLogs);
            setLogsSummary(summary);
        } catch (err) {
            console.error('Erreur chargement logs:', err);
        }
    };

    const exportLogs = async () => {
        setIsExporting(true);
        try {
            const exportData = await logger.exportLogs();

            // Option 1: Copier dans le presse-papier
            await Clipboard.setString(exportData);

            // Option 2: Partager via le système
            const shareResult = await Share.share({
                message: exportData,
                title: 'Logs de debug Yukpo'
            });

            if (shareResult.action === Share.sharedAction) {
                Alert.alert('Succès', 'Logs exportés et partagés avec succès !');
            } else {
                Alert.alert('Succès', 'Logs copiés dans le presse-papier !');
            }
        } catch (err) {
            Alert.alert('Erreur', 'Impossible d\'exporter les logs: ' + err.message);
        } finally {
            setIsExporting(false);
        }
    };

    const copyLogsToClipboard = async () => {
        try {
            const exportData = await logger.exportLogs();
            await Clipboard.setString(exportData);
            Alert.alert('Succès', 'Logs copiés dans le presse-papier ! Vous pouvez maintenant les coller ici.');
        } catch (err) {
            Alert.alert('Erreur', 'Impossible de copier les logs: ' + err.message);
        }
    };

    const clearLogs = () => {
        Alert.alert(
            'Confirmer',
            'Voulez-vous vraiment effacer tous les logs ?',
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: 'Effacer',
                    style: 'destructive',
                    onPress: async () => {
                        await logger.clearLogs();
                        loadLogs();
                        Alert.alert('Succès', 'Logs effacés');
                    }
                }
            ]
        );
    };

    const formatTimestamp = (timestamp: string) => {
        return new Date(timestamp).toLocaleString('fr-FR');
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
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <SafeIcon name="bug" size={48} color={modernColors.error} />
                <Text style={styles.title}>Récupération après Crash</Text>
                <Text style={styles.subtitle}>
                    L'application a rencontré une erreur. Voici les informations de debug.
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

            {logsSummary && (
                <View style={styles.summarySection}>
                    <Text style={styles.sectionTitle}>Résumé des logs:</Text>
                    <View style={styles.summaryGrid}>
                        <View style={styles.summaryItem}>
                            <Text style={styles.summaryLabel}>Total:</Text>
                            <Text style={styles.summaryValue}>{logsSummary.total}</Text>
                        </View>
                        <View style={styles.summaryItem}>
                            <Text style={styles.summaryLabel}>Erreurs:</Text>
                            <Text style={[styles.summaryValue, { color: modernColors.error }]}>
                                {logsSummary.errors}
                            </Text>
                        </View>
                        <View style={styles.summaryItem}>
                            <Text style={styles.summaryLabel}>Crashes:</Text>
                            <Text style={[styles.summaryValue, { color: modernColors.error }]}>
                                {logsSummary.crashes}
                            </Text>
                        </View>
                        <View style={styles.summaryItem}>
                            <Text style={styles.summaryLabel}>Avertissements:</Text>
                            <Text style={[styles.summaryValue, { color: '#F59E0B' }]}>
                                {logsSummary.warnings}
                            </Text>
                        </View>
                    </View>
                </View>
            )}

            <View style={styles.actionsSection}>
                <TouchableOpacity
                    style={[styles.actionButton, styles.primaryButton]}
                    onPress={exportLogs}
                    disabled={isExporting}
                >
                    {isExporting ? (
                        <ActivityIndicator color="#FFF" />
                    ) : (
                        <SafeIcon name="download" size={20} color="#FFF" />
                    )}
                    <Text style={styles.buttonText}>
                        {isExporting ? 'Export...' : 'Exporter les logs'}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.actionButton, styles.secondaryButton]}
                    onPress={copyLogsToClipboard}
                >
                    <SafeIcon name="copy" size={20} color={modernColors.primary} />
                    <Text style={[styles.buttonText, { color: modernColors.primary }]}>
                        Copier les logs
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.actionButton, styles.dangerButton]}
                    onPress={clearLogs}
                >
                    <SafeIcon name="trash" size={20} color="#FFF" />
                    <Text style={styles.buttonText}>Effacer les logs</Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.logsContainer}>
                <Text style={styles.sectionTitle}>Logs récents ({logs.length}):</Text>
                {logs.slice(-50).map((log, index) => (
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
                        {log.stack && (
                            <ScrollView style={styles.logStack}>
                                <Text style={styles.logStackText}>{log.stack}</Text>
                            </ScrollView>
                        )}
                    </View>
                ))}
            </ScrollView>

            <View style={styles.recoveryActions}>
                {onRetry && (
                    <TouchableOpacity
                        style={[styles.actionButton, styles.primaryButton]}
                        onPress={onRetry}
                    >
                        <SafeIcon name="arrow-clockwise" size={20} color="#FFF" />
                        <Text style={styles.buttonText}>Réessayer</Text>
                    </TouchableOpacity>
                )}

                {onContinue && (
                    <TouchableOpacity
                        style={[styles.actionButton, styles.secondaryButton]}
                        onPress={onContinue}
                    >
                        <SafeIcon name="arrow-right" size={20} color={modernColors.primary} />
                        <Text style={[styles.buttonText, { color: modernColors.primary }]}>
                            Continuer quand même
                        </Text>
                    </TouchableOpacity>
                )}
            </View>
        </SafeAreaView>
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
        color: modernColors.text,
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
    summarySection: {
        backgroundColor: modernColors.surface,
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
    },
    summaryGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    summaryItem: {
        width: '48%',
        alignItems: 'center',
        padding: 12,
        backgroundColor: modernColors.background,
        borderRadius: 8,
        marginBottom: 8,
    },
    summaryLabel: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginBottom: 4,
    },
    summaryValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: modernColors.text,
    },
    actionsSection: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 16,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        gap: 8,
        minWidth: 120,
        justifyContent: 'center',
    },
    primaryButton: {
        backgroundColor: modernColors.primary,
    },
    secondaryButton: {
        backgroundColor: modernColors.surface,
        borderWidth: 1,
        borderColor: modernColors.primary,
    },
    dangerButton: {
        backgroundColor: modernColors.error,
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
    logStack: {
        maxHeight: 100,
        backgroundColor: '#1a1a1a',
        borderRadius: 4,
        padding: 8,
        marginTop: 4,
    },
    logStackText: {
        fontSize: 10,
        color: '#FFF',
        fontFamily: 'monospace',
    },
    recoveryActions: {
        flexDirection: 'row',
        gap: 12,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
    },
});

export default CrashRecoveryScreen;
