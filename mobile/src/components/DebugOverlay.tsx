// @ts-nocheck
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Animated,
    Clipboard,
    Dimensions,
    Modal,
    PanResponder,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { modernColors } from '../theme/modernTheme';
import { useDebugLogger } from '../utils/DebugLogger';
import CrashRecoveryScreen from './CrashRecoveryScreen';
import SafeIcon from './SafeIcon';
import { useLanguageSafe } from '../contexts/LanguageContext';

const { width, height } = Dimensions.get('window');

interface DebugOverlayProps {
    isVisible?: boolean;
    onToggle?: (visible: boolean) => void;
}

const DebugOverlay: React.FC<DebugOverlayProps> = ({
    isVisible = false,
    onToggle
}) => {
        const { t } = useLanguageSafe();
const [isExpanded, setIsExpanded] = useState(false);
    const [showCrashScreen, setShowCrashScreen] = useState(false);
    const [logs, setLogs] = useState<any[]>([]);
    const [summary, setSummary] = useState<any>(null);
    const [position] = useState(new Animated.ValueXY({ x: width - 80, y: 100 }));

    const logger = useDebugLogger();

    useEffect(() => {
        if (isVisible) {
            loadLogs();
            const interval = setInterval(loadLogs, 2000); // Mise à jour toutes les 2 secondes
            return () => clearInterval(interval);
        }
    }, [isVisible]);

    const loadLogs = () => {
        const recentLogs = logger.getLogs().slice(-10); // 10 derniers logs
        const logSummary = logger.getSummary();
        setLogs(recentLogs);
        setSummary(logSummary);
    };

    const panResponder = PanResponder.create({
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
            position.setOffset({
                x: (position.x as any)._value,
                y: (position.y as any)._value,
            });
        },
        onPanResponderMove: Animated.event([
            null,
            {
                dx: position.x,
                dy: position.y,
            },
        ]),
        onPanResponderRelease: () => {
            position.flattenOffset();

            // Garder le bouton dans l'écran
            const newX = Math.max(0, Math.min(width - 60, (position.x as any)._value));
            const newY = Math.max(0, Math.min(height - 60, (position.y as any)._value));

            Animated.spring(position, {
                toValue: { x: newX, y: newY },
                useNativeDriver: false,
            }).start();
        },
    });

    const toggleExpanded = () => {
        setIsExpanded(!isExpanded);
    };

    const exportLogs = async () => {
        try {
            const exportData = await logger.exportLogs();
            await Clipboard.setString(exportData);
            Alert.alert(t('debugOverlay.succes'), t('debugOverlay.logsCopiesDansLePressepapier'));
        } catch (err) {
            Alert.alert('Erreur', 'Impossible de copier les logs');
        }
    };

    const showCrashRecovery = () => {
        setShowCrashScreen(true);
    };

    const getStatusColor = () => {
        if (!summary) return modernColors.textSecondary;
        if (summary.crashes > 0) return modernColors.error;
        if (summary.errors > 0) return '#F59E0B';
        return modernColors.success || '#10B981';
    };

    const getStatusText = () => {
        if (!summary) return 'N/A';
        if (summary.crashes > 0) return `CRASH`;
        if (summary.errors > 0) return `ERR: ${summary.errors}`;
        return 'OK';
    };

    if (!isVisible) return null;

    return (
        <>
            {/* Bouton flottant de debug */}
            <Animated.View
                style={[
                    styles.floatingButton,
                    {
                        transform: [{ translateX: position.x }, { translateY: position.y }],
                    },
                ]}
                {...panResponder.panHandlers}
            >
                <TouchableOpacity
                    style={[styles.debugButton, { backgroundColor: getStatusColor() }]}
                    onPress={toggleExpanded}
                    onLongPress={showCrashRecovery}
                >
                    <SafeIcon name="bug" size={20} color="#FFF" />
                    {summary && (summary.errors > 0 || summary.crashes > 0) && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>
                                {summary.crashes + summary.errors}
                            </Text>
                        </View>
                    )}
                </TouchableOpacity>
            </Animated.View>

            {/* Overlay de debug étendu */}
            {isExpanded && (
                <View style={styles.overlay}>
                    <View style={styles.overlayContent}>
                        <View style={styles.header}>
                            <Text style={styles.title}>Debug Console</Text>
                            <TouchableOpacity onPress={toggleExpanded}>
                                <SafeIcon name="x" size={24} color={modernColors.text} />
                            </TouchableOpacity>
                        </View>

                        {/* Résumé */}
                        {summary && (
                            <View style={styles.summary}>
                                <View style={styles.summaryItem}>
                                    <Text style={styles.summaryLabel}>Status:</Text>
                                    <Text style={[styles.summaryValue, { color: getStatusColor() }]}>
                                        {getStatusText()}
                                    </Text>
                                </View>
                                <View style={styles.summaryItem}>
                                    <Text style={styles.summaryLabel}>{t('debugOverlay.totalLogs')}</Text>
                                    <Text style={styles.summaryValue}>{summary.total}</Text>
                                </View>
                                <View style={styles.summaryItem}>
                                    <Text style={styles.summaryLabel}>Erreurs:</Text>
                                    <Text style={[styles.summaryValue, { color: modernColors.error }]}>
                                        {summary.errors}
                                    </Text>
                                </View>
                                <View style={styles.summaryItem}>
                                    <Text style={styles.summaryLabel}>Crashes:</Text>
                                    <Text style={[styles.summaryValue, { color: modernColors.error }]}>
                                        {summary.crashes}
                                    </Text>
                                </View>
                            </View>
                        )}

                        {/* Actions */}
                        <View style={styles.actions}>
                            <TouchableOpacity style={styles.actionButton} onPress={exportLogs}>
                                <SafeIcon name="download" size={16} color="#FFF" />
                                <Text style={styles.actionText}>Exporter</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.actionButton} onPress={showCrashRecovery}>
                                <SafeIcon name="warning" size={16} color="#FFF" />
                                <Text style={styles.actionText}>Crash Screen</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.actionButton, styles.dangerButton]}
                                onPress={() => logger.clearLogs()}
                            >
                                <SafeIcon name="trash" size={16} color="#FFF" />
                                <Text style={styles.actionText}>Clear</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Logs récents */}
                        <ScrollView style={styles.logsContainer}>
                            <Text style={styles.logsTitle}>{t('debugOverlay.logsRecents')}</Text>
                            {logs.map((log, index) => (
                                <View key={index} style={styles.logEntry}>
                                    <View style={styles.logHeader}>
                                        <Text style={[styles.logLevel, { color: getStatusColor() }]}>
                                            {log.level}
                                        </Text>
                                        <Text style={styles.logTime}>
                                            {new Date(log.timestamp).toLocaleTimeString()}
                                        </Text>
                                    </View>
                                    <Text style={styles.logComponent}>{log.component}</Text>
                                    <Text style={styles.logMessage} numberOfLines={2}>
                                        {log.message}
                                    </Text>
                                </View>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            )}

            {/* Écran de récupération après crash */}
            <Modal
                visible={showCrashScreen}
                animationType="slide"
                presentationStyle="fullScreen"
            >
                <CrashRecoveryScreen
                    onRetry={() => setShowCrashScreen(false)}
                    onContinue={() => setShowCrashScreen(false)}
                />
            </Modal>
        </>
    );
};

