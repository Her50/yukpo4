import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useLanguageSafe } from '../contexts/LanguageContext';
import SafeIcon from '../components/SafeIcon';
import { modernColors } from '../theme/modernTheme';

interface AffinerBesoinPanelProps {
    onClose?: () => void;
    onApply?: (filters: any) => void;
}

const AffinerBesoinPanel: React.FC<AffinerBesoinPanelProps> = ({ onClose, onApply }) => {
    const { t } = useLanguageSafe();

    return (
        <View style={styles.container}>
            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                <View style={styles.header}>
                    <Text style={styles.title}>{t('affinerBesoin.title') || 'Affiner votre recherche'}</Text>
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                        <SafeIcon name="x" size={20} color={modernColors.text} />
                    </TouchableOpacity>
                </View>

                <View style={styles.content}>
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>{t('affinerBesoin.comingSoon') || 'Bientôt disponible'}</Text>
                        <Text style={styles.sectionText}>
                            {t('affinerBesoin.comingSoonText') || 'Les filtres de recherche avancés seront bientôt accessibles.'}
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
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 20,
        backgroundColor: modernColors.surface,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    title: {
        fontSize: 20,
        fontWeight: '600',
        color: modernColors.text,
        flex: 1,
    },
    closeBtn: {
        padding: 8,
        borderRadius: 16,
        backgroundColor: modernColors.surfaceVariant,
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
        fontSize: 18,
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

export default AffinerBesoinPanel;
