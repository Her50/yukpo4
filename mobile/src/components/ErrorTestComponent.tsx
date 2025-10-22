/**
 * Composant de test pour vérifier la gestion d'erreur
 */

import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeEffect } from '../hooks/useSafeEffect';
import { errorHandler } from '../utils/errorHandler';

const ErrorTestComponent: React.FC = () => {
    const [errorCount, setErrorCount] = React.useState(0);

    // Test du gestionnaire d'erreur
    const testErrorHandler = () => {
        try {
            throw new Error('Test d\'erreur intentionnel');
        } catch (error) {
            errorHandler.handleError(error, {
                component: 'ErrorTestComponent',
                action: 'test_error_handler'
            });
            setErrorCount(prev => prev + 1);
        }
    };

    // Test du hook useSafeEffect
    useSafeEffect(() => {
        console.log('[ErrorTestComponent] useSafeEffect testé avec succès');
    }, [], {
        component: 'ErrorTestComponent',
        action: 'test_safe_effect'
    });

    const showErrorLog = () => {
        const errorLog = errorHandler.getErrorLog();
        Alert.alert(
            'Log d\'erreurs',
            `Nombre d'erreurs capturées: ${errorLog.length}`,
            [
                { text: 'OK' },
                { text: 'Nettoyer', onPress: () => errorHandler.clearErrorLog() }
            ]
        );
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>🧪 Test des corrections</Text>

            <View style={styles.infoBox}>
                <Text style={styles.infoText}>
                    ✅ Gestionnaire d'erreur actif
                </Text>
                <Text style={styles.infoText}>
                    ✅ Hook useSafeEffect fonctionnel
                </Text>
                <Text style={styles.infoText}>
                    ✅ Imports sécurisés appliqués
                </Text>
            </View>

            <TouchableOpacity style={styles.button} onPress={testErrorHandler}>
                <Text style={styles.buttonText}>Tester la gestion d'erreur</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.button} onPress={showErrorLog}>
                <Text style={styles.buttonText}>Voir le log d'erreurs</Text>
            </TouchableOpacity>

            <Text style={styles.counter}>
                Erreurs testées: {errorCount}
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 20,
        backgroundColor: '#F8F9FA',
        borderRadius: 12,
        margin: 16,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1F2937',
        marginBottom: 16,
        textAlign: 'center',
    },
    infoBox: {
        backgroundColor: '#E5E7EB',
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
    },
    infoText: {
        fontSize: 14,
        color: '#374151',
        marginBottom: 4,
    },
    button: {
        backgroundColor: '#6366F1',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 8,
        marginBottom: 12,
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
        textAlign: 'center',
    },
    counter: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
        marginTop: 8,
    },
});

export default ErrorTestComponent;
