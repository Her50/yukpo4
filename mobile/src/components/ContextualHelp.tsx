// ✅ NOUVEAU: Composant d'aide contextuelle avec tooltips et exemples

import React, { useState } from 'react';
import {
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';
import { useLanguageSafe } from '../contexts/LanguageContext';

interface HelpItem {
    field: string;
    title: string;
    description: string;
    example?: string;
    tip?: string;
    docLink?: string;
}

interface Props {
    field: string;
    helpItems: HelpItem[];
    position?: 'top' | 'bottom' | 'left' | 'right';
}

const ContextualHelp: React.FC<Props> = ({ field, helpItems, position = 'bottom' }) => {
        const { t } = useLanguageSafe();
const [showTooltip, setShowTooltip] = useState(false);
    const [showModal, setShowModal] = useState(false);

    const helpItem = helpItems.find((item) => item.field === field);

    if (!helpItem) return null;

    return (
        <>
            <TouchableOpacity
                style={styles.helpButton}
                onPress={() => setShowModal(true)}
                onLongPress={() => setShowTooltip(!showTooltip)}
            >
                <SafeIcon name="help-circle" size={18} color={modernColors.primary} type="lucide" />
            </TouchableOpacity>

            {showTooltip && (
                <View style={[styles.tooltip, styles[`tooltip${position.charAt(0).toUpperCase() + position.slice(1)}`]]}>
                    <Text style={styles.tooltipTitle}>{helpItem.title}</Text>
                    <Text style={styles.tooltipText}>{helpItem.description}</Text>
                    {helpItem.example && (
                        <View style={styles.exampleContainer}>
                            <Text style={styles.exampleLabel}>Exemple:</Text>
                            <Text style={styles.exampleText}>{helpItem.example}</Text>
                        </View>
                    )}
                </View>
            )}

            <Modal
                visible={showModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowModal(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowModal(false)}
                >
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{helpItem.title}</Text>
                            <TouchableOpacity onPress={() => setShowModal(false)}>
                                <SafeIcon name="x" size={24} color={modernColors.text} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody}>
                            <Text style={styles.modalDescription}>{helpItem.description}</Text>

                            {helpItem.example && (
                                <View style={styles.modalExample}>
                                    <Text style={styles.modalExampleLabel}>Exemple:</Text>
                                    <View style={styles.modalExampleBox}>
                                        <Text style={styles.modalExampleText}>{helpItem.example}</Text>
                                    </View>
                                </View>
                            )}

                            {helpItem.tip && (
                                <View style={styles.modalTip}>
                                    <SafeIcon name="lightbulb" size={20} color={modernColors.warning} type="lucide" />
                                    <Text style={styles.modalTipText}>{helpItem.tip}</Text>
                                </View>
                            )}

                            {helpItem.docLink && (
                                <TouchableOpacity style={styles.modalDocLink}>
                                    <SafeIcon name="external-link" size={18} color={modernColors.primary} type="lucide" />
                                    <Text style={styles.modalDocLinkText}>{t('contextualHelp.voirLaDocumentation')}</Text>
                                </TouchableOpacity>
                            )}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>
        </>
    );
};

// Composant pour afficher un exemple inline
export const HelpExample: React.FC<{ example: string }> = ({ example }) => (
    <View style={styles.inlineExample}>
        <Text style={styles.inlineExampleLabel}>Exemple:</Text>
        <Text style={styles.inlineExampleText}>{example}</Text>
    </View>
);

const styles = StyleSheet.create({
    helpButton: {
        padding: 4,
        marginLeft: 8,
    },
    tooltip: {
        position: 'absolute',
        backgroundColor: '#1F2937',
        borderRadius: 8,
        padding: 12,
        maxWidth: 250,
        zIndex: 1000,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    tooltipTop: {
        bottom: '100%',
        marginBottom: 8,
    },
    tooltipBottom: {
        top: '100%',
        marginTop: 8,
    },
    tooltipLeft: {
        right: '100%',
        marginRight: 8,
    },
    tooltipRight: {
        left: '100%',
        marginLeft: 8,
    },
    tooltipTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 4,
    },
    tooltipText: {
        fontSize: 12,
        color: '#D1D5DB',
        marginBottom: 8,
    },
    exampleContainer: {
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#374151',
    },
    exampleLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#9CA3AF',
        marginBottom: 4,
    },
    exampleText: {
        fontSize: 12,
        color: '#60A5FA',
        fontStyle: 'italic',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: 16,
        width: '100%',
        maxWidth: 400,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
    },
    modalBody: {
        padding: 20,
    },
    modalDescription: {
        fontSize: 16,
        color: '#374151',
        lineHeight: 24,
        marginBottom: 20,
    },
    modalExample: {
        marginBottom: 20,
    },
    modalExampleLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 8,
    },
    modalExampleBox: {
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        padding: 12,
        borderLeftWidth: 3,
        borderLeftColor: modernColors.primary,
    },
    modalExampleText: {
        fontSize: 14,
        color: '#374151',
        fontStyle: 'italic',
    },
    modalTip: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: '#FEF3C7',
        borderRadius: 8,
        padding: 12,
        gap: 8,
        marginBottom: 20,
    },
    modalTipText: {
        flex: 1,
        fontSize: 14,
        color: '#92400E',
    },
    modalDocLink: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 12,
        backgroundColor: '#EEF2FF',
        borderRadius: 8,
    },
    modalDocLinkText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
    },
    inlineExample: {
        marginTop: 8,
        padding: 8,
        backgroundColor: '#F9FAFB',
        borderRadius: 6,
    },
    inlineExampleLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.textSecondary,
        marginBottom: 4,
    },
    inlineExampleText: {
        fontSize: 12,
        color: modernColors.primary,
        fontStyle: 'italic',
    },
});

export default ContextualHelp;

