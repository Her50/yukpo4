// Error Boundary avec capture automatique dans le debug panel
import React, { Component, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useLanguageSafe } from '../contexts/LanguageContext';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundaryWithDebug extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        };
    }

    static getDerivedStateFromError(error: Error): State {
        return {
            hasError: true,
            error,
            errorInfo: null,
        };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('🔴 [ErrorBoundary] Erreur capturée:', error);
        console.error('🔴 [ErrorBoundary] Info:', errorInfo);

        this.setState({
            error,
            errorInfo,
        });
    }

    copyErrorToClipboard = async () => {
        const { error, errorInfo } = this.state;
        
        const errorText = `
═══════════════════════════════════════
YUKPOMNANG - CRASH REPORT
═══════════════════════════════════════
Date: ${new Date().toLocaleString()}
Platform: ${Platform.OS} ${Platform.Version}

ERROR:
${error?.name}: ${error?.message}

STACK:
${error?.stack}

COMPONENT STACK:
${errorInfo?.componentStack}
═══════════════════════════════════════
        `;

        await Clipboard.setStringAsync(errorText.trim());
        alert('✅ Erreur copiée dans le presse-papier !');
    };

    resetError = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
        });
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            const { error, errorInfo } = this.state;

            return (
                <View style={styles.container}>
                    <View style={styles.header}>
                        <Ionicons name="warning" size={64} color="#EF4444" />
                        <Text style={styles.title}>{t('errorBoundaryWithDebug.oupsUneErreurEstSurvenue')}/Text>
                        <Text style={styles.subtitle}>
                            L'application a rencontré un problème
                        </Text>
                    </View>

                    <ScrollView style={styles.errorContainer}>
                        <View style={styles.errorSection}>
                            <Text style={styles.errorLabel}>{t('errorBoundaryWithDebug.typeDerreur')}/Text>
                            <Text style={styles.errorText}>{error?.name}</Text>
                        </View>

                        <View style={styles.errorSection}>
                            <Text style={styles.errorLabel}>Message:</Text>
                            <Text style={styles.errorText}>{error?.message}</Text>
                        </View>

                        <View style={styles.errorSection}>
                            <Text style={styles.errorLabel}>Stack Trace:</Text>
                            <ScrollView horizontal>
                                <Text style={styles.stackText}>{error?.stack}</Text>
                            </ScrollView>
                        </View>

                        {errorInfo && (
                            <View style={styles.errorSection}>
                                <Text style={styles.errorLabel}>Component Stack:</Text>
                                <ScrollView horizontal>
                                    <Text style={styles.stackText}>{errorInfo.componentStack}</Text>
                                </ScrollView>
                            </View>
                        )}
                    </ScrollView>

                    <View style={styles.actions}>
                        <TouchableOpacity
                            style={[styles.button, styles.copyButton]}
                            onPress={this.copyErrorToClipboard}
                        >
                            <Ionicons name="copy" size={20} color="#FFF" />
                            <Text style={styles.buttonText}>{t('errorBoundaryWithDebug.copierLerreur')}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.button, styles.resetButton]}
                            onPress={this.resetError}
                        >
                            <Ionicons name="refresh" size={20} color="#FFF" />
                            <Text style={styles.buttonText}>{t('errorBoundaryWithDebug.reessayer')}</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.footer}>
                        <Text style={styles.footerText}>
                            💡 Partagez cette erreur avec l'équipe de support
                        </Text>
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
        backgroundColor: '#1F2937',
        paddingTop: Platform.OS === 'ios' ? 50 : 20,
    },
    header: {
        alignItems: 'center',
        paddingVertical: 32,
        paddingHorizontal: 24,
        backgroundColor: '#111827',
        borderBottomWidth: 1,
        borderBottomColor: '#374151',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#FFF',
        marginTop: 16,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 14,
        color: '#9CA3AF',
        marginTop: 8,
        textAlign: 'center',
    },
    errorContainer: {
        flex: 1,
        padding: 16,
    },
    errorSection: {
        backgroundColor: '#374151',
        borderRadius: 8,
        padding: 16,
        marginBottom: 16,
    },
    errorLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#9CA3AF',
        marginBottom: 8,
        textTransform: 'uppercase',
    },
    errorText: {
        fontSize: 14,
        color: '#F3F4F6',
        lineHeight: 20,
    },
    stackText: {
        fontSize: 12,
        color: '#F3F4F6',
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        lineHeight: 18,
    },
    actions: {
        flexDirection: 'row',
        padding: 16,
        gap: 12,
        backgroundColor: '#111827',
        borderTopWidth: 1,
        borderTopColor: '#374151',
    },
    button: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 8,
        gap: 8,
    },
    copyButton: {
        backgroundColor: '#3B82F6',
    },
    resetButton: {
        backgroundColor: '#10B981',
    },
    buttonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
    },
    footer: {
        padding: 16,
        backgroundColor: '#111827',
    },
    footerText: {
        fontSize: 12,
        color: '#9CA3AF',
        textAlign: 'center',
    },
});