const styles = StyleSheet.create({
    floatingButton: {
        position: 'absolute',
        zIndex: 9999,
    },
    debugButton: {
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    badge: {
        position: 'absolute',
        top: -5,
        right: -5,
        backgroundColor: modernColors.error,
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    badgeText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: 'bold',
    },
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        zIndex: 9998,
        justifyContent: 'center',
        alignItems: 'center',
    },
    overlayContent: {
        backgroundColor: modernColors.surface,
        borderRadius: 16,
        padding: 20,
        margin: 20,
        maxHeight: '80%',
        width: '90%',
        maxWidth: 500,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: modernColors.text,
    },
    summary: {
        backgroundColor: modernColors.background,
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
    },
    summaryItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    summaryLabel: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    summaryValue: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    actions: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 16,
    },
    actionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: modernColors.primary,
        borderRadius: 8,
        gap: 4,
    },
    dangerButton: {
        backgroundColor: modernColors.error,
    },
    actionText: {
        fontSize: 12,
        color: '#FFF',
        fontWeight: '600',
    },
    logsContainer: {
        maxHeight: 300,
    },
    logsTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: modernColors.text,
        marginBottom: 8,
    },
    logEntry: {
        backgroundColor: modernColors.background,
        padding: 8,
        borderRadius: 6,
        marginBottom: 4,
        borderLeftWidth: 3,
        borderLeftColor: modernColors.primary,
    },
    logHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 2,
    },
    logLevel: {
        fontSize: 10,
        fontWeight: 'bold',
    },
    logTime: {
        fontSize: 10,
        color: modernColors.textSecondary,
    },
    logComponent: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 2,
    },
    logMessage: {
        fontSize: 12,
        color: modernColors.text,
    },
});

export default DebugOverlay;
