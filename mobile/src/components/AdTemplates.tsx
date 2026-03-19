import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';
import { useLanguageSafe } from '../contexts/LanguageContext';

interface Template {
    id: string;
    name: string;
    description: string;
    icon: string;
    category: string;
}

interface AdTemplatesProps {
    onSelectTemplate: (template: Template) => void;
}

export const AdTemplates: React.FC<AdTemplatesProps> = ({ onSelectTemplate }) => {
    const { t } = useLanguageSafe();
    const templates: Template[] = [
        {
            id: 'promo',
            name: 'Promotion Flash',
            description: t('adTemplates.idealPourLesOffresLimitees'),
            icon: 'zap',
            category: 'promotion',
        },
        {
            id: 'new_product',
            name: t('adTemplates.nouveauProduit'),
            description: t('adTemplates.mettezEnAvantVosNouveautes'),
            icon: 'sparkles',
            category: 'product',
        },
        {
            id: 'seasonal',
            name: t('adTemplates.saisonniere'),
            description: t('adTemplates.adapteAuxEvenementsEtSaisons'),
            icon: 'calendar',
            category: 'seasonal',
        },
        {
            id: 'testimonial',
            name: t('adTemplates.temoignage'),
            description: 'Mettez en avant les avis clients',
            icon: 'star',
            category: 'social',
        },
    ];

    return (
        <View style={styles.container}>
            <Text style={styles.title}>📋 Templates</Text>
            <Text style={styles.subtitle}>{t('adTemplates.choisissezUnModelePourDemarrer')}</Text>
            <View style={styles.grid}>
                {templates.map((template) => (
                    <TouchableOpacity
                        key={template.id}
                        style={styles.templateCard}
                        onPress={() => onSelectTemplate(template)}
                        activeOpacity={0.8}
                    >
                        <View style={styles.templateIcon}>
                            <SafeIcon
                                name={template.icon}
                                size={24}
                                color={modernColors.primary}
                            />
                        </View>
                        <Text style={styles.templateName}>{template.name}</Text>
                        <Text style={styles.templateDescription} numberOfLines={2}>
                            {template.description}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
    },
    title: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.text,
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginBottom: 12,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    templateCard: {
        width: '47%',
        padding: 16,
        borderRadius: 12,
        backgroundColor: modernColors.surface,
        borderWidth: 1,
        borderColor: modernColors.border,
        alignItems: 'center',
    },
    templateIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: modernColors.surfaceVariant,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    templateName: {
        fontSize: 14,
        fontWeight: '700',
        color: modernColors.text,
        marginBottom: 4,
        textAlign: 'center',
    },
    templateDescription: {
        fontSize: 11,
        color: modernColors.textSecondary,
        textAlign: 'center',
        lineHeight: 14,
    },
});

