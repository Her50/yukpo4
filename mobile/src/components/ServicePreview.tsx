// ✅ NOUVEAU: Composant de prévisualisation avant publication
// Affiche résumé, checklist de complétude et option brouillon

import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { modernColors } from '../theme/modernTheme';
import { NativeButton, NativeCard } from './SafeNativeDesign';
import SafeIcon from './SafeIcon';
import { useLanguageSafe } from '../contexts/LanguageContext';

interface ChecklistItem {
    id: string;
    label: string;
    checked: boolean;
    required: boolean;
}

interface ServicePreviewData {
    type: string;
    nom: string;
    [key: string]: any;
}

interface Props {
    data: ServicePreviewData;
    checklist: ChecklistItem[];
    onPublish: () => void;
    onSaveDraft: () => void;
    onEdit: (step: number) => void;
}

const ServicePreview: React.FC<Props> = ({
    data,
    checklist,
    onPublish,
    onSaveDraft,
    onEdit,
}) => {
    const allRequiredChecked = checklist.filter((item) => item.required).every((item) => item.checked);
    const completionPercentage = Math.round(
        (checklist.filter((item) => item.checked).length / checklist.length) * 100
    );

    const serviceTypes: Record<string, { name: string; icon: string; color: string }> = {
        pharmacie: { name: 'Pharmacie', icon: 'Pill', color: '#10B981' },
        hopital: { name: t('servicePreview.hopitalclinique'), icon: 'Hospital', color: '#EF4444' },
        laboratoire: { name: 'Laboratoire', icon: 'Microscope', color: '#3B82F6' },
        banque_sang: { name: 'Banque de Sang', icon: 'Droplet', color: '#DC2626' },
        agence_voyage: { name: 'Agence de Voyage', icon: 'Bus', color: '#F59E0B' },
        covoiturage: { name: 'Covoiturage', icon: 'Users', color: '#8B5CF6' },
        taxi: { name: 'Taxi', icon: 'Car', color: '#F97316' },
    };

    const serviceType = serviceTypes[data.type] || {
        name: data.type,
        icon: 'circle',
        color: modernColors.primary,
    };

    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            {/* Header avec pourcentage de complétude */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>{t('servicePreview.apercuDuService')}</Text>
                <View style={styles.completionContainer}>
                    <View style={styles.completionBar}>
                        <View
                            style={[
                                styles.completionFill,
                                { width: `${completionPercentage}%` },
                            ]}
                        />
                    </View>
                    <Text style={styles.completionText}>{completionPercentage}% complété</Text>
                </View>
            </View>

            {/* Résumé du service */}
            <NativeCard style={styles.summaryCard}>
                <View style={styles.summaryHeader}>
                    <View
                        style={[
                            styles.serviceIconContainer,
                            { backgroundColor: serviceType.color + '15' },
                        ]}
                    >
                        <SafeIcon
                            name={serviceType.icon}
                            size={32}
                            color={serviceType.color}
                            type="lucide"
                        />
                    </View>
                    <View style={styles.summaryInfo}>
                        <Text style={styles.serviceTypeLabel}>{serviceType.name}</Text>
                        <Text style={styles.serviceName}>{data.nom}</Text>
                    </View>
                </View>
            </NativeCard>

            {/* Checklist de complétude */}
            <NativeCard style={styles.checklistCard}>
                <Text style={styles.checklistTitle}>{t('servicePreview.checklistDeCompletude')}</Text>
                <View style={styles.checklistContainer}>
                    {checklist.map((item) => (
                        <View key={item.id} style={styles.checklistItem}>
                            <View
                                style={[
                                    styles.checkbox,
                                    item.checked && styles.checkboxChecked,
                                    !item.checked && item.required && styles.checkboxRequired,
                                ]}
                            >
                                {item.checked && (
                                    <SafeIcon name="check" size={14} color="#fff" />
                                )}
                            </View>
                            <Text
                                style={[
                                    styles.checklistLabel,
                                    item.checked && styles.checklistLabelChecked,
                                ]}
                            >
                                {item.label}
                                {item.required && <Text style={styles.requiredMark}> *</Text>}
                            </Text>
                        </View>
                    ))}
                </View>

                {!allRequiredChecked && (
                    <View style={styles.warningBox}>
                        <SafeIcon name="alert-circle" size={20} color={modernColors.warning} />
                        <Text style={styles.warningText}>
                            Tous les champs requis doivent être complétés avant publication
                        </Text>
                    </View>
                )}
            </NativeCard>

            {/* Informations détaillées */}
            <NativeCard style={styles.detailsCard}>
                <Text style={styles.detailsTitle}>{t('servicePreview.informationsDetaillees')}</Text>
                <View style={styles.detailsList}>
                    {Object.entries(data)
                        .filter(([key]) => key !== 'type' && key !== 'nom')
                        .map(([key, value]) => (
                            <View key={key} style={styles.detailItem}>
                                <Text style={styles.detailLabel}>{key}</Text>
                                <Text style={styles.detailValue}>
                                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                </Text>
                            </View>
                        ))}
                </View>
            </NativeCard>

            {/* Actions */}
            <View style={styles.actionsContainer}>
                <NativeButton
                    title={t('servicePreview.enregistrerCommeBrouillon')}
                    variant="outline"
                    onPress={onSaveDraft}
                    style={styles.actionButton}
                />
                <NativeButton
                    title="✅ Publier le service"
                    variant="primary"
                    onPress={onPublish}
                    disabled={!allRequiredChecked}
                    style={styles.actionButton}
                />
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    header: {
        padding: 20,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 16,
    },
    completionContainer: {
        marginTop: 8,
    },
    completionBar: {
        height: 8,
        backgroundColor: '#E5E7EB',
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 8,
    },
    completionFill: {
        height: '100%',
        backgroundColor: modernColors.primary,
    },
    completionText: {
        fontSize: 12,
        color: modernColors.textSecondary,
        textAlign: 'center',
    },
    summaryCard: {
        margin: 16,
        padding: 20,
    },
    summaryHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    serviceIconContainer: {
        width: 64,
        height: 64,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    summaryInfo: {
        flex: 1,
    },
    serviceTypeLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.textSecondary,
        marginBottom: 4,
        textTransform: 'uppercase',
    },
    serviceName: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
    },
    checklistCard: {
        margin: 16,
        marginTop: 0,
        padding: 20,
    },
    checklistTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 16,
    },
    checklistContainer: {
        gap: 12,
    },
    checklistItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: '#D1D5DB',
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkboxChecked: {
        backgroundColor: modernColors.success,
        borderColor: modernColors.success,
    },
    checkboxRequired: {
        borderColor: modernColors.warning,
    },
    checklistLabel: {
        flex: 1,
        fontSize: 14,
        color: '#374151',
    },
    checklistLabelChecked: {
        textDecorationLine: 'line-through',
        color: modernColors.textSecondary,
    },
    requiredMark: {
        color: modernColors.warning,
    },
    warningBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 16,
        padding: 12,
        backgroundColor: '#FEF3C7',
        borderRadius: 8,
    },
    warningText: {
        flex: 1,
        fontSize: 12,
        color: '#92400E',
    },
    detailsCard: {
        margin: 16,
        marginTop: 0,
        padding: 20,
    },
    detailsTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 16,
    },
    detailsList: {
        gap: 12,
    },
    detailItem: {
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    detailLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.textSecondary,
        marginBottom: 4,
        textTransform: 'uppercase',
    },
    detailValue: {
        fontSize: 14,
        color: '#111827',
    },
    actionsContainer: {
        padding: 16,
        gap: 12,
    },
    actionButton: {
        marginBottom: 0,
    },
});

export default ServicePreview;

