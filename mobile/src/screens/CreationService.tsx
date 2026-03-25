import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useLanguageSafe } from '../contexts/LanguageContext';
import SafeIcon from '../components/SafeIcon';
import { modernColors } from '../theme/modernTheme';

const CreationService: React.FC = () => {
    const { t } = useLanguageSafe();

    return (
        <View style={styles.container}>
            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                <View style={styles.header}>
                    <SafeIcon name="plus-circle" size={32} color={modernColors.primary} />
                    <Text style={styles.title}>{t('creationService.title') || 'Créer un Service'}</Text>
                    <Text style={styles.subtitle}>{t('creationService.subtitle') || 'Formulaire de création de service'}</Text>
                </View>

                <View style={styles.content}>
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>{t('creationService.comingSoon') || 'Bientôt disponible'}</Text>
                        <Text style={styles.sectionText}>
                            {t('creationService.comingSoonText') || 'Le formulaire de création de service sera bientôt accessible.'}
                        </Text>
                    </View>
                </View>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: modernColors.background,
    },
    scrollView: {
        flex: 1,
    },
    header: {
        alignItems: 'center',
        paddingTop: 60,
        paddingBottom: 40,
        paddingHorizontal: 20,
        backgroundColor: modernColors.surface,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: modernColors.text,
        marginTop: 16,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: modernColors.textSecondary,
        textAlign: 'center',
        lineHeight: 24,
    },
    content: {
        padding: 20,
    },
    section: {
        backgroundColor: modernColors.surface,
        borderRadius: 12,
        padding: 24,
        alignItems: 'center',
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 12,
    },
    sectionText: {
        fontSize: 16,
        color: modernColors.textSecondary,
        textAlign: 'center',
        lineHeight: 24,
    },
});

export default CreationService;
