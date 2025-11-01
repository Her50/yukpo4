/**
 * DynamicAutocompleteFilters
 * Système de filtres intelligent basé sur les caractéristiques autocomplete des produits
 * S'adapte dynamiquement aux données disponibles au lieu d'utiliser categoryConfig
 */

import React, { useEffect, useState } from 'react';
import {
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { modernColors } from '../theme/modernTheme';
import LinearAutocompleteEditor from './LinearAutocompleteEditor';
import LocationProximityFilter from './LocationProximityFilter';
import SafeIcon from './SafeIcon';

interface DynamicAutocompleteFiltersProps {
    visible: boolean;
    onClose: () => void;
    availableCharacteristics: Record<string, Set<string>>; // Ex: { marque: Set(['Toyota', 'Honda']), couleur: Set(['Noir', 'Blanc']) }
    onApply: (filters: Record<string, string[]>, locationCoords?: { lat: number, lon: number } | null, locationRadius?: number | null) => void;
    initialFilters?: Record<string, string[]>;
    initialLocationCoords?: { lat: number, lon: number } | null;
    initialLocationRadius?: number | null;
    categoryName?: string;
    categoryIcon?: string;
}

export const DynamicAutocompleteFilters: React.FC<DynamicAutocompleteFiltersProps> = ({
    visible,
    onClose,
    availableCharacteristics,
    onApply,
    initialFilters = {},
    initialLocationCoords = null,
    initialLocationRadius = 10,
    categoryName = 'Filtrer les résultats',
    categoryIcon = '🔍',
}) => {
    const [selectedFilters, setSelectedFilters] = useState<Record<string, string[]>>(initialFilters);
    const [editingCharacteristic, setEditingCharacteristic] = useState<string | null>(null);
    const [locationCoords, setLocationCoords] = useState<{ lat: number, lon: number } | null>(initialLocationCoords);
    const [locationRadius, setLocationRadius] = useState<number | null>(initialLocationRadius);

    // Synchroniser avec initialFilters
    useEffect(() => {
        setSelectedFilters(initialFilters);
    }, [initialFilters]);

    // Obtenir le nombre total de filtres actifs
    const activeFiltersCount = Object.keys(selectedFilters).reduce(
        (sum, key) => sum + (selectedFilters[key]?.length || 0),
        0
    );

    // Appliquer les filtres
    const handleApply = () => {
        console.log('[DynamicAutocompleteFilters] Application filtres:', {
            characteristics: selectedFilters,
            location: locationCoords,
            radius: locationRadius
        });
        onApply(selectedFilters, locationCoords, locationRadius);
        onClose();
    };

    // Réinitialiser tous les filtres
    const handleReset = () => {
        setSelectedFilters({});
    };

    // Ouvrir l'éditeur pour une caractéristique
    const handleEditCharacteristic = (charKey: string) => {
        setEditingCharacteristic(charKey);
    };

    // Fermer l'éditeur et sauvegarder
    const handleSaveCharacteristic = (values: string[]) => {
        if (editingCharacteristic) {
            setSelectedFilters(prev => ({
                ...prev,
                [editingCharacteristic]: values
            }));
        }
        setEditingCharacteristic(null);
    };

    // Supprimer un filtre
    const handleRemoveFilter = (charKey: string) => {
        setSelectedFilters(prev => {
            const newFilters = { ...prev };
            delete newFilters[charKey];
            return newFilters;
        });
    };

    // Convertir Set en sous_caracteristiques pour LinearAutocompleteEditor
    const getSousCaracteristiquesForEditor = (charKey: string) => {
        const values = Array.from(availableCharacteristics[charKey] || []);
        return {
            [charKey]: values
        };
    };

    // Obtenir l'icône pour une caractéristique
    const getCharIcon = (charKey: string): string => {
        const iconMap: Record<string, string> = {
            marque: '🏷️',
            modele: '📦',
            annee: '📅',
            couleur: '🎨',
            taille: '📏',
            pointure: '👟',
            matiere: '🧵',
            style: '✨',
            type: '🔖',
            etat: '⭐',
            version: '🔢',
            carburant: '⛽',
            transmission: '⚙️',
            puissance: '⚡',
            kilometrage: '🛣️',
            dimensions: '📐',
            poids: '⚖️',
            forme: '◾',
            nombre_de_places: '👥',
            capacite: '📊',
        };
        return iconMap[charKey.toLowerCase()] || '🔍';
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={false}
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerTitle}>
                        <Text style={styles.headerIcon}>{categoryIcon}</Text>
                        <View style={styles.headerTextContainer}>
                            <Text style={styles.headerTitleText}>{categoryName}</Text>
                            {activeFiltersCount > 0 && (
                                <Text style={styles.headerSubtitle}>
                                    {activeFiltersCount} filtre{activeFiltersCount > 1 ? 's' : ''} actif{activeFiltersCount > 1 ? 's' : ''}
                                </Text>
                            )}
                        </View>
                    </View>
                    <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                        <SafeIcon name="x" size={24} color={modernColors.text} />
                    </TouchableOpacity>
                </View>

                {/* Filtres actifs */}
                {activeFiltersCount > 0 && (
                    <View style={styles.activeFiltersSection}>
                        <Text style={styles.sectionTitle}>✓ Filtres actifs</Text>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.activeFiltersScroll}
                        >
                            {Object.entries(selectedFilters).map(([key, values]) => (
                                values && values.length > 0 && (
                                    <View key={key} style={styles.activeFilterChip}>
                                        <Text style={styles.activeFilterKey}>{key}:</Text>
                                        <Text style={styles.activeFilterValue} numberOfLines={1}>
                                            {values.join(', ')}
                                        </Text>
                                        <TouchableOpacity onPress={() => handleRemoveFilter(key)}>
                                            <SafeIcon name="x" size={14} color={modernColors.error} />
                                        </TouchableOpacity>
                                    </View>
                                )
                            ))}
                        </ScrollView>
                    </View>
                )}

                {/* Localisation et proximité */}
                <View style={styles.locationSection}>
                    <LocationProximityFilter
                        onLocationChange={(coords, radius) => {
                            setLocationCoords(coords);
                            setLocationRadius(radius);
                        }}
                        initialRadius={initialLocationRadius}
                    />
                </View>

                {/* Caractéristiques disponibles */}
                <ScrollView style={styles.characteristicsScroll}>
                    <Text style={styles.sectionTitle}>🎯 Caractéristiques disponibles</Text>
                    <Text style={styles.sectionDescription}>
                        Tapez sur une caractéristique pour filtrer par ses valeurs
                    </Text>

                    <View style={styles.characteristicsGrid}>
                        {Object.keys(availableCharacteristics).length === 0 ? (
                            <View style={styles.emptyState}>
                                <SafeIcon name="info" size={48} color={modernColors.textSecondary} />
                                <Text style={styles.emptyText}>
                                    Aucune caractéristique disponible
                                </Text>
                                <Text style={styles.emptySubtext}>
                                    Les produits affichés n'ont pas de caractéristiques filtrables
                                </Text>
                            </View>
                        ) : (
                            Object.entries(availableCharacteristics).map(([charKey, valuesSet]) => {
                                const values = Array.from(valuesSet);
                                const isActive = selectedFilters[charKey]?.length > 0;
                                const activeCount = selectedFilters[charKey]?.length || 0;

                                return (
                                    <TouchableOpacity
                                        key={charKey}
                                        style={[
                                            styles.characteristicCard,
                                            isActive && styles.characteristicCardActive
                                        ]}
                                        onPress={() => handleEditCharacteristic(charKey)}
                                    >
                                        <View style={styles.cardHeader}>
                                            <Text style={styles.cardIcon}>{getCharIcon(charKey)}</Text>
                                            <View style={styles.cardTitleContainer}>
                                                <Text style={[
                                                    styles.cardTitle,
                                                    isActive && styles.cardTitleActive
                                                ]}>
                                                    {charKey}
                                                </Text>
                                                <Text style={styles.cardSubtitle}>
                                                    {values.length} option{values.length > 1 ? 's' : ''}
                                                </Text>
                                            </View>
                                            {isActive && (
                                                <View style={styles.activeBadge}>
                                                    <Text style={styles.activeBadgeText}>{activeCount}</Text>
                                                </View>
                                            )}
                                        </View>

                                        {/* Aperçu des valeurs */}
                                        <View style={styles.valuesPreview}>
                                            {values.slice(0, 3).map((value, idx) => (
                                                <View key={idx} style={styles.valueChip}>
                                                    <Text style={styles.valueChipText} numberOfLines={1}>
                                                        {value}
                                                    </Text>
                                                </View>
                                            ))}
                                            {values.length > 3 && (
                                                <Text style={styles.moreText}>
                                                    +{values.length - 3}
                                                </Text>
                                            )}
                                        </View>
                                    </TouchableOpacity>
                                );
                            })
                        )}
                    </View>
                </ScrollView>

                {/* Footer Actions */}
                <View style={styles.footer}>
                    <TouchableOpacity
                        style={styles.resetButton}
                        onPress={handleReset}
                    >
                        <SafeIcon name="refresh-cw" size={18} color={modernColors.text} />
                        <Text style={styles.resetButtonText}>Réinitialiser</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.applyButton}
                        onPress={handleApply}
                    >
                        <SafeIcon name="check" size={18} color="#FFFFFF" />
                        <Text style={styles.applyButtonText}>
                            Appliquer {activeFiltersCount > 0 ? `(${activeFiltersCount})` : ''}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Modal d'édition pour une caractéristique spécifique */}
            {editingCharacteristic && (
                <Modal
                    visible={true}
                    animationType="slide"
                    transparent={false}
                    onRequestClose={() => setEditingCharacteristic(null)}
                >
                    <View style={styles.editorContainer}>
                        <View style={styles.editorHeader}>
                            <Text style={styles.editorTitle}>
                                {getCharIcon(editingCharacteristic)} Filtrer par {editingCharacteristic}
                            </Text>
                            <TouchableOpacity onPress={() => setEditingCharacteristic(null)}>
                                <SafeIcon name="x" size={24} color={modernColors.text} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.editorContent}>
                            <LinearAutocompleteEditor
                                label={`Valeurs pour ${editingCharacteristic}`}
                                identifiantBase="filter"
                                sousCaracteristiques={getSousCaracteristiquesForEditor(editingCharacteristic)}
                                separateur=","
                                value={selectedFilters[editingCharacteristic] || []}
                                onChange={handleSaveCharacteristic}
                                placeholder={`Sélectionnez ${editingCharacteristic}...`}
                                allowCustomModality={false}
                                filtrable={false}
                            />
                        </ScrollView>

                        <View style={styles.editorFooter}>
                            <TouchableOpacity
                                style={styles.editorCancelButton}
                                onPress={() => setEditingCharacteristic(null)}
                            >
                                <Text style={styles.editorCancelText}>Fermer</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>
            )}
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 20,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    headerTitle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    headerIcon: {
        fontSize: 28,
    },
    headerTextContainer: {
        flex: 1,
    },
    headerTitleText: {
        fontSize: 20,
        fontWeight: '700',
        color: modernColors.text,
    },
    headerSubtitle: {
        fontSize: 13,
        color: modernColors.primary,
        fontWeight: '600',
        marginTop: 2,
    },
    closeButton: {
        padding: 4,
    },
    activeFiltersSection: {
        backgroundColor: '#FFFFFF',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 12,
    },
    sectionDescription: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginBottom: 16,
        fontStyle: 'italic',
    },
    activeFiltersScroll: {
        gap: 8,
        paddingRight: 16,
    },
    activeFilterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: modernColors.primary,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        gap: 6,
        maxWidth: 200,
    },
    activeFilterKey: {
        fontSize: 12,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    activeFilterValue: {
        fontSize: 12,
        color: '#FFFFFF',
        flex: 1,
    },
    locationSection: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 8,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    characteristicsScroll: {
        flex: 1,
        padding: 16,
    },
    characteristicsGrid: {
        gap: 12,
    },
    characteristicCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        borderWidth: 2,
        borderColor: modernColors.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    characteristicCardActive: {
        borderColor: modernColors.primary,
        backgroundColor: '#F0F4FF',
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        gap: 12,
    },
    cardIcon: {
        fontSize: 24,
    },
    cardTitleContainer: {
        flex: 1,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        textTransform: 'capitalize',
    },
    cardTitleActive: {
        color: modernColors.primary,
    },
    cardSubtitle: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginTop: 2,
    },
    activeBadge: {
        backgroundColor: modernColors.primary,
        borderRadius: 12,
        minWidth: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 6,
    },
    activeBadgeText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    valuesPreview: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    valueChip: {
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        maxWidth: 120,
    },
    valueChipText: {
        fontSize: 11,
        color: modernColors.text,
    },
    moreText: {
        fontSize: 11,
        color: modernColors.textSecondary,
        fontStyle: 'italic',
        paddingVertical: 5,
    },
    emptyState: {
        paddingVertical: 48,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.textSecondary,
        marginTop: 16,
    },
    emptySubtext: {
        fontSize: 13,
        color: modernColors.textSecondary,
        marginTop: 8,
        textAlign: 'center',
        paddingHorizontal: 32,
    },
    footer: {
        flexDirection: 'row',
        padding: 16,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
        gap: 12,
    },
    resetButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: '#F3F4F6',
        gap: 8,
    },
    resetButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: modernColors.text,
    },
    applyButton: {
        flex: 2,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: modernColors.primary,
        gap: 8,
    },
    applyButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    editorContainer: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    editorHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    editorTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.text,
        flex: 1,
    },
    editorContent: {
        flex: 1,
        padding: 16,
    },
    editorFooter: {
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
    },
    editorCancelButton: {
        padding: 14,
        borderRadius: 12,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
    },
    editorCancelText: {
        fontSize: 15,
        fontWeight: '600',
        color: modernColors.text,
    },
});

export default DynamicAutocompleteFilters;

