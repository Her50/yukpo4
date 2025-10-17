// Panneau de debug avec copie des logs en un clic
import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    Modal,
    Platform,
    Alert,
    Share,
    Dimensions,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';

interface LogEntry {
    timestamp: string;
    level: 'info' | 'warn' | 'error' | 'debug';
    message: string;
    stack?: string;
}

interface DebugPanelProps {
    visible: boolean;
    onClose: () => void;
}

// Intercepter les logs console
const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    debug: console.debug,
};

let logBuffer: LogEntry[] = [];
const MAX_LOGS = 500;

export const DebugPanel: React.FC<DebugPanelProps> = ({ visible, onClose }) => {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [filter, setFilter] = useState<'all' | 'info' | 'warn' | 'error' | 'debug'>('all');
    const [autoScroll, setAutoScroll] = useState(true);
    const scrollViewRef = useRef<ScrollView>(null);

    // Initialiser l'interception des logs
    useEffect(() => {
        const addLog = (level: LogEntry['level'], args: any[]) => {
            const timestamp = new Date().toISOString();
            const message = args.map(arg => 
                typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
            ).join(' ');

            const logEntry: LogEntry = {
                timestamp,
                level,
                message,
                stack: level === 'error' ? new Error().stack : undefined,
            };

            logBuffer.push(logEntry);
            if (logBuffer.length > MAX_LOGS) {
                logBuffer = logBuffer.slice(-MAX_LOGS);
            }
        };

        // Intercepter console.log
        console.log = (...args) => {
            originalConsole.log(...args);
            addLog('info', args);
        };

        // Intercepter console.warn
        console.warn = (...args) => {
            originalConsole.warn(...args);
            addLog('warn', args);
        };

        // Intercepter console.error
        console.error = (...args) => {
            originalConsole.error(...args);
            addLog('error', args);
        };

        // Intercepter console.debug
        console.debug = (...args) => {
            originalConsole.debug(...args);
            addLog('debug', args);
        };

        return () => {
            // Restaurer les console originaux
            console.log = originalConsole.log;
            console.warn = originalConsole.warn;
            console.error = originalConsole.error;
            console.debug = originalConsole.debug;
        };
    }, []);

    // Mettre à jour les logs affichés
    useEffect(() => {
        if (visible) {
            const interval = setInterval(() => {
                setLogs([...logBuffer]);
            }, 500);
            return () => clearInterval(interval);
        }
    }, [visible]);

    // Auto-scroll
    useEffect(() => {
        if (autoScroll && scrollViewRef.current) {
            scrollViewRef.current.scrollToEnd({ animated: true });
        }
    }, [logs, autoScroll]);

    const filteredLogs = filter === 'all' 
        ? logs 
        : logs.filter(log => log.level === filter);

    const formatTimestamp = (timestamp: string) => {
        const date = new Date(timestamp);
        return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}.${date.getMilliseconds().toString().padStart(3, '0')}`;
    };

    const getLogColor = (level: LogEntry['level']) => {
        switch (level) {
            case 'error': return '#EF4444';
            case 'warn': return '#F59E0B';
            case 'debug': return '#8B5CF6';
            case 'info':
            default: return '#10B981';
        }
    };

    const getLogIcon = (level: LogEntry['level']) => {
        switch (level) {
            case 'error': return 'close-circle';
            case 'warn': return 'warning';
            case 'debug': return 'bug';
            case 'info':
            default: return 'information-circle';
        }
    };

    // Copier tous les logs dans le presse-papier
    const copyAllLogs = async () => {
        const logText = filteredLogs.map(log => 
            `[${formatTimestamp(log.timestamp)}] [${log.level.toUpperCase()}] ${log.message}${log.stack ? '\n' + log.stack : ''}`
        ).join('\n\n');

        await Clipboard.setStringAsync(logText);
        Alert.alert('✅ Copié !', `${filteredLogs.length} logs copiés dans le presse-papier`);
    };

    // Partager les logs
    const shareLogs = async () => {
        const logText = filteredLogs.map(log => 
            `[${formatTimestamp(log.timestamp)}] [${log.level.toUpperCase()}] ${log.message}${log.stack ? '\n' + log.stack : ''}`
        ).join('\n\n');

        const deviceInfo = `
═══════════════════════════════════════
YUKPOMNANG - DEBUG LOGS
═══════════════════════════════════════
Date: ${new Date().toLocaleString()}
Platform: ${Platform.OS} ${Platform.Version}
Total logs: ${filteredLogs.length}
Filter: ${filter}
═══════════════════════════════════════

${logText}
        `;

        try {
            await Share.share({
                message: deviceInfo,
                title: 'Yukpomnang Debug Logs',
            });
        } catch (error) {
            console.error('Erreur lors du partage:', error);
        }
    };

    // Exporter au format JSON
    const exportJSON = async () => {
        const jsonData = JSON.stringify({
            exportDate: new Date().toISOString(),
            platform: Platform.OS,
            version: Platform.Version,
            totalLogs: filteredLogs.length,
            filter,
            logs: filteredLogs,
        }, null, 2);

        await Clipboard.setStringAsync(jsonData);
        Alert.alert('✅ JSON Copié !', 'Format JSON copié dans le presse-papier');
    };

    // Effacer les logs
    const clearLogs = () => {
        Alert.alert(
            '⚠️ Confirmation',
            'Effacer tous les logs ?',
            [
                { text: 'Annuler', style: 'cancel' },
                { 
                    text: 'Effacer', 
                    style: 'destructive',
                    onPress: () => {
                        logBuffer = [];
                        setLogs([]);
                    }
                },
            ]
        );
    };

    const logCounts = {
        all: logs.length,
        info: logs.filter(l => l.level === 'info').length,
        warn: logs.filter(l => l.level === 'warn').length,
        error: logs.filter(l => l.level === 'error').length,
        debug: logs.filter(l => l.level === 'debug').length,
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={false}
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Ionicons name="close" size={24} color="#FFF" />
                    </TouchableOpacity>
                    <Text style={styles.title}>🐛 Debug Panel</Text>
                    <TouchableOpacity 
                        onPress={() => setAutoScroll(!autoScroll)}
                        style={[styles.autoScrollButton, autoScroll && styles.autoScrollActive]}
                    >
                        <Ionicons 
                            name={autoScroll ? "arrow-down" : "pause"} 
                            size={20} 
                            color="#FFF" 
                        />
                    </TouchableOpacity>
                </View>

                {/* Filtres */}
                <View style={styles.filterContainer}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {(['all', 'error', 'warn', 'info', 'debug'] as const).map((level) => (
                            <TouchableOpacity
                                key={level}
                                onPress={() => setFilter(level)}
                                style={[
                                    styles.filterButton,
                                    filter === level && styles.filterButtonActive,
                                ]}
                            >
                                <Text style={[
                                    styles.filterButtonText,
                                    filter === level && styles.filterButtonTextActive,
                                ]}>
                                    {level.toUpperCase()} ({logCounts[level]})
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* Actions rapides */}
                <View style={styles.actionsContainer}>
                    <TouchableOpacity 
                        onPress={copyAllLogs} 
                        style={[styles.actionButton, styles.copyButton]}
                    >
                        <Ionicons name="copy" size={18} color="#FFF" />
                        <Text style={styles.actionButtonText}>Copier</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        onPress={shareLogs} 
                        style={[styles.actionButton, styles.shareButton]}
                    >
                        <Ionicons name="share-social" size={18} color="#FFF" />
                        <Text style={styles.actionButtonText}>Partager</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        onPress={exportJSON} 
                        style={[styles.actionButton, styles.jsonButton]}
                    >
                        <Ionicons name="code-slash" size={18} color="#FFF" />
                        <Text style={styles.actionButtonText}>JSON</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        onPress={clearLogs} 
                        style={[styles.actionButton, styles.clearButton]}
                    >
                        <Ionicons name="trash" size={18} color="#FFF" />
                        <Text style={styles.actionButtonText}>Effacer</Text>
                    </TouchableOpacity>
                </View>

                {/* Liste des logs */}
                <ScrollView 
                    ref={scrollViewRef}
                    style={styles.logsContainer}
                    onScroll={(e) => {
                        const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
                        const isAtBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - 50;
                        if (!isAtBottom && autoScroll) {
                            setAutoScroll(false);
                        }
                    }}
                    scrollEventThrottle={400}
                >
                    {filteredLogs.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Ionicons name="document-text-outline" size={64} color="#9CA3AF" />
                            <Text style={styles.emptyStateText}>Aucun log pour le moment</Text>
                            <Text style={styles.emptyStateSubtext}>
                                Les logs apparaîtront ici automatiquement
                            </Text>
                        </View>
                    ) : (
                        filteredLogs.map((log, index) => (
                            <TouchableOpacity
                                key={index}
                                onLongPress={async () => {
                                    await Clipboard.setStringAsync(log.message);
                                    Alert.alert('✅ Copié !', 'Ce log a été copié');
                                }}
                                style={styles.logEntry}
                            >
                                <View style={styles.logHeader}>
                                    <Ionicons 
                                        name={getLogIcon(log.level) as any}
                                        size={16}
                                        color={getLogColor(log.level)}
                                    />
                                    <Text style={[styles.logLevel, { color: getLogColor(log.level) }]}>
                                        {log.level.toUpperCase()}
                                    </Text>
                                    <Text style={styles.logTimestamp}>
                                        {formatTimestamp(log.timestamp)}
                                    </Text>
                                </View>
                                <Text style={styles.logMessage}>{log.message}</Text>
                                {log.stack && (
                                    <Text style={styles.logStack}>{log.stack}</Text>
                                )}
                            </TouchableOpacity>
                        ))
                    )}
                </ScrollView>

                {/* Info footer */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>
                        📋 {filteredLogs.length} logs • 
                        💾 Maintenez appuyé sur un log pour le copier • 
                        🔄 Auto-scroll: {autoScroll ? 'ON' : 'OFF'}
                    </Text>
                </View>
            </View>
        </Modal>
    );
};

// Hook pour activer/désactiver le debug panel
export const useDebugPanel = () => {
    const [visible, setVisible] = useState(false);

    const show = () => setVisible(true);
    const hide = () => setVisible(false);
    const toggle = () => setVisible(prev => !prev);

    return { visible, show, hide, toggle };
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1F2937',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 50 : 20,
        paddingBottom: 12,
        backgroundColor: '#111827',
        borderBottomWidth: 1,
        borderBottomColor: '#374151',
    },
    closeButton: {
        padding: 8,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FFF',
        flex: 1,
        textAlign: 'center',
    },
    autoScrollButton: {
        padding: 8,
        backgroundColor: '#374151',
        borderRadius: 6,
    },
    autoScrollActive: {
        backgroundColor: '#6366F1',
    },
    filterContainer: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: '#111827',
        borderBottomWidth: 1,
        borderBottomColor: '#374151',
    },
    filterButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        marginRight: 8,
        backgroundColor: '#374151',
        borderRadius: 6,
    },
    filterButtonActive: {
        backgroundColor: '#6366F1',
    },
    filterButtonText: {
        color: '#9CA3AF',
        fontSize: 12,
        fontWeight: '600',
    },
    filterButtonTextActive: {
        color: '#FFF',
    },
    actionsContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#111827',
        borderBottomWidth: 1,
        borderBottomColor: '#374151',
        gap: 8,
    },
    actionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 6,
        gap: 6,
    },
    copyButton: {
        backgroundColor: '#10B981',
    },
    shareButton: {
        backgroundColor: '#3B82F6',
    },
    jsonButton: {
        backgroundColor: '#8B5CF6',
    },
    clearButton: {
        backgroundColor: '#EF4444',
    },
    actionButtonText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '600',
    },
    logsContainer: {
        flex: 1,
        paddingHorizontal: 12,
    },
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 100,
    },
    emptyStateText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#9CA3AF',
        marginTop: 16,
    },
    emptyStateSubtext: {
        fontSize: 14,
        color: '#6B7280',
        marginTop: 8,
    },
    logEntry: {
        backgroundColor: '#374151',
        borderRadius: 6,
        padding: 12,
        marginVertical: 4,
        borderLeftWidth: 3,
        borderLeftColor: '#6B7280',
    },
    logHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
        gap: 8,
    },
    logLevel: {
        fontSize: 12,
        fontWeight: 'bold',
    },
    logTimestamp: {
        fontSize: 11,
        color: '#9CA3AF',
        marginLeft: 'auto',
    },
    logMessage: {
        fontSize: 13,
        color: '#F3F4F6',
        lineHeight: 18,
    },
    logStack: {
        fontSize: 11,
        color: '#9CA3AF',
        marginTop: 8,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    footer: {
        padding: 12,
        backgroundColor: '#111827',
        borderTopWidth: 1,
        borderTopColor: '#374151',
    },
    footerText: {
        fontSize: 11,
        color: '#9CA3AF',
        textAlign: 'center',
    },
});

