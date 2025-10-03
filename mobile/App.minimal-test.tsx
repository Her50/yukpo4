import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';

export default function App() {
    console.log('[App] 🚀 Test minimal - Yukpomnang');

    return (
        <View style={styles.container}>
            <StatusBar style="auto" />
            <Text style={styles.title}>🚀 Yukpomnang</Text>
            <Text style={styles.subtitle}>Test minimal - Build EAS</Text>
            <Text style={styles.version}>Version: 1.0.0</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#6366F1',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#FFF',
        marginBottom: 16,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 18,
        color: '#E0E7FF',
        marginBottom: 8,
        textAlign: 'center',
    },
    version: {
        fontSize: 14,
        color: '#C7D2FE',
        textAlign: 'center',
    },
});

