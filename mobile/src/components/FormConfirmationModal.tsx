import React from 'react';
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

export interface ConfirmationField {
    label: string;
    value: string | number | boolean | null | undefined;
    icon?: string;
    type?: 'text' | 'boolean' | 'number' | 'currency' | 'date';
}

export interface ConfirmationSection {
    title: string;
    icon?: string;
    fields: ConfirmationField[];
}

interface FormConfirmationModalProps {
    visible: boolean;
    title: string;
    sections: ConfirmationSection[];
    onConfirm: () => void;
    onCancel: () => void;
    confirmText?: string;
    cancelText?: string;
    loading?: boolean;
}

const FormConfirmationModal: React.FC<FormConfirmationModalProps> = ({
    visible,
    title,
    sections,
    onConfirm,
    onCancel,
    confirmText = 'Confirmer',
    cancelText = 'Modifier',
    loading = false,
}) => {
    const formatValue = (field: ConfirmationField): string => {
        if (field.value === null || field.value === undefined || field.value === '') {
            return 'Non renseigné';
        }

        switch (field.type) {
            case 'boolean':
                return field.value ? 'Oui' : 'Non';
            case 'currency':
                return `${field.value} FCFA`;
            case 'date':
                return typeof field.value === 'string' 
                    ? new Date(field.value).toLocaleDateString('fr-FR')
                    : String(field.value);
            default:
                return String(field.value);
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onCancel}
        >
            <View style={styles.overlay}>
                <View style={styles.container}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.headerLeft}>
                            <SafeIcon name="check-circle" size={24} color={modernColors.primary} />
                            <Text style={styles.title}>{title}</Text>
                        </View>
                        <TouchableOpacity onPress={onCancel} style={styles.closeButton}>
                            <SafeIcon name="x" size={24} color="#6B7280" />
                        </TouchableOpacity>
                    </View>

                    {/* Content */}
                    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                        <Text style={styles.subtitle}>
                            Veuillez vérifier les informations avant de confirmer
                        </Text>

                        {sections.map((section, sectionIndex) => (
                            <View key={sectionIndex} style={styles.section}>
                                <View style={styles.sectionHeader}>
                                    {section.icon && (
                                        <SafeIcon 
                                            name={section.icon} 
                                            size={18} 
                                            color={modernColors.primary} 
                                        />
                                    )}
                                    <Text style={styles.sectionTitle}>{section.title}</Text>
                                </View>

                                {section.fields.map((field, fieldIndex) => (
                                    <View key={fieldIndex} style={styles.field}>
                                        <View style={styles.fieldHeader}>
                                            {field.icon && (
                                                <SafeIcon 
                                                    name={field.icon} 
                                                    size={14} 
                                                    color="#6B7280" 
                                                />
                                            )}
                                            <Text style={styles.fieldLabel}>{field.label}</Text>
                                        </View>
                                        <Text style={styles.fieldValue}>
                                            {formatValue(field)}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        ))}
                    </ScrollView>

                    {/* Footer */}
                    <View style={styles.footer}>
                        <TouchableOpacity
                            style={[styles.button, styles.cancelButton]}
                            onPress={onCancel}
                            disabled={loading}
                        >
                            <SafeIcon name="edit" size={18} color="#6B7280" />
                            <Text style={styles.cancelButtonText}>{cancelText}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.button, styles.confirmButton]}
                            onPress={onConfirm}
                            disabled={loading}
                        >
                            <SafeIcon name="check" size={18} color="#FFFFFF" />
                            <Text style={styles.confirmButtonText}>
                                {loading ? 'Envoi...' : confirmText}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    container: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '90%',
        paddingBottom: 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        flex: 1,
    },
    closeButton: {
        padding: 4,
    },
    content: {
        paddingHorizontal: 20,
        paddingTop: 16,
    },
    subtitle: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 20,
        lineHeight: 20,
    },
    section: {
        marginBottom: 24,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
    },
    field: {
        marginBottom: 12,
        paddingLeft: 8,
    },
    fieldHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
    },
    fieldLabel: {
        fontSize: 13,
        fontWeight: '500',
        color: '#6B7280',
    },
    fieldValue: {
        fontSize: 15,
        color: '#111827',
        paddingLeft: 20,
    },
    footer: {
        flexDirection: 'row',
        gap: 12,
        paddingHorizontal: 20,
        paddingTop: 16,
    },
    button: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        borderRadius: 12,
    },
    cancelButton: {
        backgroundColor: '#F3F4F6',
    },
    cancelButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#6B7280',
    },
    confirmButton: {
        backgroundColor: modernColors.primary,
    },
    confirmButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#FFFFFF',
    },
});

export default FormConfirmationModal;
