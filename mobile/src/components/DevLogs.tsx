import React, { useEffect, useState } from 'react';
import { Alert, Clipboard, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface LogEntry {
    timestamp: string;
    level: 'info' | 'warn' | 'error';
    message: string;
}

const DevLogs: React.FC = () => {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [isVisible, setIsVisible] = useState(true);
    const [isMinimized, setIsMinimized] = useState(false);

    // Fonction pour copier tous les logs
    const copyAllLogs = () => {
        const logsText = logs.map(log =>
            `[${log.timestamp}] ${log.message}`
        ).join('\n');

        Clipboard.setString(logsText);
        Alert.alert('✅ Logs copiés', `${logs.length} logs copiés dans le presse-papier`);
    };

    useEffect(() => {
        // Intercepter console.log
        const originalLog = console.log;
        const originalWarn = console.warn;
        const originalError = console.error;

        console.log = (...args: any[]) => {
            originalLog(...args);
            const message = args.map(arg =>
                typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
            ).join(' ');

            // Capturer les logs importants
            if (message.includes('[AuthContext]') ||
                message.includes('[AppNavigator]') ||
                message.includes('[LoginScreen]') ||
                message.includes('[Mobile API]') ||
                message.includes('ERROR') ||
                message.includes('Error')) {
                setLogs(prev => [...prev.slice(-50), {
                    timestamp: new Date().toLocaleTimeString(),
                    level: 'info',
                    message: message.substring(0, 200) // Limiter la longueur
                }]);
            }
        };

        console.error = (...args: any[]) => {
            originalError(...args);
            setLogs(prev => [...prev.slice(-50), {
                timestamp: new Date().toLocaleTimeString(),
                level: 'error',
                message: args.join(' ').substring(0, 200)
            }]);
        };

        console.warn = (...args: any[]) => {
            originalWarn(...args);
            setLogs(prev => [...prev.slice(-50), {
                timestamp: new Date().toLocaleTimeString(),
                level: 'warn',
                message: args.join(' ').substring(0, 200)
            }]);
        };

        return () => {
            console.log = originalLog;
            console.warn = originalWarn;
            console.error = originalError;
        };
    }, []);

    if (!isVisible) {
        return (
            <TouchableOpacity
                style={styles.showButton}
                onPress={() => setIsVisible(true)}
            >
                <Text style={styles.showButtonText}>📋 Logs ({logs.length})</Text>
            </TouchableOpacity>
        );
    }

    if (isMinimized) {
        return (
            <View style={styles.minimizedContainer}>
                <TouchableOpacity
                    style={styles.minimizedHeader}
                    onPress={() => setIsMinimized(false)}
                >
                    <Text style={styles.minimizedTitle}>
                        📋 Logs ({logs.length}) - Cliquez pour agrandir
                    </Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>📋 Dev Logs ({logs.length})</Text>
                <View style={styles.buttons}>
                    <TouchableOpacity
                        style={styles.button}
                        onPress={copyAllLogs}
                        disabled={logs.length === 0}
                    >
                        <Text style={styles.buttonText}>📋</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.button}
                        onPress={() => setIsMinimized(true)}
                    >
                        <Text style={styles.buttonText}>−</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.button}
                        onPress={() => setLogs([])}
                    >
                        <Text style={styles.buttonText}>🗑️</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.button}
                        onPress={() => setIsVisible(false)}
                    >
                        <Text style={styles.buttonText}>✕</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView
                style={styles.scrollView}
                automaticallyAdjustContentInsets={false}
            >
                {logs.length === 0 ? (
                    <Text style={styles.emptyText}>
                        En attente de logs...
                        {'\n'}Essayez de vous connecter pour voir les logs.
                    </Text>
                ) : (
                    logs.map((log, index) => (
                        <View key={index} style={styles.logEntry}>
                            <Text style={styles.timestamp}>{log.timestamp}</Text>
                            <Text style={[
                                styles.message,
                                log.level === 'error' && styles.error,
                                log.level === 'warn' && styles.warn
                            ]}>
                                {log.message}
                            </Text>
                        </View>
                    ))
                )}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    showButton: {
        position: 'absolute',
        bottom: 20,
        right: 20,
        backgroundColor: '#4CAF50',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        zIndex: 9999,
    },
    showButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
    },
    minimizedContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0,0,0,0.95)',
        borderTopWidth: 2,
        borderTopColor: '#4CAF50',
        zIndex: 9999,
    },
    minimizedHeader: {
        padding: 12,
    },
    minimizedTitle: {
        color: '#4CAF50',
        fontSize: 12,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    container: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 250,
        backgroundColor: 'rgba(0,0,0,0.95)',
        borderTopWidth: 2,
        borderTopColor: '#4CAF50',
        zIndex: 9999,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    title: {
        color: '#4CAF50',
        fontSize: 14,
        fontWeight: 'bold',
    },
    buttons: {
        flexDirection: 'row',
        gap: 8,
    },
    button: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        backgroundColor: '#333',
        borderRadius: 4,
    },
    buttonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
    },
    scrollView: {
        flex: 1,
    },
    emptyText: {
        color: '#888',
        fontSize: 12,
        padding: 16,
        textAlign: 'center',
    },
    logEntry: {
        padding: 6,
        borderBottomWidth: 1,
        borderBottomColor: '#222',
    },
    timestamp: {
        color: '#888',
        fontSize: 10,
        marginBottom: 2,
    },
    message: {
        color: '#0f0',
        fontSize: 11,
        fontFamily: 'monospace',
    },
    error: {
        color: '#f44',
    },
    warn: {
        color: '#fa0',
    },
});

export default DevLogs;

