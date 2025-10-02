import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../contexts/AuthContext';

const DebugAuth: React.FC = () => {
    const { user, loading } = useAuth();

    return (
        <View style={styles.container}>
            <Text style={styles.title}>🔍 Debug AuthContext</Text>
            <ScrollView style={styles.scrollView}>
                <View style={styles.section}>
                    <Text style={styles.label}>Loading:</Text>
                    <Text style={styles.value}>{loading ? 'true' : 'false'}</Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.label}>User exists:</Text>
                    <Text style={styles.value}>{user ? 'true' : 'false'}</Text>
                </View>

                {user && (
                    <>
                        <View style={styles.section}>
                            <Text style={styles.label}>User ID:</Text>
                            <Text style={styles.value}>{user.id}</Text>
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.label}>Email:</Text>
                            <Text style={styles.value}>{user.email}</Text>
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.label}>Name:</Text>
                            <Text style={styles.value}>{user.name}</Text>
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.label}>Role:</Text>
                            <Text style={styles.value}>{user.role}</Text>
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.label}>Token exists:</Text>
                            <Text style={styles.value}>{user.token ? 'true' : 'false'}</Text>
                        </View>
                    </>
                )}

                <View style={styles.section}>
                    <Text style={styles.label}>Full User Object:</Text>
                    <Text style={styles.json}>{JSON.stringify(user, null, 2)}</Text>
                </View>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 50,
        left: 10,
        right: 10,
        backgroundColor: 'rgba(0,0,0,0.9)',
        borderRadius: 8,
        padding: 10,
        zIndex: 1000,
        maxHeight: 300,
    },
    title: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    scrollView: {
        maxHeight: 250,
    },
    section: {
        marginBottom: 8,
    },
    label: {
        color: '#4CAF50',
        fontSize: 12,
        fontWeight: 'bold',
    },
    value: {
        color: 'white',
        fontSize: 12,
    },
    json: {
        color: '#FFC107',
        fontSize: 10,
        fontFamily: 'monospace',
    },
});

export default DebugAuth;
