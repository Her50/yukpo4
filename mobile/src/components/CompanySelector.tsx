/**
 * CompanySelector - Sélecteur de compagnies (bus/vols) avec possibilité d'ajout dynamique
 * Permet de distinguer les bus des vols et d'ajouter autant de compagnies que nécessaire
 */

import React, { useState } from 'react';
import {
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';

export interface Company {
    id: string;
    name: string;
    type: 'bus' | 'flight'; // ✅ Distinction bus/vols
}

interface CompanySelectorProps {
    label: string;
    selected: Company[];
    onSelectionChange: (companies: Company[]) => void;
    allowCustom?: boolean;
    placeholder?: string;
    hint?: string;
}

const CompanySelector: React.FC<CompanySelectorProps> = ({
    label,
    selected,
    onSelectionChange,
    allowCustom = true,
    placeholder = 'Ajouter une compagnie',
    hint
}) => {
    const [showModal, setShowModal] = useState(false);
    const [companyName, setCompanyName] = useState('');
    const [companyType, setCompanyType] = useState<'bus' | 'flight'>('bus');
    const [searchQuery, setSearchQuery] = useState('');

    const handleAddCompany = () => {
        if (companyName.trim() && !selected.some(c => c.name.toLowerCase() === companyName.trim().toLowerCase())) {
            const newCompany: Company = {
                id: Date.now().toString(),
                name: companyName.trim(),
                type: companyType
            };
            onSelectionChange([...selected, newCompany]);
            setCompanyName('');
            setCompanyType('bus');
        }
    };

    const handleRemoveCompany = (id: string) => {
        onSelectionChange(selected.filter(c => c.id !== id));
    };

    const filteredSelected = selected.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const busCompanies = filteredSelected.filter(c => c.type === 'bus');
    const flightCompanies = filteredSelected.filter(c => c.type === 'flight');

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.label}>{label}</Text>
                    {hint && <Text style={styles.hint}>{hint}</Text>}
                </View>
                <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => setShowModal(true)}
                >
                    <SafeIcon name="plus" size={18} color={modernColors.primary} />
                    <Text style={styles.addButtonText}>Ajouter</Text>
                </TouchableOpacity>
            </View>

            {selected.length === 0 ? (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>Aucune compagnie ajoutée</Text>
                    <Text style={styles.emptyHint}>Appuyez sur "Ajouter" pour commencer</Text>
                </View>
            ) : (
                <View style={styles.selectedList}>
                    {busCompanies.length > 0 && (
                        <View style={styles.typeSection}>
                            <Text style={styles.typeLabel}>
                                <SafeIcon name="bus" size={14} color={modernColors.primary} /> Bus ({busCompanies.length})
                            </Text>
                            {busCompanies.map((company) => (
                                <View key={company.id} style={styles.companyChip}>
                                    <Text style={styles.companyName}>{company.name}</Text>
                                    <TouchableOpacity
                                        style={styles.removeButton}
                                        onPress={() => handleRemoveCompany(company.id)}
                                    >
                                        <SafeIcon name="x" size={16} color="#DC2626" />
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>
                    )}

                    {flightCompanies.length > 0 && (
                        <View style={styles.typeSection}>
                            <Text style={styles.typeLabel}>
                                <SafeIcon name="plane" size={14} color={modernColors.primary} /> Vols ({flightCompanies.length})
                            </Text>
                            {flightCompanies.map((company) => (
                                <View key={company.id} style={styles.companyChip}>
                                    <Text style={styles.companyName}>{company.name}</Text>
                                    <TouchableOpacity
                                        style={styles.removeButton}
                                        onPress={() => handleRemoveCompany(company.id)}
                                    >
                                        <SafeIcon name="x" size={16} color="#DC2626" />
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>
                    )}
                </View>
            )}

            {/* Modal d'ajout */}
            <Modal
                visible={showModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Ajouter une compagnie</Text>
                            <TouchableOpacity onPress={() => setShowModal(false)}>
                                <SafeIcon name="x" size={24} color="#6B7280" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.typeSelector}>
                            <TouchableOpacity
                                style={[
                                    styles.typeButton,
                                    companyType === 'bus' && styles.typeButtonSelected
                                ]}
                                onPress={() => setCompanyType('bus')}
                            >
                                <SafeIcon name="bus" size={20} color={companyType === 'bus' ? '#fff' : modernColors.primary} />
                                <Text style={[
                                    styles.typeButtonText,
                                    companyType === 'bus' && styles.typeButtonTextSelected
                                ]}>
                                    Bus
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.typeButton,
                                    companyType === 'flight' && styles.typeButtonSelected
                                ]}
                                onPress={() => setCompanyType('flight')}
                            >
                                <SafeIcon name="plane" size={20} color={companyType === 'flight' ? '#fff' : modernColors.primary} />
                                <Text style={[
                                    styles.typeButtonText,
                                    companyType === 'flight' && styles.typeButtonTextSelected
                                ]}>
                                    Vols
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={styles.inputLabel}>Nom de la compagnie</Text>
                            <TextInput
                                style={styles.input}
                                value={companyName}
                                onChangeText={setCompanyName}
                                placeholder={placeholder}
                                placeholderTextColor="#9CA3AF"
                            />
                        </View>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.cancelButton]}
                                onPress={() => {
                                    setShowModal(false);
                                    setCompanyName('');
                                }}
                            >
                                <Text style={styles.cancelButtonText}>Annuler</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.saveButton]}
                                onPress={() => {
                                    handleAddCompany();
                                    setShowModal(false);
                                }}
                                disabled={!companyName.trim()}
                            >
                                <Text style={styles.saveButtonText}>Ajouter</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 4,
    },
    hint: {
        fontSize: 12,
        color: '#6B7280',
        fontStyle: 'italic',
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: `${modernColors.primary}15`,
        borderRadius: 8,
    },
    addButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
    },
    emptyState: {
        padding: 24,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderStyle: 'dashed',
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
        marginBottom: 4,
    },
    emptyHint: {
        fontSize: 12,
        color: '#9CA3AF',
    },
    selectedList: {
        gap: 16,
    },
    typeSection: {
        marginBottom: 12,
    },
    typeLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: '#374151',
        marginBottom: 8,
    },
    companyChip: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: '#F3F4F6',
        borderRadius: 8,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    companyName: {
        fontSize: 14,
        fontWeight: '500',
        color: '#111827',
        flex: 1,
    },
    removeButton: {
        padding: 4,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    typeSelector: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 20,
    },
    typeButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: modernColors.primary,
        backgroundColor: '#fff',
    },
    typeButtonSelected: {
        backgroundColor: modernColors.primary,
    },
    typeButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
    },
    typeButtonTextSelected: {
        color: '#fff',
    },
    inputContainer: {
        marginBottom: 20,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    input: {
        padding: 12,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        fontSize: 14,
        color: '#111827',
    },
    modalFooter: {
        flexDirection: 'row',
        gap: 12,
    },
    modalButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: 'center',
    },
    cancelButton: {
        backgroundColor: '#F3F4F6',
    },
    saveButton: {
        backgroundColor: modernColors.primary,
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
    },
    saveButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
});

export default CompanySelector;

