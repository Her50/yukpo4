import { Component, ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
// Utilisation de SafeIcon pour éviter les crashes d'import
import { SafeIcon } from './SafeIcon';
import { debugLogger } from '../utils/DebugLogger';
import CrashRecoveryScreen from './CrashRecoveryScreen';
import EmergencyDebugScreen from './EmergencyDebugScreen';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
    showCrashRecovery: boolean;
    showEmergencyDebug: boolean;
}

class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, showCrashRecovery: false };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, showCrashRecovery: false };
    }

    componentDidCatch(error: Error, errorInfo: any) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);

        // Logger l'erreur dans le système de debug
        debugLogger.crash('ErrorBoundary', 'Application crashed', error, errorInfo);

        // Afficher automatiquement l'écran de récupération après un délai
        setTimeout(() => {
            this.setState({ showCrashRecovery: true });
        }, 1000);
    }

    handleRetry = () => {
        debugLogger.log('ErrorBoundary', 'User requested retry');
        this.setState({ hasError: false, error: undefined, showCrashRecovery: false });
    };

    handleShowCrashRecovery = () => {
        this.setState({ showCrashRecovery: true });
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <View style={styles.container}>
                <View style={styles.errorCard}>
                    <SafeIcon name="warning" size={48} color="#DC2626" type="phosphor" />

                    <Text style={styles.errorTitle}>Oups ! Une erreur s'est produite</Text>

                        <Text style={styles.errorMessage}>
                            L'application a rencontré une erreur inattendue. Veuillez redémarrer l'application ou contacter le support si le problème persiste.
                        </Text>

                        {true && this.state.error && ( // TOUJOURS AFFICHER EN PRODUCTION
                            <View style={styles.debugInfo}>
                                <Text style={styles.debugTitle}>Debug Info:</Text>
                                <Text style={styles.debugText}>{this.state.error.message}</Text>
                                <Text style={styles.debugText}>{this.state.error.stack}</Text>
                            </View>
                        )}

                        <View style={styles.buttonContainer}>
                            <TouchableOpacity
                                style={styles.retryButton}
                                onPress={this.handleRetry}
                            >
                                <SafeIcon name="arrow-clockwise" size={20} color="#FFF" type="phosphor" />
                                <Text style={styles.retryButtonText}>Redémarrer</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.reportButton}
                                onPress={this.handleShowCrashRecovery}
                            >
                                <SafeIcon name="bug" size={20} color="#6366F1" type="phosphor" />
                                <Text style={styles.reportButtonText}>Debug</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            );
        }

        return (
            <>
                {this.props.children}
                {this.state.showCrashRecovery && (
                    <CrashRecoveryScreen
                        error={this.state.error}
                        onRetry={this.handleRetry}
                        onContinue={() => this.setState({ showCrashRecovery: false })}
                    />
                )}
            </>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    errorCard: {
        backgroundColor: '#FFF',
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
        maxWidth: 400,
        width: '100%',
    },
    errorIcon: {
        fontSize: 48,
        marginBottom: 16,
        textAlign: 'center',
    },
    retryButtonIcon: {
        fontSize: 20,
        marginRight: 8,
    },
    reportButtonIcon: {
        fontSize: 20,
        marginRight: 8,
    },
    errorTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1A1A1A',
        marginBottom: 12,
        textAlign: 'center',
    },
    errorMessage: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 24,
    },
    debugInfo: {
        backgroundColor: '#F8F9FA',
        padding: 12,
        borderRadius: 8,
        marginBottom: 24,
        width: '100%',
    },
    debugTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 8,
    },
    debugText: {
        fontSize: 12,
        color: '#666',
        fontFamily: 'monospace',
    },
    buttonContainer: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    retryButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#6366F1',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        gap: 8,
    },
    retryButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
    },
    reportButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F0F0F0',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        gap: 8,
    },
    reportButtonText: {
        color: '#6366F1',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default ErrorBoundary;