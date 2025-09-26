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
    Text,
    TextInput,
    Title,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../../contexts/AuthContext';

const RegisterScreen = () => {
    const navigation = useNavigation();
    const { register, loading } = useAuth();

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const handleRegister = async () => {
        if (!name || !email || !password || !confirmPassword) {
            return;
        }

        if (password !== confirmPassword) {
            return;
        }

        const success = await register(name, email, password);
        if (success) {
            // Navigation automatique vers l'app principale
        }
    };

    const navigateToLogin = () => {
        navigation.navigate('Login' as never);
    };

    const isFormValid = name && email && password && confirmPassword && password === confirmPassword;

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
                            Créez votre compte
                        </Paragraph>
                    </View>

                    <Card style={styles.card}>
                        <Card.Content>
                            <TextInput
                                label="Nom complet"
                                value={name}
                                onChangeText={setName}
                                mode="outlined"
                                autoCapitalize="words"
                                autoComplete="name"
                                style={styles.input}
                            />

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
                                autoComplete="password-new"
                                right={
                                    <TextInput.Icon
                                        icon={showPassword ? 'eye-off' : 'eye'}
                                        onPress={() => setShowPassword(!showPassword)}
                                    />
                                }
                                style={styles.input}
                            />

                            <TextInput
                                label="Confirmer le mot de passe"
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                                mode="outlined"
                                secureTextEntry={!showConfirmPassword}
                                autoComplete="password-new"
                                right={
                                    <TextInput.Icon
                                        icon={showConfirmPassword ? 'eye-off' : 'eye'}
                                        onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                                    />
                                }
                                style={styles.input}
                            />

                            {password && confirmPassword && password !== confirmPassword && (
                                <Text style={styles.errorText}>
                                    Les mots de passe ne correspondent pas
                                </Text>
                            )}

                            <Button
                                mode="contained"
                                onPress={handleRegister}
                                loading={loading}
                                disabled={loading || !isFormValid}
                                style={styles.registerButton}
                            >
                                Créer un compte
                            </Button>

                            <Divider style={styles.divider} />

                            <Button
                                mode="outlined"
                                onPress={navigateToLogin}
                                style={styles.loginButton}
                            >
                                Se connecter
                            </Button>
                        </Card.Content>
                    </Card>

                    <View style={styles.footer}>
                        <Paragraph style={styles.footerText}>
                            En créant un compte, vous acceptez nos conditions d'utilisation
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
    errorText: {
        color: '#dc2626',
        fontSize: 12,
        marginBottom: 16,
    },
    registerButton: {
        marginTop: 8,
        marginBottom: 16,
    },
    divider: {
        marginVertical: 16,
    },
    loginButton: {
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

export default RegisterScreen;

