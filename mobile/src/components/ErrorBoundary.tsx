import React, { Component, ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
// Migration vers Phosphor React Native pour un design moderne
import { ArrowClockwise, Bug, Warning } from 'phosphor-react-native';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: any) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: undefined });
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <View style={styles.container}>
                    <View style={styles.errorCard}>
                        <Warning size={48} color="#DC2626" />

                        <Text style={styles.errorTitle}>Oups ! Une erreur s'est produite</Text>

                        <Text style={styles.errorMessage}>
                            L'application a rencontré une erreur inattendue. Veuillez redémarrer l'application ou contacter le support si le problème persiste.
                        </Text>

                        {true && this.state.error && ( // TOUJOURS AFFICHER EN PRODUCTION
                            <View style={styles.debugInfo}>
                                <Text style={styles.debugTitle}>Debug Info:</Text>
                                <Text style={styles.debugText}>{this.state.error.message}</Text>
                                <Text style={styles.debugText}>{this.state.error.stack || 'No stack trace available'}</Text>
                            </View>
                        )}

                        <View style={styles.buttonContainer}>
                            <TouchableOpacity
                                style={styles.retryButton}
                                onPress={this.handleRetry}
                            >
                                <ArrowClockwise size={20} color="#FFF" />
                                <Text style={styles.retryButtonText}>Redémarrer</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.reportButton}
                                onPress={() => {
                                    // TODO: Implémenter le signalement d'erreur
                                    console.log('Report error:', this.state.error);
                                }}
                            >
                                <Bug size={20} color="#6366F1" />
                                <Text style={styles.reportButtonText}>Signaler</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            );
        }

        return this.props.children;
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