import React, { Component, ErrorInfo, ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import SafeIcon from './SafeIcon';
import { useLanguageSafe } from '../contexts/LanguageContext';

interface Props {
    children: ReactNode;
    productId?: string;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

/**
 * ✅ OPTIMISATION 7: Error Boundary pour ProductCard
 * Empêche un crash d'un ProductCard de bloquer toute la liste
 */
class ProductCardErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // Log l'erreur pour debug/monitoring
        console.error('❌ [ProductCardErrorBoundary] Erreur capturée:', {
            product_id: this.props.productId,
            error: error.message,
            stack: error.stack,
            componentStack: errorInfo.componentStack
        });

        // Appeler le callback d'erreur si fourni
        if (this.props.onError) {
            this.props.onError(error, errorInfo);
        }

        // ✅ Envoyer à Sentry si disponible
        try {
            const Sentry = require('@sentry/react-native');
            if (Sentry && typeof Sentry.captureException === 'function') {
                Sentry.captureException(error, {
                    contexts: {
                        productCard: {
                            productId: this.props.productId,
                        },
                    },
                });
            }
        } catch (sentryError) {
            // Sentry non disponible ou erreur d'import, ignorer
        }
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                <View style={styles.errorContainer}>
                    <View style={styles.errorCard}>
                        <SafeIcon name="alert-circle" size={32} color="#EF4444" />
                        <Text style={styles.errorTitle}>{t('productCardErrorBoundary.erreurDaffichage')}</Text>
                        <Text style={styles.errorMessage}>
                            Ce produit ne peut pas être affiché correctement
                        </Text>
                        {__DEV__ && this.state.error && (
                            <Text style={styles.errorDetails}>
                                {this.state.error.message}
                            </Text>
                        )}
                        <TouchableOpacity style={styles.retryButton} onPress={this.handleRetry}>
                            <SafeIcon name="refresh" size={16} color="#FFFFFF" />
                            <Text style={styles.retryButtonText}>{t('productCardErrorBoundary.reessayer')}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            );
        }

        return this.props.children;
    }
}

const styles = StyleSheet.create({
    errorContainer: {
        marginHorizontal: 16,
        marginVertical: 8,
    },
    errorCard: {
        backgroundColor: '#FEF2F2',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#FEE2E2',
        padding: 20,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 150,
    },
    errorTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#DC2626',
        marginTop: 12,
        marginBottom: 8,
    },
    errorMessage: {
        fontSize: 14,
        color: '#991B1B',
        textAlign: 'center',
        marginBottom: 12,
    },
    errorDetails: {
        fontSize: 11,
        color: '#7F1D1D',
        fontFamily: 'monospace',
        marginTop: 8,
        marginBottom: 12,
        backgroundColor: '#FEE2E2',
        padding: 8,
        borderRadius: 6,
        maxWidth: '100%',
        overflow: 'hidden',
    },
    retryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EF4444',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        gap: 6,
        marginTop: 8,
    },
    retryButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
});

export default ProductCardErrorBoundary;

