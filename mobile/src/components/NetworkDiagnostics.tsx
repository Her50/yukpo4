import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { networkDiagnostics } from '../services/api';
import { modernColors } from '../theme/modernTheme';
import { NativeButton, NativeCard } from './SafeNativeDesign';
import SafeIcon from './SafeIcon';
import { useLanguageSafe } from '../contexts/LanguageContext';

interface NetworkDiagnosticsProps {
    onClose?: () => void;
}

const NetworkDiagnostics: React.FC<NetworkDiagnosticsProps> = ({ onClose }) => {
        const { t } = useLanguageSafe();
const [isRunning, setIsRunning] = useState(false);
    const [results, setResults] = useState<any>(null);

    const runDiagnostics = async () => {
        setIsRunning(true);
        setResults(null);

        try {
            const diagnostics = await networkDiagnostics.checkConnectivity();
            setResults(diagnostics);

            // Log détaillé
            console.log('[NetworkDiagnostics] Résultats:', diagnostics);

            // Alert avec résultats
            const statusIcon = diagnostics.isOnline && diagnostics.apiReachable ? '✅' : '❌';
            const statusText = diagnostics.isOnline && diagnostics.apiReachable
                ? 'Connexion OK'
                : t('networkDiagnostics.problemeDeConnexion');

            Alert.alert(
                t('networkDiagnostics.diagnosticReseau', { statusIcon: statusIcon }),
                t('networkDiagnostics.statutNtempsDeReponseMsnerreur', { statusText: statusText, diagnostics_responseTime: diagnostics.responseTime, diagnostics_error || 'Aucune': diagnostics.error || 'Aucune' }),
                [{ text: 'OK' }]
            );

        } catch (error: any) {
            console.error('[NetworkDiagnostics] Erreur:', error);
            setResults({
                isOnline: false,
                apiReachable: false,
                responseTime: 0,
                error: error.message
            });

            Alert.alert(
                '❌ Erreur de diagnostic',
                t('networkDiagnostics.impossibleDexecuterLeDiagnostic', { error_message: error.message }),
                [{ text: 'OK' }]
            );
        } finally {
            setIsRunning(false);
        }
    };

    return (
        <View style={styles.container}>
            <NativeCard style={styles.card}>
                <View style={styles.header}>
                    <SafeIcon name="wifi" size={24} color={modernColors.primary} />
                    <Text style={styles.title}>{t('networkDiagnostics.diagnosticReseau')}</Text>
                </View>

                <Text style={styles.description}>
                    Testez la connectivité à l'API backend pour diagnostiquer les problèmes de création de service.
                </Text>

                <NativeButton
                    title={isRunning ? "⏳ Test en cours..." : "🔍 Lancer le diagnostic"}
                    onPress={runDiagnostics}
                    variant="primary"
                    style={styles.button}
                    disabled={isRunning}
                />

                {results && (
                    <View style={styles.results}>
                        <Text style={styles.resultsTitle}>{t('networkDiagnostics.resultatsDuDiagnostic')}</Text>

                        <View style={styles.resultItem}>
                            <Text style={styles.resultLabel}>Statut:</Text>
                            <Text style={[
                                styles.resultValue,
                                { color: results.isOnline && results.apiReachable ? modernColors.success : modernColors.error }
                            ]}>
                                {results.isOnline && results.apiReachable ? t('networkDiagnostics.connecte') : t('networkDiagnostics.deconnecte')}
                            </Text>
                        </View>

                        <View style={styles.resultItem}>
                            <Text style={styles.resultLabel}>{t('networkDiagnostics.tempsDeReponse')}</Text>
                            <Text style={styles.resultValue}>{results.responseTime}ms</Text>
                        </View>

                        {results.error && (
                            <View style={styles.resultItem}>
                                <Text style={styles.resultLabel}>{t('networkDiagnostics.erreur')}</Text>
                                <Text style={[styles.resultValue, { color: modernColors.error }]}>
                                    {results.error}
                                </Text>
                            </View>
                        )}
                    </View>
                )}

                {onClose && (
                    <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                        <Text style={styles.closeButtonText}>{t('networkDiagnostics.fermer')}</Text>
                    </TouchableOpacity>
                )}
            </NativeCard>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 16,
    },
    card: {
        padding: 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        gap: 8,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: modernColors.text,
    },
    description: {
        fontSize: 14,
        color: modernColors.textSecondary,
        lineHeight: 20,
        marginBottom: 20,
    },
    button: {
        marginBottom: 20,
    },
    results: {
        backgroundColor: modernColors.background,
        padding: 16,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    resultsTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 12,
    },
    resultItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    resultLabel: {
        fontSize: 14,
        color: modernColors.textSecondary,
        flex: 1,
    },
    resultValue: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        flex: 1,
        textAlign: 'right',
    },
    closeButton: {
        marginTop: 16,
        paddingVertical: 12,
        paddingHorizontal: 24,
        backgroundColor: modernColors.background,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: modernColors.border,
        alignItems: 'center',
    },
    closeButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.textSecondary,
    },
});

export default NetworkDiagnostics;

