import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';
import {
    Button,
    Card,
    Divider,
    Paragraph,
    TextInput,
    Title
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../../contexts/AuthContext';

const LoginScreen = () => {
    const navigation = useNavigation();
    const { login, loading } = useAuth();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const handleLogin = async () => {
        if (!email || !password) {
            return;
        }

        const success = await login(email, password);
        if (success) {
            // Navigation automatique vers l'app principale
        }
    };

    const navigateToRegister = () => {
        navigation.navigate('Register' as never);
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardAvoidingView}
            >
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <View style={styles.header}>
                        <Title style={styles.title}>Yukpomnang</Title>
                        <Paragraph style={styles.subtitle}>
                            Connectez-vous à votre compte
                        </Paragraph>
                    </View>

                    <Card style={styles.card}>
                        <Card.Content>
                            <TextInput
                                label="Email"
                                value={email}
                                onChangeText={setEmail}
                                mode="outlined"
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoComplete="email"
                                style={styles.input}
                            />

                            <TextInput
                                label="Mot de passe"
                                value={password}
                                onChangeText={setPassword}
                                mode="outlined"
                                secureTextEntry={!showPassword}
                                autoComplete="password"
                                right={
                                    <TextInput.Icon
                                        icon={showPassword ? 'eye-off' : 'eye'}
                                        onPress={() => setShowPassword(!showPassword)}
                                    />
                                }
                                style={styles.input}
                            />

                            <Button
                                mode="contained"
                                onPress={handleLogin}
                                loading={loading}
                                disabled={loading || !email || !password}
                                style={styles.loginButton}
                            >
                                Se connecter
                            </Button>

                            <Divider style={styles.divider} />

                            <Button
                                mode="outlined"
                                onPress={navigateToRegister}
                                style={styles.registerButton}
                            >
                                Créer un compte
                            </Button>
                        </Card.Content>
                    </Card>

                    <View style={styles.footer}>
                        <Paragraph style={styles.footerText}>
                            En vous connectant, vous acceptez nos conditions d'utilisation
                        </Paragraph>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    keyboardAvoidingView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 20,
    },
    header: {
        alignItems: 'center',
        marginBottom: 32,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#2563eb',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#64748b',
        textAlign: 'center',
    },
    card: {
        elevation: 4,
        borderRadius: 12,
    },
    input: {
        marginBottom: 16,
    },
    loginButton: {
        marginTop: 8,
        marginBottom: 16,
    },
    divider: {
        marginVertical: 16,
    },
    registerButton: {
        marginBottom: 8,
    },
    footer: {
        marginTop: 32,
        alignItems: 'center',
    },
    footerText: {
        fontSize: 12,
        color: '#94a3b8',
        textAlign: 'center',
    },
});

export default LoginScreen;

