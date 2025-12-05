import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';

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

const TEMPLATES: Template[] = [
    {
        id: 'promo',
        name: 'Promotion Flash',
        description: 'Idéal pour les offres limitées dans le temps',
        icon: 'zap',
        category: 'promotion',
    },
    {
        id: 'new_product',
        name: 'Nouveau Produit',
        description: 'Mettez en avant vos nouveautés',
        icon: 'sparkles',
        category: 'product',
    },
    {
        id: 'seasonal',
        name: 'Saisonnière',
        description: 'Adapté aux événements et saisons',
        icon: 'calendar',
        category: 'seasonal',
    },
    {
        id: 'testimonial',
        name: 'Témoignage',
        description: 'Mettez en avant les avis clients',
        icon: 'star',
        category: 'social',
    },
];

export const AdTemplates: React.FC<AdTemplatesProps> = ({ onSelectTemplate }) => {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>📋 Templates</Text>
            <Text style={styles.subtitle}>Choisissez un modèle pour démarrer rapidement</Text>
            <View style={styles.grid}>
                {TEMPLATES.map((template) => (
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

