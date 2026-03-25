import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useLanguageSafe } from '../contexts/LanguageContext';
import SafeIcon from '../components/SafeIcon';
import { modernColors } from '../theme/modernTheme';

const ConfirmationScreen: React.FC = () => {
    const { t } = useLanguageSafe();

    return (
        <View style={styles.container}>
            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                <View style={styles.header}>
                    <SafeIcon name="check-circle" size={48} color={modernColors.success} />
                    <Text style={styles.title}>{t('confirmation.title') || 'Confirmation'}</Text>
                    <Text style={styles.subtitle}>{t('confirmation.subtitle') || 'Opération réussie'}</Text>
                </View>

                <View style={styles.content}>
                    <View style={styles.section}>
                        <Text style={styles.sectionText}>
                            {t('confirmation.message') || 'Votre opération a été complétée avec succès.'}
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
        paddingTop: 80,
        paddingBottom: 40,
        paddingHorizontal: 20,
        backgroundColor: modernColors.surface,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: modernColors.text,
        marginTop: 20,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 18,
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
    sectionText: {
        fontSize: 16,
        color: modernColors.text,
        textAlign: 'center',
        lineHeight: 24,
    },
});

export default ConfirmationScreen;
