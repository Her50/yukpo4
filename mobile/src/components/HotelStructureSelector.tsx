import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { hotelPlacesService, HotelStructureType } from '../services/hotelPlacesService';
import { modalityService } from '../services/modalityService';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';
import { useLanguageSafe } from '../contexts/LanguageContext';

interface HotelStructureSelectorProps {
    label: string;
    value: string;
    onSelect: (value: string) => void;
    type?: HotelStructureType; // 'hotel' | 'lodging' | 'accommodation' (défaut: 'hotel')
    placeholder?: string;
    required?: boolean;
    useLocation?: boolean; // Utiliser la géolocalisation (défaut: true)
    radius?: number; // Rayon de recherche en mètres
}

export const HotelStructureSelector: React.FC<HotelStructureSelectorProps> = ({
    label,
    value,
    onSelect,
    type = 'hotel',
    placeholder={t('hotelStructureSelector.rechercherUnHotel')},
    required = false,
    useLocation = true,
    radius = 5000,
}) => {
        const { t } = useLanguageSafe();
const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [options, setOptions] = useState<string[]>([]);
    const [locationEnabled, setLocationEnabled] = useState(useLocation);

    // ✅ Modale pour ajouter un hôtel personnalisé
    const [showAddModal, setShowAddModal] = useState(false);
    const [newHotelName, setNewHotelName] = useState('');

    // Debounce query
    const debouncedQuery = useMemo(() => query.trim(), [query]);

    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            setLoading(true);
            try {
                const results = await hotelPlacesService.autocomplete({
                    query: debouncedQuery,
                    type,
                    useLocation: locationEnabled,
                    radius,
                });
                if (!cancelled) setOptions(results);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        run();
        return () => { cancelled = true; };
    }, [debouncedQuery, type, locationEnabled, radius]);

    const handleAddCustomHotel = async () => {
        const name = newHotelName.trim();
        if (!name) {
            Alert.alert('Erreur', 'Veuillez entrer un nom d\'hôtel');
            return;
        }

        // Ajouter à la base de données personnalisée
        await modalityService.addCustomModality('hotellerie', 'noms_etablissements', name);

        // Sélectionner immédiatement
        onSelect(name);
        setShowAddModal(false);
        setOpen(false);
        setNewHotelName('');
    };

    return (
        <View style={styles.container}>
            <Text style={styles.label}>
                {label} {required && <Text style={styles.required}>*</Text>}
            </Text>

            <TouchableOpacity
                style={[styles.selector, !value && styles.selectorPlaceholder]}
                onPress={() => setOpen(true)}
            >
                <View style={{ flex: 1 }}>
                    <Text style={[styles.selectorText, !value && styles.placeholderText]}>
                        {value || placeholder}
                    </Text>
                    {locationEnabled && (
                        <Text style={styles.locationHint}>{t('hotelStructureSelector.rechercheParProximiteActivee')}</Text>
                    )}
                </View>
                <SafeIcon name="search" size={18} color={modernColors.textSecondary} />
            </TouchableOpacity>

            {!!value && (
                <TouchableOpacity style={styles.clearButton} onPress={() => onSelect('')}>
                    <SafeIcon name="x-circle" size={16} color={modernColors.error} />
                    <Text style={styles.clearText}>Effacer</Text>
                </TouchableOpacity>
            )}

            <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{label}</Text>
                            <TouchableOpacity onPress={() => setOpen(false)} style={styles.closeButton}>
                                <SafeIcon name="x" size={22} color={modernColors.text} />
                            </TouchableOpacity>
                        </View>

                        {/* Toggle géolocalisation */}
                        <View style={styles.locationToggle}>
                            <TouchableOpacity
                                style={[styles.locationToggleButton, locationEnabled && styles.locationToggleActive]}
                                onPress={() => setLocationEnabled(!locationEnabled)}
                            >
                                <SafeIcon
                                    name={locationEnabled ? "map-pin" : "list"}
                                    size={16}
                                    color={locationEnabled ? modernColors.primary : modernColors.textSecondary}
                                />
                                <Text style={[styles.locationToggleText, locationEnabled && styles.locationToggleTextActive]}>
                                    {locationEnabled ? t('hotelStructureSelector.rechercheParProximite') : 'Recherche par nom'}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.searchContainer}>
                            <SafeIcon name="search" size={18} color={modernColors.textSecondary} />
                            <TextInput
                                placeholder={locationEnabled ? "Affiner la recherche..." : "Rechercher..."}
                                value={query}
                                onChangeText={setQuery}
                                style={styles.searchInput}
                                placeholderTextColor={modernColors.textSecondary}
                                autoFocus={!locationEnabled}
                            />
                            {query.length > 0 && (
                                <TouchableOpacity onPress={() => setQuery('')}>
                                    <SafeIcon name="x-circle" size={18} color={modernColors.textSecondary} />
                                </TouchableOpacity>
                            )}
                        </View>

                        {loading && (
                            <View style={styles.loadingContainer}>
                                <Text style={styles.loadingText}>{t('hotelStructureSelector.rechercheEnCours')}</Text>
                            </View>
                        )}

                        <ScrollView style={styles.optionsList} keyboardShouldPersistTaps="handled">
                            {options.length === 0 && !loading && (
                                <View style={styles.emptyContainer}>
                                    <SafeIcon name="search" size={40} color={modernColors.textSecondary} />
                                    <Text style={styles.emptyText}>{t('hotelStructureSelector.aucunHotelTrouve')}</Text>
                                    <Text style={styles.emptyHint}>
                                        {locationEnabled ? "Essayez de désactiver la géolocalisation" : "Essayez un autre terme"}
                                    </Text>
                                </View>
                            )}

                            {options.map((option, index) => (
                                <TouchableOpacity
                                    key={index}
                                    style={styles.optionItem}
                                    onPress={() => {
                                        onSelect(option);
                                        setOpen(false);
                                        setQuery('');
                                    }}
                                >
                                    <SafeIcon name="home" size={18} color={modernColors.primary} />
                                    <Text style={styles.optionText}>{option}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        {/* Bouton ajouter une structure personnalisée */}
                        <TouchableOpacity
                            style={styles.addButton}
                            onPress={() => setShowAddModal(true)}
                        >
                            <SafeIcon name="plus-circle" size={18} color={modernColors.primary} />
                            <Text style={styles.addButtonText}>{t('hotelStructureSelector.ajouterUnHotel')}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Modale d'ajout d'hôtel personnalisé */}
            <Modal visible={showAddModal} transparent animationType="fade" onRequestClose={() => setShowAddModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.addModalContainer}>
                        <Text style={styles.addModalTitle}>{t('hotelStructureSelector.ajouterUnHotel')}</Text>
                        <TextInput
                            placeholder={t('hotelStructureSelector.nomDeL')}hôtel"
                            value={newHotelName}
                            onChangeText={setNewHotelName}
                            style={styles.addModalInput}
                            placeholderTextColor={modernColors.textSecondary}
                            autoFocus
                        />
                        <View style={styles.addModalButtons}>
                            <TouchableOpacity
                                style={[styles.addModalButton, styles.addModalButtonCancel]}
                                onPress={() => {
                                    setShowAddModal(false);
                                    setNewHotelName('');
                                }}
                            >
                                <Text style={styles.addModalButtonTextCancel}>{t('hotelStructureSelector.annuler')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.addModalButton, styles.addModalButtonConfirm]}
                                onPress={handleAddCustomHotel}
                            >
                                <Text style={styles.addModalButtonTextConfirm}>{t('hotelStructureSelector.ajouter')}</Text>
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
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 8,
    },
    required: {
        color: modernColors.error,
        fontWeight: '700',
    },
    selector: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: modernColors.background,
        borderWidth: 1.5,
        borderColor: modernColors.border,
        borderRadius: 12,
    },
    selectorPlaceholder: {
        borderColor: modernColors.border,
    },
    selectorText: {
        fontSize: 15,
        color: modernColors.text,
        fontWeight: '500',
    },
    placeholderText: {
        color: modernColors.textSecondary,
        fontWeight: '400',
    },
    locationHint: {
        fontSize: 11,
        color: modernColors.primary,
        marginTop: 2,
        fontStyle: 'italic',
    },
    clearButton: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
        paddingVertical: 4,
    },
    clearText: {
        fontSize: 13,
        color: modernColors.error,
        marginLeft: 4,
        fontWeight: '500',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContainer: {
        backgroundColor: 'white',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingTop: 20,
        paddingHorizontal: 20,
        paddingBottom: 30,
        maxHeight: '85%',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: modernColors.text,
    },
    closeButton: {
        padding: 4,
    },
    locationToggle: {
        marginBottom: 12,
    },
    locationToggleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: modernColors.background,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    locationToggleActive: {
        backgroundColor: `${modernColors.primary}15`,
        borderColor: modernColors.primary,
    },
    locationToggleText: {
        fontSize: 13,
        color: modernColors.textSecondary,
        marginLeft: 8,
        fontWeight: '500',
    },
    locationToggleTextActive: {
        color: modernColors.primary,
        fontWeight: '600',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 10,
        backgroundColor: modernColors.background,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: modernColors.border,
        marginBottom: 16,
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        fontSize: 15,
        color: modernColors.text,
    },
    loadingContainer: {
        paddingVertical: 20,
        alignItems: 'center',
    },
    loadingText: {
        fontSize: 14,
        color: modernColors.textSecondary,
        fontStyle: 'italic',
    },
    optionsList: {
        maxHeight: 300,
        marginBottom: 12,
    },
    optionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    optionText: {
        fontSize: 15,
        color: modernColors.text,
        marginLeft: 12,
        fontWeight: '500',
    },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.textSecondary,
        marginTop: 12,
    },
    emptyHint: {
        fontSize: 13,
        color: modernColors.textSecondary,
        marginTop: 4,
        fontStyle: 'italic',
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        backgroundColor: `${modernColors.primary}10`,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: modernColors.primary,
        borderStyle: 'dashed',
    },
    addButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: modernColors.primary,
        marginLeft: 8,
    },
    addModalContainer: {
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 24,
        marginHorizontal: 20,
        marginVertical: 'auto',
    },
    addModalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.text,
        marginBottom: 16,
    },
    addModalInput: {
        borderWidth: 1.5,
        borderColor: modernColors.border,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 15,
        color: modernColors.text,
        marginBottom: 16,
    },
    addModalButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    addModalButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
    },
    addModalButtonCancel: {
        backgroundColor: modernColors.background,
        borderWidth: 1.5,
        borderColor: modernColors.border,
    },
    addModalButtonConfirm: {
        backgroundColor: modernColors.primary,
    },
    addModalButtonTextCancel: {
        fontSize: 15,
        fontWeight: '600',
        color: modernColors.text,
    },
    addModalButtonTextConfirm: {
        fontSize: 15,
        fontWeight: '600',
        color: 'white',
    },
});

export default HotelStructureSelector;

