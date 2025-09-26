import { Ionicons } from '@expo/vector-icons';
import * as React from "react";
import { Component, ErrorInfo, ReactNode } from 'react';
import { TouchableOpacity } from 'react-native';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Paragraph, Title } from 'react-native-paper';
import { theme } from '../theme/theme';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null
        };
    }

    static getDerivedStateFromError(error: Error): State {
        return {
            hasError: true,
            error,
            errorInfo: null
        };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('[ErrorBoundary] Erreur capturée:', error);
        console.error('[ErrorBoundary] Stack trace:', errorInfo.componentStack);

        this.setState({
            error,
            errorInfo
        });

        // Envoyer l'erreur à un service de logging si disponible
        this.logErrorToService(error, errorInfo);
    }

    logErrorToService = (error: Error, errorInfo: ErrorInfo) => {
        // Ici vous pouvez envoyer l'erreur à un service comme Sentry, Crashlytics, etc.
        console.log('[ErrorBoundary] Logging error to service:', {
            message: error.message,
            stack: error.stack,
            componentStack: errorInfo.componentStack,
            timestamp: new Date().toISOString()
        });
    };

    handleRestart = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null
        });
    };

    handleReportError = () => {
        const { error, errorInfo } = this.state;
        if (error && errorInfo) {
            Alert.alert(
                'Rapport d\'erreur',
                `Erreur: ${error.message}\n\nComposant: ${errorInfo.componentStack?.split('\n')[1] || 'Inconnu'}`,
                [{ text: 'OK' }]
            );
        }
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <View style={styles.container}>
                    <Card style={styles.errorCard}>
                        <Card.Content style={styles.errorContent}>
                            <View style={styles.errorIcon}>
                                <Ionicons name="warning" size={48} color="#F44336" />
                            </View>

                            <Title style={styles.errorTitle}>
                                Oups ! Une erreur s'est produite
                            </Title>

                            <Paragraph style={styles.errorMessage}>
                                L'application a rencontré une erreur inattendue.
                                Veuillez redémarrer l'application ou contacter le support si le problème persiste.
                            </Paragraph>

                            {__DEV__ && this.state.error && (
                                <View style={styles.debugInfo}>
                                    <Text style={styles.debugTitle}>Informations de débogage:</Text>
                                    <Text style={styles.debugText}>
                                        {this.state.error.message}
                                    </Text>
                                    {this.state.error.stack && (
                                        <Text style={styles.debugStack}>
                                            {this.state.error.stack.split('\n').slice(0, 5).join('\n')}
                                        </Text>
                                    )}
                                </View>
                            )}

                            <View style={styles.buttonContainer}>
                                <TouchableOpacity
                                    onPress={this.handleRestart}
                                    style={styles.restartButton}
                                >
                                    <Ionicons name="refresh" size={16} color="white" style={styles.buttonIcon} />
                                    <Text style={styles.buttonLabel}>Redémarrer</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={this.handleReportError}
                                    style={styles.reportButton}
                                >
                                    <Ionicons name="bug" size={16} color={theme.colors.primary} style={styles.buttonIcon} />
                                    <Text style={styles.buttonLabel}>Signaler</Text>
                                </TouchableOpacity>
                            </View>
                        </Card.Content>
                    </Card>
                </View>
            );
        }

        return this.props.children;
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: theme.colors.background,
        padding: 20,
    },
    errorCard: {
        width: '100%',
        maxWidth: 400,
        elevation: 8,
    },
    errorContent: {
        alignItems: 'center',
        padding: 24,
    },
    errorIcon: {
        marginBottom: 16,
    },
    errorTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: theme.colors.text,
        textAlign: 'center',
        marginBottom: 12,
    },
    errorMessage: {
        fontSize: 16,
        color: theme.colors.textSecondary,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 24,
    },
    debugInfo: {
        width: '100%',
        backgroundColor: '#f5f5f5',
        padding: 12,
        borderRadius: 8,
        marginBottom: 24,
    },
    debugTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginBottom: 8,
    },
    debugText: {
        fontSize: 12,
        color: '#666',
        fontFamily: 'monospace',
    },
    debugStack: {
        fontSize: 10,
        color: '#999',
        fontFamily: 'monospace',
        marginTop: 8,
    },
    buttonContainer: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    restartButton: {
        flex: 1,
        backgroundColor: theme.colors.primary,
    },
    reportButton: {
        flex: 1,
        borderColor: theme.colors.primary,
    },
    buttonLabel: {
        fontSize: 14,
        fontWeight: '600',
    },
    buttonIcon: {
        marginRight: 8,
    },
});

export default ErrorBoundary;




