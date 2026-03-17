/**
 * ErrorBoundaryWithRetry - Error Boundary avec retry automatique
 * Niveau géant: Gestion d'erreur robuste avec récupération automatique
 */

import React, { Component, ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Sentry from 'sentry-expo';
import { modernColors } from '../theme/modernTheme';
import { NativeButton } from './SafeNativeDesign';
import SafeIcon from './SafeIcon';
import { useLanguageSafe } from '../contexts/LanguageContext';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    onRetry?: () => void;
    maxRetries?: number;
    retryDelay?: number; // ms
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: any;
    retryCount: number;
    isRetrying: boolean;
}

export class ErrorBoundaryWithRetry extends Component<Props, State> {
    private retryTimeoutId: NodeJS.Timeout | null = null;

    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
            retryCount: 0,
            isRetrying: false,
        };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return {
            hasError: true,
            error,
        };
    }

    componentDidCatch(error: Error, errorInfo: any) {
        console.error('[ErrorBoundaryWithRetry] Error caught:', error, errorInfo);

        // Envoyer à Sentry en production
        if (__DEV__ === false) {
            Sentry.Native.captureException(error, { extra: errorInfo });
        }

        this.setState({
            error,
            errorInfo,
        });

        // ✅ NOUVEAU: Retry automatique avec exponential backoff
        const { maxRetries = 3, retryDelay = 2000 } = this.props;

        if (this.state.retryCount < maxRetries) {
            this.scheduleAutoRetry();
        }
    }

    scheduleAutoRetry = () => {
        const { retryDelay = 2000, maxRetries = 3 } = this.props;
        const delay = retryDelay * Math.pow(2, this.state.retryCount); // Exponential backoff

        if (this.retryTimeoutId) {
            clearTimeout(this.retryTimeoutId);
        }

        this.setState({ isRetrying: true });

        this.retryTimeoutId = setTimeout(() => {
            this.handleRetry();
        }, delay);
    };

    handleRetry = () => {
        const { onRetry, maxRetries = 3 } = this.props;

        if (this.state.retryCount >= maxRetries) {
            this.setState({ isRetrying: false });
            return;
        }

        this.setState(
            (prevState) => ({
                hasError: false,
                error: null,
                errorInfo: null,
                retryCount: prevState.retryCount + 1,
                isRetrying: false,
            }),
            () => {
                // Appeler le callback de retry si fourni
                if (onRetry) {
                    onRetry();
                }
            }
        );
    };

    handleManualRetry = () => {
        if (this.retryTimeoutId) {
            clearTimeout(this.retryTimeoutId);
            this.retryTimeoutId = null;
        }
        this.handleRetry();
    };

    componentWillUnmount() {
        if (this.retryTimeoutId) {
            clearTimeout(this.retryTimeoutId);
        }
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            const { error, errorInfo, retryCount, isRetrying } = this.state;
            const { maxRetries = 3 } = this.props;
            const canRetry = retryCount < maxRetries;

            return (
                <View style={styles.container}>
                    <View style={styles.content}>
                        <View style={styles.iconContainer}>
                            <SafeIcon name="alert-circle" size={64} color={modernColors.error} />
                        </View>

                        <Text style={styles.title}>{t('errorBoundaryWithRetry.oupsUneErreurSestProduite')}</Text>

                        <Text style={styles.message}>
                            Lt('errorBoundaryWithRetry.applicationARencontreUneErreurInattenduecanretry')errorBoundaryWithRetry.tentativeDeRecuperationAutomatique') : ''}
                        </Text>

                        {isRetrying && (
                            <View style={styles.retryInfo}>
                                <Text style={styles.retryText}>
                                    Réessai automatique dans quelques instants... ({String(retryCount + 1)}/{String(maxRetries)})
                                </Text>
                            </View>
                        )}

                        {__DEV__ && error && (
                            <View style={styles.debugContainer}>
                                <Text style={styles.debugTitle}>Debug Info:</Text>
                                <Text style={styles.debugText} numberOfLines={3}>
                                    {error.message}
                                </Text>
                                {errorInfo?.componentStack && (
                                    <Text style={styles.debugText} numberOfLines={5}>
                                        {errorInfo.componentStack}
                                    </Text>
                                )}
                            </View>
                        )}

                        <View style={styles.actions}>
                            {canRetry && !isRetrying && (
                                <NativeButton
                                    title={t('errorBoundaryWithRetry.reessayerMaintenant')}
                                    onPress={this.handleManualRetry}
                                    variant="primary"
                                    size="large"
                                    style={styles.retryButton}
                                />
                            )}

                            <NativeButton
                                title={t('errorBoundaryWithRetry.retourAL')}accueil"
                                onPress={() => {
                                    // Navigation sera gérée par le parent
                                    this.setState({
                                        hasError: false,
                                        error: null,
                                        errorInfo: null,
                                    });
                                }}
                                variant="outline"
                                size="large"
                                style={styles.homeButton}
                            />
                        </View>

                        {!canRetry && (
                            <Text style={styles.maxRetriesText}>
                                Nombre maximum de tentatives atteint. Veuillez redémarrer l'application.
                            </Text>
                        )}
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
        backgroundColor: modernColors.background,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    content: {
        maxWidth: 400,
        width: '100%',
        alignItems: 'center',
    },
    iconContainer: {
        marginBottom: 24,
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: modernColors.text,
        textAlign: 'center',
        marginBottom: 12,
    },
    message: {
        fontSize: 16,
        color: modernColors.textSecondary,
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 24,
    },
    retryInfo: {
        backgroundColor: modernColors.info + '20',
        padding: 12,
        borderRadius: 8,
        marginBottom: 24,
    },
    retryText: {
        fontSize: 14,
        color: modernColors.info,
        textAlign: 'center',
        fontWeight: '500',
    },
    debugContainer: {
        width: '100%',
        backgroundColor: modernColors.surface,
        padding: 16,
        borderRadius: 8,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    debugTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: modernColors.text,
        marginBottom: 8,
    },
    debugText: {
        fontSize: 12,
        color: modernColors.textSecondary,
        fontFamily: 'monospace',
        marginBottom: 4,
    },
    actions: {
        width: '100%',
        gap: 12,
    },
    retryButton: {
        width: '100%',
    },
    homeButton: {
        width: '100%',
    },
    maxRetriesText: {
        fontSize: 14,
        color: modernColors.error,
        textAlign: 'center',
        marginTop: 16,
        fontWeight: '600',
    },
});

