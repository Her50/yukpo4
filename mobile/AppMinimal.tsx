// Version MINIMALE pour éviter tout crash - DEBUGGING PUR
import React from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';

export default function AppMinimal() {
    console.log('[AppMinimal] 🚀 Démarrage version minimale');
    
    // Test simple - pas d'imports complexes
    const handlePress = () => {
        Alert.alert('Test', 'L\'app fonctionne !');
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>🚨 YUKPO MINIMAL</Text>
            <Text style={styles.subtitle}>Version de test - Si vous voyez ceci, l'app ne crash pas</Text>
            <Text style={styles.info}>Version: 1.0.0 - Debug Mode</Text>
            
            <View style={styles.buttonContainer}>
                <Text style={styles.button} onPress={handlePress}>
                    🧪 TESTER
                </Text>
            </View>
            
            <Text style={styles.debug}>
                Si cette version fonctionne, le problème vient des imports complexes
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#DC2626',
        marginBottom: 16,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 18,
        color: '#374151',
        marginBottom: 8,
        textAlign: 'center',
    },
    info: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 32,
        textAlign: 'center',
    },
    buttonContainer: {
        backgroundColor: '#6366F1',
        paddingHorizontal: 32,
        paddingVertical: 16,
        borderRadius: 8,
        marginBottom: 32,
    },
    button: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    debug: {
        fontSize: 12,
        color: '#9CA3AF',
        textAlign: 'center',
        fontStyle: 'italic',
        maxWidth: 300,
    },
});
