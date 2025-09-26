import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Version simplifiée pour tester le crash
export default function App() {
    console.log('[App] Démarrage de l\'application Yukpo (version simple)');

    const handleTest = () => {
        Alert.alert('Test', 'L\'application fonctionne correctement !');
    };

    return (
        <View style={styles.container}>
            <StatusBar style="auto" />

            <View style={styles.content}>
                <Text style={styles.title}>🎉 Yukpo Mobile</Text>
                <Text style={styles.subtitle}>Version de test simplifiée</Text>

                <TouchableOpacity style={styles.button} onPress={handleTest}>
                    <Text style={styles.buttonText}>Tester l'application</Text>
                </TouchableOpacity>

                <Text style={styles.info}>
                    Si vous voyez cette page, l'application se lance correctement.
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f0f8ff',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#FF8C00',
        marginBottom: 10,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 18,
        color: '#666',
        marginBottom: 30,
        textAlign: 'center',
    },
    button: {
        backgroundColor: '#FF8C00',
        paddingHorizontal: 30,
        paddingVertical: 15,
        borderRadius: 25,
        marginBottom: 30,
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    info: {
        fontSize: 14,
        color: '#888',
        textAlign: 'center',
        lineHeight: 20,
    },
});

