import { Component, ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Sentry from 'sentry-expo';
import i18n from '../i18n';

const t = (key: string, options?: any) => {
    try {
        return i18n.t(key, options) || key;
    } catch {
        return key;
    }
};

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
        // ✅ AMÉLIORATION: Logging détaillé avec contexte
        const detailedError = {
            message: error?.message,
            stack: error?.stack,
            componentStack: errorInfo?.componentStack,
            errorInfo,
            timestamp: new Date().toISOString(),
            platform: require('react-native').Platform.OS,
        };

        console.error('🚨 [ErrorBoundary] Erreur capturée:', detailedError);

        // ✅ AMÉLIORATION: Logger les composants suspects si disponible
        try {
            const { componentDebugger } = require('../utils/componentDebugger');
            const problematicLogs = componentDebugger.getProblematicLogs();
            if (problematicLogs.length > 0) {
                const errorMessage = t('errorBoundary.errorboundaryComposantsAvecChildrenPrimitifsDetect', { problematicLogs_length: problematicLogs.length });
                console.error(errorMessage, problematicLogs);

                // ✅ CRITIQUE: Envoyer au backend via remoteLoggingService
                try {
                    const { remoteLoggingService } = require('../services/remoteLoggingService');
                    remoteLoggingService.error(
                        errorMessage,
                        'ErrorBoundary',
                        { problematicLogs },
                        error?.stack
                    );
                } catch (e) {
                    // Ignorer si le service n'est pas disponible
                }
            }
        } catch (e) {
            // Ignorer si le debugger n'est pas disponible
        }

        try {
            Sentry.Native?.captureException?.(error, { extra: detailedError });
        } catch (sentryError) {
            console.warn('[ErrorBoundary] Sentry non disponible:', sentryError);
        }
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: undefined });
    };

    render() {
        if (this.state.hasError) {
            // ✅ AMÉLIORÉ: Logger l'erreur pour debugging
            console.error('[ErrorBoundary] 🚨 Erreur capturée, affichage du fallback:', {
                error: this.state.error?.message,
                hasFallback: !!this.props.fallback,
                stack: this.state.error?.stack
            });

            if (this.props.fallback) {
                // ✅ CRITIQUE: S'assurer que le fallback permet les interactions
                return (
                    <View style={{ flex: 1 }} pointerEvents="box-none">
                        {this.props.fallback}
                    </View>
                );
            }

            return (
                <View style={styles.container}>
                    <View style={styles.errorCard}>
                        <Text style={styles.errorIcon}>⚠️</Text>

                        <Text style={styles.errorTitle}>{t('errorBoundary.oupsUneErreurSestProduite')}</Text>

                        <Text style={styles.errorMessage}>
                            {t('errorBoundary.unexpectedErrorMessage')}
                        </Text>

                        {true && this.state.error && ( // TOUJOURS AFFICHER EN PRODUCTION
                            <View style={styles.debugInfo}>
                                <Text style={styles.debugTitle}>Debug Info:</Text>
                                <Text style={styles.debugText}>{String(this.state.error.message || 'No error message')}</Text>
                                <Text style={styles.debugText}>{String(this.state.error.stack || 'No stack trace available')}</Text>
                            </View>
                        )}

                        <View style={styles.buttonContainer}>
                            <TouchableOpacity
                                style={styles.retryButton}
                                onPress={this.handleRetry}
                            >
                                <Text style={styles.buttonIcon}>🔄</Text>
                                <Text style={styles.retryButtonText}>{t('errorBoundary.redemarrer')}</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.reportButton}
                                onPress={() => {
                                    if (this.state.error) {
                                        try {
                                            Sentry.Native?.captureException?.(this.state.error, {
                                                extra: { origin: 'ErrorBoundaryUserReport' },
                                            });
                                        } catch (e) { /* Sentry indisponible */ }
                                    }
                                    console.log('Report error:', this.state.error);
                                }}
                            >
                                <Text style={styles.buttonIcon}>🐛</Text>
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
    buttonIcon: {
        fontSize: 20,
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