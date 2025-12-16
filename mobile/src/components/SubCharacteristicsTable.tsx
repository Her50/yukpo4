/**
 * Composant SubCharacteristicsTable
 * Affiche les sous-caractéristiques d'un produit sous forme de tableau éditable
 * Deux colonnes : Label (nom de la caractéristique) et Valeur
 * Permet d'ajouter, modifier et supprimer des lignes
 */

import React, { useEffect, useState } from 'react';
import {
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    ScrollView,
} from 'react-native';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';

export interface SubCharacteristicRow {
    label: string;
    value: string;
}

interface SubCharacteristicsTableProps {
    sousCaracteristiques: Record<string, string[]>; // Ex: { marque: ["Nike"], type: ["Chemise"], annee: ["2023"] }
    separateur: string;
    onValidate: (rows: SubCharacteristicRow[]) => void; // Callback avec les lignes validées
    initialRows?: SubCharacteristicRow[]; // Lignes initiales si déjà validées
}

export const SubCharacteristicsTable: React.FC<SubCharacteristicsTableProps> = ({
    sousCaracteristiques,
    separateur,
    onValidate,
    initialRows,
}) => {
    // État du tableau : chaque ligne contient un label et une valeur
    const [rows, setRows] = useState<SubCharacteristicRow[]>([]);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editingLabel, setEditingLabel] = useState('');
    const [editingValue, setEditingValue] = useState('');

    // Initialiser le tableau avec les sous-caractéristiques préférées de l'IA
    useEffect(() => {
        if (initialRows && initialRows.length > 0) {
            // Si on a des lignes initiales (déjà validées), les utiliser
            setRows(initialRows);
        } else if (sousCaracteristiques && Object.keys(sousCaracteristiques).length > 0) {
            // Sinon, construire depuis les sous-caractéristiques préférées de l'IA
            // Les valeurs préférées sont les premières valeurs de chaque tableau
            const initialRowsFromIA: SubCharacteristicRow[] = [];
            Object.entries(sousCaracteristiques).forEach(([label, values]) => {
                if (Array.isArray(values) && values.length > 0) {
                    // Prendre la première valeur (préférée par l'IA)
                    const preferredValue = values[0];
                    if (preferredValue && typeof preferredValue === 'string' && preferredValue.trim().length > 0) {
                        initialRowsFromIA.push({
                            label: label.trim(),
                            value: preferredValue.trim(),
                        });
                    }
                }
            });
            setRows(initialRowsFromIA);
        }
    }, [sousCaracteristiques, initialRows]);

    // Modifier une ligne
    const startEditing = (index: number) => {
        const row = rows[index];
        setEditingIndex(index);
        setEditingLabel(row.label);
        setEditingValue(row.value);
    };

    // Sauvegarder les modifications
    const saveEditing = () => {
        if (editingIndex === null) return;

        const newRows = [...rows];
        if (editingIndex >= 0 && editingIndex < newRows.length) {
            newRows[editingIndex] = {
                label: editingLabel.trim(),
                value: editingValue.trim(),
            };
        }
        setRows(newRows);
        setEditingIndex(null);
        setEditingLabel('');
        setEditingValue('');
    };

    // Annuler l'édition
    const cancelEditing = () => {
        setEditingIndex(null);
        setEditingLabel('');
        setEditingValue('');
    };

    // Supprimer une ligne
    const removeRow = (index: number) => {
        const newRows = rows.filter((_, i) => i !== index);
        setRows(newRows);
    };

    // Ajouter une nouvelle ligne
    const addRow = () => {
        const newRows = [...rows, { label: '', value: '' }];
        setRows(newRows);
        // Démarrer l'édition de la nouvelle ligne
        setEditingIndex(newRows.length - 1);
        setEditingLabel('');
        setEditingValue('');
    };

    // Valider le tableau et convertir en format attendu
    const validateTable = () => {
        // Filtrer les lignes vides
        const validRows = rows.filter(row => 
            row.label.trim().length > 0 && row.value.trim().length > 0
        );

        if (validRows.length === 0) {
            // Si aucune ligne valide, ne rien faire
            return;
        }

        // Appeler le callback avec les lignes validées
        onValidate(validRows);
    };

    return (
        <View style={styles.container}>
            {/* En-tête du tableau */}
            <View style={styles.header}>
                <Text style={styles.headerLabel}>Label</Text>
                <Text style={styles.headerValue}>Valeur</Text>
                <Text style={styles.headerActions}>Actions</Text>
            </View>

            {/* Corps du tableau */}
            <ScrollView style={styles.tableBody} nestedScrollEnabled>
                {rows.length === 0 ? (
                    <View style={styles.emptyState}>
                        <SafeIcon name="info" size={24} color={modernColors.textSecondary} />
                        <Text style={styles.emptyText}>
                            Aucune sous-caractéristique
                        </Text>
                        <Text style={styles.emptySubtext}>
                            Cliquez sur "Ajouter" pour créer une nouvelle ligne
                        </Text>
                    </View>
                ) : (
                    rows.map((row, index) => (
                        <View key={index} style={styles.row}>
                            {editingIndex === index ? (
                                // Mode édition
                                <>
                                    <View style={styles.editingCell}>
                                        <TextInput
                                            style={styles.editingInput}
                                            placeholder="Label"
                                            placeholderTextColor="#9CA3AF"
                                            value={editingLabel}
                                            onChangeText={setEditingLabel}
                                            autoCapitalize="none"
                                        />
                                    </View>
                                    <View style={styles.editingCell}>
                                        <TextInput
                                            style={styles.editingInput}
                                            placeholder="Valeur"
                                            placeholderTextColor="#9CA3AF"
                                            value={editingValue}
                                            onChangeText={setEditingValue}
                                            autoCapitalize="none"
                                        />
                                    </View>
                                    <View style={styles.actionsCell}>
                                        <TouchableOpacity
                                            style={styles.saveButton}
                                            onPress={saveEditing}
                                        >
                                            <SafeIcon name="check" size={16} color="#FFFFFF" />
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.cancelButton}
                                            onPress={cancelEditing}
                                        >
                                            <SafeIcon name="x" size={16} color={modernColors.error} />
                                        </TouchableOpacity>
                                    </View>
                                </>
                            ) : (
                                // Mode affichage
                                <>
                                    <View style={styles.cell}>
                                        <Text style={styles.cellText} numberOfLines={1}>
                                            {row.label || '—'}
                                        </Text>
                                    </View>
                                    <View style={styles.cell}>
                                        <Text style={styles.cellText} numberOfLines={1}>
                                            {row.value || '—'}
                                        </Text>
                                    </View>
                                    <View style={styles.actionsCell}>
                                        <TouchableOpacity
                                            style={styles.editButton}
                                            onPress={() => startEditing(index)}
                                        >
                                            <SafeIcon name="edit" size={16} color={modernColors.primary} />
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.deleteButton}
                                            onPress={() => removeRow(index)}
                                        >
                                            <SafeIcon name="trash-2" size={16} color={modernColors.error} />
                                        </TouchableOpacity>
                                    </View>
                                </>
                            )}
                        </View>
                    ))
                )}
            </ScrollView>

            {/* Boutons d'action en bas */}
            <View style={styles.footer}>
                <TouchableOpacity
                    style={styles.addButton}
                    onPress={addRow}
                >
                    <SafeIcon name="plus" size={18} color="#FFFFFF" />
                    <Text style={styles.addButtonText}>Ajouter</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[
                        styles.validateButton,
                        rows.filter(r => r.label.trim() && r.value.trim()).length === 0 && styles.validateButtonDisabled
                    ]}
                    onPress={validateTable}
                    disabled={rows.filter(r => r.label.trim() && r.value.trim()).length === 0}
                >
                    <SafeIcon name="check-circle" size={18} color="#FFFFFF" />
                    <Text style={styles.validateButtonText}>Valider</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: modernColors.border,
        overflow: 'hidden',
        marginVertical: 8,
    },
    header: {
        flexDirection: 'row',
        backgroundColor: modernColors.primary + '15',
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderBottomWidth: 2,
        borderBottomColor: modernColors.primary,
    },
    headerLabel: {
        flex: 2,
        fontSize: 13,
        fontWeight: '700',
        color: modernColors.primary,
    },
    headerValue: {
        flex: 2,
        fontSize: 13,
        fontWeight: '700',
        color: modernColors.primary,
    },
    headerActions: {
        flex: 1,
        fontSize: 13,
        fontWeight: '700',
        color: modernColors.primary,
        textAlign: 'center',
    },
    tableBody: {
        maxHeight: 300,
    },
    row: {
        flexDirection: 'row',
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
        alignItems: 'center',
    },
    cell: {
        flex: 2,
        paddingRight: 8,
    },
    cellText: {
        fontSize: 14,
        color: modernColors.text,
    },
    editingCell: {
        flex: 2,
        paddingRight: 8,
    },
    editingInput: {
        borderWidth: 1,
        borderColor: modernColors.primary,
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 6,
        fontSize: 14,
        color: modernColors.text,
        backgroundColor: '#F9FAFB',
    },
    actionsCell: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
    },
    editButton: {
        padding: 6,
    },
    deleteButton: {
        padding: 6,
    },
    saveButton: {
        backgroundColor: modernColors.success,
        padding: 6,
        borderRadius: 6,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelButton: {
        backgroundColor: '#FEE2E2',
        padding: 6,
        borderRadius: 6,
        alignItems: 'center',
        justifyContent: 'center',
    },
    footer: {
        flexDirection: 'row',
        gap: 12,
        padding: 12,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
        backgroundColor: '#F9FAFB',
    },
    addButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: modernColors.primary,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        gap: 6,
    },
    addButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    validateButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: modernColors.success,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        gap: 6,
    },
    validateButtonDisabled: {
        backgroundColor: '#9CA3AF',
        opacity: 0.5,
    },
    validateButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 32,
        gap: 8,
    },
    emptyText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.textSecondary,
    },
    emptySubtext: {
        fontSize: 12,
        color: modernColors.textSecondary,
        textAlign: 'center',
    },
});

export default SubCharacteristicsTable;

