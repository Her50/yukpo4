/**
 * ErrorBoundaryWithRetry - Error Boundary avec retry automatique
 * Niveau géant: Gestion d'erreur robuste avec récupération automatique
 */

import * as Clipboard from 'expo-clipboard';
import React, { Component, ReactNode } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { modernColors } from '../theme/modernTheme';
import { NativeButton } from './SafeNativeDesign';
import SafeIcon from './SafeIcon';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    onRetry?: () => void;
    maxRetries?: number;
    retryDelay?: number; // ms
    /** Si true : affiche stack complète + bouton copier (même en prod) — ex. écran Mes services */
    diagnosticsReport?: boolean;
    /** Libellé inclus dans le rapport copié */
    reportScreenLabel?: string;
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

        if (__DEV__ === false) {
            try {
                const Sentry = require('sentry-expo');
                Sentry?.Native?.captureException?.(error, { extra: errorInfo });
            } catch {}
        }

        this.setState({
            error,
            errorInfo,
        });

        // Retry auto (sauf mode diagnostic : l'utilisateur doit pouvoir lire / copier l'erreur)
        const { maxRetries = 3, diagnosticsReport } = this.props;
        if (!diagnosticsReport && this.state.retryCount < maxRetries) {
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
        const { onRetry, diagnosticsReport, maxRetries = 3 } = this.props;
        if (diagnosticsReport || maxRetries === 0) {
            this.setState(
                {
                    hasError: false,
                    error: null,
                    errorInfo: null,
                    retryCount: 0,
                    isRetrying: false,
                },
                () => {
                    if (onRetry) onRetry();
                },
            );
            return;
        }
        this.handleRetry();
    };

    copyFullReport = async () => {
        const { error, errorInfo } = this.state;
        const label = this.props.reportScreenLabel || 'Screen';
        const body = [
            '══════════════════════════════════════',
            'YUKPO — RAPPORT D\'ERREUR (copie support)',
            '══════════════════════════════════════',
            `Écran: ${label}`,
            `Date: ${new Date().toISOString()}`,
            `Plateforme: ${Platform.OS} ${String(Platform.Version)}`,
            '',
            '— Message —',
            error?.message || '(vide)',
            '',
            '— Stack JS —',
            error?.stack || '(vide)',
            '',
            '— Component stack —',
            errorInfo?.componentStack || '(vide)',
            '══════════════════════════════════════',
        ].join('\n');
        try {
            await Clipboard.setStringAsync(body);
            Alert.alert('Copié', "Le rapport a été copié. Collez-le dans un message pour l'équipe.");
        } catch {
            Alert.alert('Erreur', "Impossible de copier. Faites une capture d'écran.");
        }
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
            const { maxRetries = 3, diagnosticsReport } = this.props;
            const canRetry = retryCount < maxRetries;

            if (diagnosticsReport && error) {
                return (
                    <View style={styles.diagRoot}>
                        <View style={styles.diagHeader}>
                            <SafeIcon name="alert-circle" size={48} color="#FFF" />
                            <Text style={styles.diagTitle}>Erreur — Mes services</Text>
                            <Text style={styles.diagSubtitle}>
                                Touchez le bouton bleu pour copier tout le rapport d'un seul coup, puis envoyez-le au support.'
                            </Text>
                        </View>
                        <TouchableOpacity style={styles.diagCopyBig} onPress={this.copyFullReport} activeOpacity={0.85}>
                            <Text style={styles.diagCopyBigText}>📋 Copier le rapport (1 clic)</Text>
                        </TouchableOpacity>
                        <ScrollView style={styles.diagScroll} contentContainerStyle={styles.diagScrollInner}>
                            <Text style={styles.diagLabel}>Message</Text>
                            <Text style={styles.diagMono} selectable>{error.message}</Text>
                            <Text style={styles.diagLabel}>Stack</Text>
                            <Text style={styles.diagMono} selectable>{error.stack || '(non disponible)'}</Text>
                            {!!errorInfo?.componentStack && (
                                <>
                                    <Text style={styles.diagLabel}>Composants</Text>
                                    <Text style={styles.diagMono} selectable>{errorInfo.componentStack}</Text>
                                </>
                            )}
                        </ScrollView>
                        <View style={styles.diagFooter}>
                            <NativeButton
                                title="🔄 Réessayer"
                                onPress={this.handleManualRetry}
                                variant="primary"
                                size="large"
                                style={styles.retryButton}
                            />
                        </View>
                    </View>
                );
            }

            return (
                <View style={styles.container}>
                    <View style={styles.content}>
                        <View style={styles.iconContainer}>
                            <SafeIcon name="alert-circle" size={64} color={modernColors.error} />
                        </View>

                        <Text style={styles.title}>Oups ! Une erreur s'est produite</Text>'

                        <Text style={styles.message}>
                            L'application a rencontré une erreur inattendue.{canRetry ? ' Tentative de récupération automatique...' : ''}'
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
                                    title="🔄 Réessayer maintenant"
                                    onPress={this.handleManualRetry}
                                    variant="primary"
                                    size="large"
                                    style={styles.retryButton}
                                />
                            )}

                            <NativeButton
                                title="🏠 Retour à l'accueil"
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
                                Nombre maximum de tentatives atteint. Veuillez redémarrer l'application.'
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
    diagRoot: {
        flex: 1,
        backgroundColor: '#0f172a',
        paddingTop: Platform.OS === 'ios' ? 54 : 32,
    },
    diagHeader: {
        paddingHorizontal: 20,
        paddingBottom: 12,
        alignItems: 'center',
    },
    diagTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#f8fafc',
        marginTop: 12,
        textAlign: 'center',
    },
    diagSubtitle: {
        fontSize: 14,
        color: '#94a3b8',
        marginTop: 8,
        textAlign: 'center',
        lineHeight: 20,
    },
    diagCopyBig: {
        marginHorizontal: 16,
        marginBottom: 12,
        backgroundColor: '#2563eb',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    diagCopyBigText: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '700',
    },
    diagScroll: { flex: 1 },
    diagScrollInner: { padding: 16, paddingBottom: 32 },
    diagLabel: {
        color: '#64748b',
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
        marginBottom: 6,
        marginTop: 12,
    },
    diagMono: {
        color: '#e2e8f0',
        fontSize: 12,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        lineHeight: 18,
    },
    diagFooter: { padding: 16, paddingBottom: 24, backgroundColor: '#0f172a' },
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

