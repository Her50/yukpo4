/**
 * Composant SubCharacteristicsTable
 * Affiche les sous-caractéristiques d'un produit sous forme de tableau éditable
 * Deux colonnes : Label (nom de la caractéristique) et Valeur
 * Permet d'ajouter, modifier et supprimer des lignes
 */

import React, { useEffect, useState, useRef } from 'react';
import {
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    ScrollView,
    ActivityIndicator,
    Animated,
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
    onRowsChange?: (rows: SubCharacteristicRow[]) => void; // ✅ NOUVEAU : Callback pour sauvegarder automatiquement les modifications
}

export const SubCharacteristicsTable: React.FC<SubCharacteristicsTableProps> = ({
    sousCaracteristiques,
    separateur,
    onValidate,
    initialRows,
    onRowsChange, // ✅ NOUVEAU : Callback pour sauvegarder automatiquement
}) => {
    // État du tableau : chaque ligne contient un label et une valeur
    const [rows, setRows] = useState<SubCharacteristicRow[]>([]);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editingLabel, setEditingLabel] = useState('');
    const [editingValue, setEditingValue] = useState('');
    const [isValidating, setIsValidating] = useState(false);
    const [isValidated, setIsValidated] = useState(false);
    const scrollViewRef = useRef<ScrollView>(null);
    const labelInputRef = useRef<TextInput>(null);
    const scaleAnim = useRef(new Animated.Value(1)).current;

    // Initialiser le tableau avec les sous-caractéristiques préférées de l'IA
    useEffect(() => {
        if (initialRows && initialRows.length > 0) {
            // Si on a des lignes initiales (déjà validées), les utiliser
            setRows(initialRows);
        } else if (sousCaracteristiques && Object.keys(sousCaracteristiques).length > 0) {
            // Sinon, construire depuis les sous-caractéristiques préférées de l'IA
            // Les valeurs préférées sont les premières valeurs de chaque tableau
            const initialRowsFromIA: SubCharacteristicRow[] = [];
            
            // ✅ DEBUG: Logger les données reçues pour diagnostiquer le problème
            console.log('[SubCharacteristicsTable] 🔍 sousCaracteristiques reçues:', JSON.stringify(sousCaracteristiques, null, 2));
            
            // ✅ CORRECTION: Utiliser Object.keys() puis accéder directement aux valeurs pour garantir le bon mapping
            Object.keys(sousCaracteristiques).forEach((label) => {
                const values = sousCaracteristiques[label];
                
                // ✅ DEBUG: Logger chaque label et ses valeurs
                console.log(`[SubCharacteristicsTable] 🔍 Label: "${label}", Type valeurs:`, typeof values, 'Est array:', Array.isArray(values), 'Valeurs:', values);
                
                if (Array.isArray(values) && values.length > 0) {
                    // ✅ CRITIQUE: Prendre la première valeur (préférée par l'IA) de ce label spécifique
                    // Ne pas utiliser d'index global, mais directement values[0] pour ce label
                    const preferredValue = values[0];
                    console.log(`[SubCharacteristicsTable] 🔍 Label "${label}" - Première valeur extraite: "${preferredValue}"`);
                    
                    if (preferredValue && typeof preferredValue === 'string' && preferredValue.trim().length > 0) {
                        const row = {
                            label: label.trim(),
                            value: preferredValue.trim(),
                        };
                        console.log(`[SubCharacteristicsTable] ✅ Ligne créée: ${row.label} = ${row.value}`);
                        initialRowsFromIA.push(row);
                    } else {
                        console.warn(`[SubCharacteristicsTable] ⚠️ Label "${label}" - Première valeur invalide:`, preferredValue);
                    }
                } else {
                    console.warn(`[SubCharacteristicsTable] ⚠️ Label "${label}" - Valeurs non valides ou vides:`, values);
                }
            });
            
            console.log('[SubCharacteristicsTable] ✅ Tableau final initialisé avec', initialRowsFromIA.length, 'lignes:', 
                initialRowsFromIA.map(r => `${r.label}: ${r.value}`).join(', '));
            setRows(initialRowsFromIA);
        }
    }, [sousCaracteristiques, initialRows]);

    // Focus automatique sur le premier input quand une nouvelle ligne est ajoutée
    useEffect(() => {
        if (editingIndex !== null && rows[editingIndex]?.label === '' && rows[editingIndex]?.value === '') {
            // Nouvelle ligne vide, focus sur le label input
            setTimeout(() => {
                if (labelInputRef.current) {
                    labelInputRef.current.focus();
                }
            }, 300);
        }
    }, [editingIndex, rows]);

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
        
        // ✅ NOUVEAU : Sauvegarder automatiquement dans le formulaire (sans DB)
        if (onRowsChange) {
            onRowsChange(newRows);
        }
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
        
        // ✅ NOUVEAU : Sauvegarder automatiquement dans le formulaire (sans DB)
        if (onRowsChange) {
            onRowsChange(newRows);
        }
    };

    // Ajouter une nouvelle ligne
    const addRow = () => {
        const newRows = [...rows, { label: '', value: '' }];
        const newIndex = newRows.length - 1;
        setRows(newRows);
        // Démarrer l'édition de la nouvelle ligne
        setEditingIndex(newIndex);
        setEditingLabel('');
        setEditingValue('');
        
        // ✅ NOUVEAU : Sauvegarder automatiquement dans le formulaire (sans DB)
        // Note : On ne sauvegarde pas les lignes vides, seulement après édition
        // if (onRowsChange) {
        //     onRowsChange(newRows);
        // }
        
        // Scroller vers la nouvelle ligne après un court délai pour permettre le rendu
        setTimeout(() => {
            if (scrollViewRef.current) {
                // Calculer la position approximative de la nouvelle ligne
                // Chaque ligne fait environ 60px de hauteur (padding + contenu)
                const lineHeight = 60;
                const scrollToY = newIndex * lineHeight;
                scrollViewRef.current.scrollTo({
                    y: scrollToY,
                    animated: true,
                });
            }
        }, 100);
    };

    // Valider le tableau et convertir en format attendu
    const validateTable = async () => {
        // ✅ PROTECTION : Empêcher les clics multiples
        if (isValidating || isValidated) {
            console.log('[SubCharacteristicsTable] ⚠️ Validation déjà en cours ou déjà validé, ignoré');
            return;
        }

        // Filtrer les lignes vides
        const validRows = rows.filter(row => 
            row.label.trim().length > 0 && row.value.trim().length > 0
        );

        if (validRows.length === 0) {
            // Si aucune ligne valide, ne rien faire
            return;
        }

        // ✅ FEEDBACK VISUEL: Animation et état de validation
        setIsValidating(true);
        
        // Animation de scale pour le bouton
        Animated.sequence([
            Animated.timing(scaleAnim, {
                toValue: 0.95,
                duration: 100,
                useNativeDriver: true,
            }),
            Animated.timing(scaleAnim, {
                toValue: 1,
                duration: 100,
                useNativeDriver: true,
            }),
        ]).start();

        try {
            // ✅ NOUVEAU : Appeler onValidate avec gestion d'erreur
            // onValidate peut maintenant être async et retourner une Promise
            const result = onValidate(validRows);
            if (result && typeof result.then === 'function') {
                await result;
            }

            // ✅ FEEDBACK VISUEL: Afficher le succès
            setIsValidated(true);
            console.log('[SubCharacteristicsTable] ✅ Sous-caractéristiques validées et sauvegardées');

            // Réinitialiser l'état de succès après 3 secondes (augmenté pour meilleure visibilité)
            setTimeout(() => {
                setIsValidated(false);
            }, 3000);
        } catch (error) {
            console.error('[SubCharacteristicsTable] ❌ Erreur validation:', error);
            // ✅ Afficher un message d'erreur (sera géré par le parent si nécessaire)
        } finally {
            setIsValidating(false);
        }
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
            <ScrollView 
                ref={scrollViewRef}
                style={styles.tableBody} 
                nestedScrollEnabled
            >
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
                                            ref={editingIndex === index ? labelInputRef : undefined}
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
                <Animated.View style={{ flex: 1, transform: [{ scale: scaleAnim }] }}>
                    <TouchableOpacity
                        style={[
                            styles.validateButton,
                            rows.filter(r => r.label.trim() && r.value.trim()).length === 0 && styles.validateButtonDisabled,
                            isValidated && styles.validateButtonSuccess
                        ]}
                        onPress={validateTable}
                        disabled={rows.filter(r => r.label.trim() && r.value.trim()).length === 0 || isValidating || isValidated}
                    >
                        {isValidating ? (
                            <>
                                <ActivityIndicator size="small" color="#FFFFFF" />
                                <Text style={styles.validateButtonText}>Sauvegarde...</Text>
                            </>
                        ) : isValidated ? (
                            <>
                                <SafeIcon name="check-circle" size={18} color="#FFFFFF" />
                                <Text style={styles.validateButtonText}>Sauvegardé !</Text>
                            </>
                        ) : (
                            <>
                                <SafeIcon name="check-circle" size={18} color="#FFFFFF" />
                                <Text style={styles.validateButtonText}>Valider</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </Animated.View>
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
    validateButtonSuccess: {
        backgroundColor: '#10B981', // Vert plus foncé pour le succès
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

