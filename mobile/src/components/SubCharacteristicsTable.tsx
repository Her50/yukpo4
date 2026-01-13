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
import { useToaster } from './ToasterProvider'; // ✅ NOUVEAU: Pour afficher les toasts de confirmation

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
    valeur?: string; // ✅ NOUVEAU : Valeur parsée de la chaîne séparée par virgules (ex: "Renault,Clio,2019,Essence")
    productLabels?: string[]; // ✅ NOUVEAU : Ordre garanti des labels (ex: ["marque", "modele", "annee", "carburant"])
}

export const SubCharacteristicsTable: React.FC<SubCharacteristicsTableProps> = ({
    sousCaracteristiques,
    separateur,
    onValidate,
    initialRows,
    onRowsChange, // ✅ NOUVEAU : Callback pour sauvegarder automatiquement
    valeur, // ✅ NOUVEAU : Valeur parsée
    productLabels, // ✅ NOUVEAU : Ordre garanti des labels
}) => {
    // ✅ NOUVEAU: Toast pour les notifications
    const toaster = useToaster();
    
    // État du tableau : chaque ligne contient un label et une valeur
    const [rows, setRows] = useState<SubCharacteristicRow[]>([]);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editingLabel, setEditingLabel] = useState('');
    const [editingValue, setEditingValue] = useState('');
    const [isValidating, setIsValidating] = useState(false);
    const [isValidated, setIsValidated] = useState(false);
    const [validatedRowsSnapshot, setValidatedRowsSnapshot] = useState<SubCharacteristicRow[]>([]); // ✅ NOUVEAU: Snapshot des lignes validées
    const scrollViewRef = useRef<ScrollView>(null);
    const labelInputRef = useRef<TextInput>(null);
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const borderAnim = useRef(new Animated.Value(0)).current; // ✅ NOUVEAU: Animation pour la bordure verte

    // Initialiser le tableau avec les sous-caractéristiques préférées de l'IA
    useEffect(() => {
        if (initialRows && initialRows.length > 0) {
            // Si on a des lignes initiales (déjà validées), les utiliser
            setRows(initialRows);
        } else if (sousCaracteristiques && Object.keys(sousCaracteristiques).length > 0) {
            // ✅ CORRECTION CRITIQUE: Utiliser la valeur parsée si disponible pour garantir l'alignement correct
            const initialRowsFromIA: SubCharacteristicRow[] = [];
            
            // ✅ DEBUG: Logger les données reçues pour diagnostiquer le problème
            console.log('[SubCharacteristicsTable] 🔍 sousCaracteristiques reçues:', JSON.stringify(sousCaracteristiques, null, 2));
            console.log('[SubCharacteristicsTable] 🔍 valeur parsée:', valeur);
            console.log('[SubCharacteristicsTable] 🔍 productLabels:', productLabels);
            
            // ✅ NOUVEAU: Si on a une valeur parsée, l'utiliser pour mapper correctement les labels et valeurs
            if (valeur && valeur.trim().length > 0) {
                // Parser la valeur en utilisant le séparateur
                const parsedValues = valeur.split(separateur).map(v => v.trim()).filter(v => v.length > 0);
                console.log('[SubCharacteristicsTable] 🔍 Valeurs parsées:', parsedValues);
                
                // Déterminer l'ordre des labels
                // Priorité 1: productLabels (ordre garanti depuis l'IA) - CRITIQUE pour l'alignement
                // Priorité 2: Ordre des clés dans sousCaracteristiques
                // ✅ CORRECTION CRITIQUE: Utiliser productLabels dans l'ordre exact pour garantir l'alignement
                const orderedLabels = (productLabels && Array.isArray(productLabels) && productLabels.length > 0)
                    ? productLabels.filter(label => label && typeof label === 'string' && label.trim().length > 0)
                    : Object.keys(sousCaracteristiques);
                
                console.log('[SubCharacteristicsTable] 🔍 Labels ordonnés depuis productLabels:', orderedLabels);
                console.log('[SubCharacteristicsTable] 🔍 Nombre de valeurs parsées:', parsedValues.length);
                console.log('[SubCharacteristicsTable] 🔍 Nombre de labels ordonnés:', orderedLabels.length);
                console.log('[SubCharacteristicsTable] 🔍 Clés dans sousCaracteristiques:', Object.keys(sousCaracteristiques));
                
                // ✅ CORRECTION CRITIQUE: Mapper chaque valeur parsée à son label correspondant dans l'ordre
                // L'ordre est garanti par productLabels qui correspond à l'ordre des valeurs dans la chaîne parsée
                parsedValues.forEach((parsedValue, index) => {
                    let label: string;
                    
                    if (index < orderedLabels.length) {
                        // ✅ CORRECTION: Utiliser le label à la même position que la valeur (alignement garanti)
                        label = orderedLabels[index];
                    } else {
                        // ✅ Si on a plus de valeurs que de labels, essayer de trouver un label correspondant dans sousCaracteristiques
                        // en cherchant quelle clé contient cette valeur
                        const matchingLabel = Object.keys(sousCaracteristiques).find(key => {
                            const values = sousCaracteristiques[key];
                            return Array.isArray(values) && values.includes(parsedValue);
                        });
                        
                        if (matchingLabel) {
                            label = matchingLabel;
                            console.log(`[SubCharacteristicsTable] 🔍 Valeur "${parsedValue}" correspond au label "${matchingLabel}"`);
                        } else {
                            // Dernier recours: utiliser un label générique mais descriptif
                            label = `caractéristique_${index + 1}`;
                            console.warn(`[SubCharacteristicsTable] ⚠️ Aucun label trouvé pour valeur "${parsedValue}", utilisation label générique: "${label}"`);
                        }
                    }
                    
                    const row = {
                        label: label.trim(),
                        value: parsedValue.trim(),
                    };
                    console.log(`[SubCharacteristicsTable] ✅ Ligne créée depuis valeur parsée [index ${index}]: ${row.label} = ${row.value}`);
                    initialRowsFromIA.push(row);
                });
                
                // Ajouter les labels manquants (qui n'ont pas de valeur dans la chaîne parsée)
                orderedLabels.forEach((label, index) => {
                    if (index >= parsedValues.length) {
                        // Ce label n'a pas de valeur dans la chaîne parsée, utiliser la première valeur du tableau
                        const values = sousCaracteristiques[label];
                        if (Array.isArray(values) && values.length > 0) {
                            const defaultValue = values[0];
                            if (defaultValue && typeof defaultValue === 'string' && defaultValue.trim().length > 0) {
                                const row = {
                                    label: label.trim(),
                                    value: defaultValue.trim(),
                                };
                                console.log(`[SubCharacteristicsTable] ✅ Ligne créée depuis sousCaracteristiques (label manquant): ${row.label} = ${row.value}`);
                                initialRowsFromIA.push(row);
                            }
                        }
                    }
                });
            } else {
                // ✅ FALLBACK: Si pas de valeur parsée, utiliser l'ancienne méthode (première valeur de chaque tableau)
                // Mais utiliser productLabels pour l'ordre si disponible
                // ✅ CORRECTION CRITIQUE: Utiliser productLabels dans l'ordre exact pour garantir l'alignement
                const orderedLabels = (productLabels && Array.isArray(productLabels) && productLabels.length > 0)
                    ? productLabels.filter(label => label && typeof label === 'string' && label.trim().length > 0)
                    : Object.keys(sousCaracteristiques);
                
                console.log('[SubCharacteristicsTable] 🔍 FALLBACK - Labels ordonnés depuis productLabels:', orderedLabels);
                
                // ✅ CORRECTION: Parcourir les labels dans l'ordre garanti par productLabels
                orderedLabels.forEach((label, index) => {
                    const values = sousCaracteristiques[label];
                    if (Array.isArray(values) && values.length > 0) {
                        const preferredValue = values[0];
                        console.log(`[SubCharacteristicsTable] 🔍 Label "${label}" [index ${index}] - Première valeur extraite: "${preferredValue}"`);
                        
                        if (preferredValue && typeof preferredValue === 'string' && preferredValue.trim().length > 0) {
                            const row = {
                                label: label.trim(),
                                value: preferredValue.trim(),
                            };
                            console.log(`[SubCharacteristicsTable] ✅ Ligne créée [index ${index}]: ${row.label} = ${row.value}`);
                            initialRowsFromIA.push(row);
                        } else {
                            console.warn(`[SubCharacteristicsTable] ⚠️ Label "${label}" [index ${index}] - Première valeur invalide:`, preferredValue);
                        }
                    } else {
                        // ✅ NOUVEAU: Si le label n'existe pas dans sousCaracteristiques, créer une ligne vide pour permettre l'édition
                        console.log(`[SubCharacteristicsTable] 🔍 Label "${label}" [index ${index}] - Non trouvé dans sousCaracteristiques, création ligne vide`);
                        const row = {
                            label: label.trim(),
                            value: '', // Ligne vide pour permettre l'édition
                        };
                        initialRowsFromIA.push(row);
                    }
                });
            }
            
            console.log('[SubCharacteristicsTable] ✅ Tableau final initialisé avec', initialRowsFromIA.length, 'lignes:', 
                initialRowsFromIA.map(r => `${r.label}: ${r.value}`).join(', '));
            setRows(initialRowsFromIA);
        }
    }, [sousCaracteristiques, initialRows, valeur, separateur, productLabels]);

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

    // ✅ NOUVEAU: Détecter les changements dans les lignes après validation pour réactiver le bouton
    useEffect(() => {
        if (isValidated && validatedRowsSnapshot.length > 0) {
            // Comparer les lignes actuelles avec le snapshot validé
            const currentValidRows = rows.filter(r => r.label.trim() && r.value.trim());
            const hasChanged = 
                currentValidRows.length !== validatedRowsSnapshot.length ||
                currentValidRows.some((row, index) => {
                    const validatedRow = validatedRowsSnapshot[index];
                    return !validatedRow || 
                           row.label !== validatedRow.label || 
                           row.value !== validatedRow.value;
                });
            
            if (hasChanged) {
                // Les lignes ont changé, réactiver le bouton
                setIsValidated(false);
                setValidatedRowsSnapshot([]);
                console.log('[SubCharacteristicsTable] 🔄 Changements détectés, réactivation du bouton Valider');
            }
        }
    }, [rows, isValidated, validatedRowsSnapshot]);

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
        
        // ✅ NOUVEAU: Réactiver le bouton si on modifie après validation
        if (isValidated) {
            setIsValidated(false);
            setValidatedRowsSnapshot([]);
        }
        
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
        
        // ✅ NOUVEAU: Réactiver le bouton si on supprime après validation
        if (isValidated) {
            setIsValidated(false);
            setValidatedRowsSnapshot([]);
        }
        
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
        
        // ✅ NOUVEAU: Réactiver le bouton si on ajoute après validation
        if (isValidated) {
            setIsValidated(false);
            setValidatedRowsSnapshot([]);
        }
        
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

            // ✅ FEEDBACK VISUEL: Afficher le succès avec animation
            setIsValidated(true);
            setValidatedRowsSnapshot(validRows); // ✅ NOUVEAU: Sauvegarder le snapshot des lignes validées
            console.log('[SubCharacteristicsTable] ✅ Sous-caractéristiques validées et sauvegardées');

            // ✅ NOUVEAU: Afficher un toast de confirmation
            const nbCaracteristiques = validRows.length;
            toaster.success(
                `✅ ${nbCaracteristiques} sous-caractéristique${nbCaracteristiques > 1 ? 's' : ''} validée${nbCaracteristiques > 1 ? 's' : ''} avec succès !`
            );

            // ✅ NOUVEAU: Animation de la bordure verte pour feedback visuel clair
            Animated.sequence([
                Animated.timing(borderAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: false,
                }),
                Animated.delay(2500), // Maintenir la bordure verte pendant 2.5s
                Animated.timing(borderAnim, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: false,
                }),
            ]).start();
            // ✅ NOTE: On ne remet plus setIsValidated(false) automatiquement pour garder le bouton grisé
        } catch (error) {
            console.error('[SubCharacteristicsTable] ❌ Erreur validation:', error);
            toaster.error('❌ Erreur lors de la validation. Veuillez réessayer.');
            // ✅ Afficher un message d'erreur (sera géré par le parent si nécessaire)
        } finally {
            setIsValidating(false);
        }
    };

    // ✅ NOUVEAU: Couleur de bordure animée pour feedback visuel
    const borderColor = borderAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [modernColors.border, '#10B981'], // Gris -> Vert
    });

    return (
        <Animated.View style={[styles.container, { borderColor }]}>
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
                            isValidated && styles.validateButtonDisabled, // ✅ NOUVEAU: Griser le bouton après validation
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
                                <SafeIcon name="check-circle" size={20} color="#FFFFFF" />
                                <Text style={[styles.validateButtonText, styles.validateButtonTextSuccess]}>✓ Sauvegardé !</Text>
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
            
            {/* ✅ NOUVEAU: Badge de validation réussie (affiché de manière persistante) */}
            {isValidated && (
                <View style={styles.successBadge}>
                    <SafeIcon name="check-circle" size={16} color="#10B981" />
                    <Text style={styles.successBadgeText}>Validation réussie</Text>
                </View>
            )}
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        borderWidth: 2, // ✅ AUGMENTÉ: Bordure plus épaisse pour meilleure visibilité
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
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    validateButtonDisabled: {
        backgroundColor: '#9CA3AF',
        opacity: 0.5,
    },
    validateButtonSuccess: {
        backgroundColor: '#10B981', // Vert plus foncé pour le succès
        shadowColor: '#10B981',
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 5,
    },
    validateButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    validateButtonTextSuccess: {
        fontSize: 15, // ✅ Légèrement plus grand pour le succès
        fontWeight: '700', // ✅ Plus gras pour le succès
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
    // ✅ NOUVEAU: Badge de validation réussie
    successBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#D1FAE5', // Vert très clair
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderTopWidth: 1,
        borderTopColor: '#10B981',
        gap: 6,
    },
    successBadgeText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#065F46', // Vert foncé pour contraste
    },
});

export default SubCharacteristicsTable;

