import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLanguageSafe } from '../contexts/LanguageContext';
import { ActivityIndicator } from 'react-native';
import { modernColors } from '../theme/modernTheme';

const LoadingScreen: React.FC = () => {
    const { t } = useLanguageSafe();

    return (
        <View style={styles.container}>
            <View style={styles.content}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.title}>{t('loading.title') || 'Chargement...'}</Text>
                <Text style={styles.subtitle}>{t('loading.subtitle') || 'Veuillez patienter'}</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: modernColors.background,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    title: {
        fontSize: 20,
        fontWeight: '600',
        color: modernColors.text,
        marginTop: 20,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: modernColors.textSecondary,
        textAlign: 'center',
        lineHeight: 24,
    },
});

export default LoadingScreen;
