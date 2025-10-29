// ✅ COMPOSANT INTELLIGENT DE SÉLECTION DE LOCALISATION
// Utilise le système centralisé africanLocations.ts avec priorité au pays de l'utilisateur

import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import {
    extraireNomVille,
    getQuartiersPourSelecteur,
    getVillesPourSelecteur
} from '../data/africanLocations';
import { modernColors } from '../theme/modernTheme';
import { NativeInput } from './NativeDesign';
import SafeIcon from './SafeIcon';

interface LocationSelectorProps {
    // Pays de l'utilisateur (pour priorité) - Code ISO (CM, CI, SN, etc.)
    userCountryCode?: string;

    // Valeurs actuelles
    selectedVille?: string;
    selectedQuartier?: string;
    selectedAdresse?: string;

    // Callbacks
    onVilleChange: (ville: string) => void;
    onQuartierChange?: (quartier: string) => void;
    onAdresseChange?: (adresse: string) => void;

    // Options
    required?: boolean;
    showQuartier?: boolean; // Afficher le champ quartier
    showAdresse?: boolean; // Afficher le champ adresse
    placeholder?: string;
    label?: string;
}

const LocationSelector: React.FC<LocationSelectorProps> = ({
    userCountryCode = 'CM', // Par défaut Cameroun
    selectedVille = '',
    selectedQuartier = '',
    selectedAdresse = '',
    onVilleChange,
    onQuartierChange,
    onAdresseChange,
    required = false,
    showQuartier = true,
    showAdresse = true,
    placeholder = 'Sélectionner une ville',
    label = 'Ville'
}) => {
    const [searchVille, setSearchVille] = useState('');
    const [villesFiltrees, setVillesFiltrees] = useState<string[]>([]);
    const [showVilleDropdown, setShowVilleDropdown] = useState(false);

    // Générer la liste des villes avec priorité au pays de l'utilisateur
    const villesDisponibles = getVillesPourSelecteur(userCountryCode);

    // Filtrer les villes selon la recherche
    useEffect(() => {
        if (searchVille.trim().length > 0) {
            const recherche = searchVille.toLowerCase();
            const filtrees = villesDisponibles.filter(ville =>
                ville.toLowerCase().includes(recherche) && !ville.includes('───')
            );
            setVillesFiltrees(filtrees);
        } else {
            setVillesFiltrees(villesDisponibles.filter(v => !v.includes('───')));
        }
    }, [searchVille, userCountryCode]);

    // Récupérer les quartiers de la ville sélectionnée
    const quartiers = selectedVille ? getQuartiersPourSelecteur(extraireNomVille(selectedVille), userCountryCode) : [];

    return (
        <View style={styles.container}>
            {/* Sélection de la ville */}
            <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>
                    {label} {required && <Text style={styles.required}>*</Text>}
                </Text>

                {/* Ville sélectionnée ou bouton de sélection */}
                {selectedVille ? (
                    <View style={styles.selectedContainer}>
                        <View style={styles.selectedValue}>
                            <SafeIcon name="map-pin" size={16} color={modernColors.primary} />
                            <Text style={styles.selectedText}>{selectedVille}</Text>
                        </View>
                        <TouchableOpacity
                            style={styles.changeButton}
                            onPress={() => {
                                onVilleChange('');
                                setSearchVille('');
                            }}
                        >
                            <SafeIcon name="x" size={18} color={modernColors.textSecondary} />
                        </TouchableOpacity>
                    </View>
                ) : (
                    <TouchableOpacity
                        style={styles.selectButton}
                        onPress={() => {
                            // Afficher la liste de sélection
                            Alert.alert(
                                'Sélectionner une ville',
                                'Tapez pour rechercher ou sélectionnez dans la liste',
                                [
                                    ...villesDisponibles.slice(0, 15).map(ville => {
                                        if (ville.includes('───')) return { text: ville, style: 'cancel' as any };
                                        return {
                                            text: ville,
                                            onPress: () => onVilleChange(ville)
                                        };
                                    }),
                                    { text: 'Annuler', style: 'cancel' }
                                ],
                                { cancelable: true }
                            );
                        }}
                    >
                        <Text style={styles.selectButtonText}>{placeholder}</Text>
                        <SafeIcon name="chevron-down" size={20} color={modernColors.textSecondary} />
                    </TouchableOpacity>
                )}

                {/* Recherche de ville (alternative) */}
                {!selectedVille && (
                    <View style={styles.searchContainer}>
                        <SafeIcon name="search" size={18} color={modernColors.textSecondary} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Ou recherchez une ville..."
                            value={searchVille}
                            onChangeText={setSearchVille}
                            onFocus={() => setShowVilleDropdown(true)}
                        />
                    </View>
                )}

                {/* Liste déroulante de recherche */}
                {showVilleDropdown && searchVille.length > 0 && villesFiltrees.length > 0 && (
                    <View style={styles.dropdown}>
                        {villesFiltrees.slice(0, 8).map((ville, index) => (
                            <TouchableOpacity
                                key={index}
                                style={styles.dropdownItem}
                                onPress={() => {
                                    onVilleChange(ville);
                                    setSearchVille('');
                                    setShowVilleDropdown(false);
                                }}
                            >
                                <SafeIcon name="map-pin" size={14} color={modernColors.primary} />
                                <Text style={styles.dropdownItemText}>{ville}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </View>

            {/* Sélection du quartier (si ville sélectionnée) */}
            {showQuartier && selectedVille && quartiers.length > 0 && (
                <View style={styles.fieldContainer}>
                    <Text style={styles.fieldLabel}>Quartier</Text>

                    {selectedQuartier ? (
                        <View style={styles.selectedContainer}>
                            <View style={styles.selectedValue}>
                                <SafeIcon name="home" size={16} color={modernColors.secondary} />
                                <Text style={styles.selectedText}>{selectedQuartier}</Text>
                            </View>
                            <TouchableOpacity
                                style={styles.changeButton}
                                onPress={() => onQuartierChange?.('')}
                            >
                                <SafeIcon name="x" size={18} color={modernColors.textSecondary} />
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <TouchableOpacity
                            style={styles.selectButton}
                            onPress={() => {
                                Alert.alert(
                                    'Sélectionner un quartier',
                                    extraireNomVille(selectedVille),
                                    [
                                        ...quartiers.slice(0, 20).map(quartier => ({
                                            text: quartier,
                                            onPress: () => onQuartierChange?.(quartier)
                                        })),
                                        { text: 'Annuler', style: 'cancel' }
                                    ],
                                    { cancelable: true }
                                );
                            }}
                        >
                            <Text style={styles.selectButtonText}>Sélectionner un quartier...</Text>
                            <SafeIcon name="chevron-down" size={20} color={modernColors.textSecondary} />
                        </TouchableOpacity>
                    )}
                </View>
            )}

            {/* Adresse complète (optionnel) */}
            {showAdresse && selectedVille && (
                <View style={styles.fieldContainer}>
                    <Text style={styles.fieldLabel}>Adresse précise (rue, numéro...)</Text>
                    <NativeInput
                        placeholder="Ex: Avenue de la Réunification, Immeuble 45"
                        value={selectedAdresse}
                        onChangeText={(text) => onAdresseChange?.(text)}
                        style={styles.input}
                        multiline
                        numberOfLines={2}
                    />
                </View>
            )}

            {/* Hint */}
            <View style={styles.hintBox}>
                <SafeIcon name="info" size={16} color={modernColors.primary} />
                <Text style={styles.hintText}>
                    💡 Saisissez les premières lettres pour rechercher rapidement une ville
                </Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        gap: 12,
    },
    fieldContainer: {
        gap: 8,
    },
    fieldLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    required: {
        color: modernColors.error,
    },
    selectButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: modernColors.surface,
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: 10,
        padding: 14,
    },
    selectButtonText: {
        fontSize: 15,
        color: modernColors.textSecondary,
    },
    selectedContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: modernColors.primary + '10',
        borderWidth: 1,
        borderColor: modernColors.primary,
        borderRadius: 10,
        padding: 12,
    },
    selectedValue: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
    },
    selectedText: {
        fontSize: 15,
        fontWeight: '600',
        color: modernColors.primary,
        flex: 1,
    },
    changeButton: {
        padding: 4,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: modernColors.surface,
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginTop: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
        color: modernColors.text,
        padding: 6,
    },
    dropdown: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: 10,
        marginTop: 4,
        maxHeight: 300,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
    },
    dropdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    dropdownItemText: {
        fontSize: 14,
        color: modernColors.text,
        flex: 1,
    },
    input: {
        backgroundColor: modernColors.surface,
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: 10,
        padding: 12,
        fontSize: 15,
        color: modernColors.text,
    },
    hintBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: modernColors.background,
        padding: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    hintText: {
        flex: 1,
        fontSize: 12,
        color: modernColors.textSecondary,
    },
});

export default LocationSelector;


