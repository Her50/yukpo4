import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { healthPlacesService, HealthStructureType } from '../services/healthPlacesService';
import { modalityService } from '../services/modalityService';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';
import { useLanguageSafe } from '../contexts/LanguageContext';

interface HealthStructureSelectorProps {
    label: string;
    value: string;
    onSelect: (value: string) => void;
    type: HealthStructureType; // 'hospital' | 'pharmacy' | 'health'
    placeholder?: string;
    required?: boolean;
    useLocation?: boolean; // Utiliser la géolocalisation (défaut: true)
    radius?: number; // Rayon de recherche en mètres
}

export const HealthStructureSelector: React.FC<HealthStructureSelectorProps> = ({
    label,
    value,
    onSelect,
    type,
    placeholder={t('healthStructureSelector.rechercher')},
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

    // ✅ Modale pour ajouter une structure personnalisée
    const [showAddModal, setShowAddModal] = useState(false);
    const [newStructureName, setNewStructureName] = useState('');

    // Debounce query
    const debouncedQuery = useMemo(() => query.trim(), [query]);

    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            setLoading(true);
            try {
                const results = await healthPlacesService.autocomplete({
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

    const handleAddCustomStructure = async () => {
        const name = newStructureName.trim();
        if (!name) {
            Alert.alert('Erreur', 'Veuillez entrer un nom');
            return;
        }

        // Ajouter à la base de données personnalisée
        const fieldName = type === 'hospital' ? 'hopitaux' : type === 'pharmacy' ? 'pharmacies' : 'laboratoires';
        await modalityService.addCustomModality(type, fieldName, name);

        // Sélectionner immédiatement
        onSelect(name);
        setShowAddModal(false);
        setOpen(false);
        setNewStructureName('');
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
                        <Text style={styles.locationHint}>{t('healthStructureSelector.rechercheParProximiteActivee')}</Text>
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
                                    {locationEnabled ? t('healthStructureSelector.rechercheParProximite') : 'Recherche par nom'}
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

                        {/* Bouton pour ajouter une structure personnalisée */}
                        <TouchableOpacity
                            style={styles.addButton}
                            onPress={() => setShowAddModal(true)}
                        >
                            <SafeIcon name="plus-circle" size={18} color={modernColors.primary} />
                            <Text style={styles.addButtonText}>{t('healthStructureSelector.ajouterUneStructure')}</Text>
                        </TouchableOpacity>

                        <ScrollView style={styles.optionsList}>
                            {loading ? (
                                <View style={styles.loadingContainer}>
                                    <Text style={styles.loadingText}>{t('healthStructureSelector.rechercheEnCours')}/Text>
                                    {locationEnabled && (
                                        <Text style={styles.loadingHint}>📍 Recherche dans un rayon de {radius / 1000}km</Text>
                                    )}
                                </View>
                            ) : options.length === 0 ? (
                                <View style={styles.emptyContainer}>
                                    <SafeIcon name="map-pin" size={32} color={modernColors.textSecondary} />
                                    <Text style={styles.emptyText}>{t('healthStructureSelector.aucunResultatTrouve')}</Text>
                                    <Text style={styles.emptyHint}>
                                        {locationEnabled
                                            ? "Essayez d'augmenter le rayon ou de désactiver la géolocalisation"
                                            : "Essayez un autre terme de recherche ou ajoutez votre structure"
                                        }
                                    </Text>
                                </View>
                            ) : (
                                options.map((opt) => (
                                    <TouchableOpacity
                                        key={opt}
                                        style={styles.optionItem}
                                        onPress={() => {
                                            onSelect(opt);
                                            setOpen(false);
                                        }}
                                    >
                                        <SafeIcon name="building" size={16} color={modernColors.primary} />
                                        <Text style={styles.optionText}>{opt}</Text>
                                    </TouchableOpacity>
                                ))
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Modale d'ajout de structure personnalisée */}
            <Modal visible={showAddModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.addModalContainer}>
                        <Text style={styles.addModalTitle}>{t('healthStructureSelector.ajouterUneStructure')}</Text>
                        <TextInput
                            placeholder={t('healthStructureSelector.nomDeLaStructure')}
                            value={newStructureName}
                            onChangeText={setNewStructureName}
                            style={styles.addModalInput}
                            placeholderTextColor={modernColors.textSecondary}
                            autoFocus
                        />
                        <View style={styles.addModalButtons}>
                            <TouchableOpacity
                                style={[styles.addModalButton, styles.addModalButtonCancel]}
                                onPress={() => {
                                    setShowAddModal(false);
                                    setNewStructureName('');
                                }}
                            >
                                <Text style={styles.addModalButtonTextCancel}>{t('healthStructureSelector.annuler')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.addModalButton, styles.addModalButtonConfirm]}
                                onPress={handleAddCustomStructure}
                            >
                                <Text style={styles.addModalButtonTextConfirm}>{t('healthStructureSelector.ajouter')}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { marginBottom: 12 },
    label: { fontSize: 13, fontWeight: '600', color: modernColors.text, marginBottom: 6 },
    required: { color: modernColors.error },
    selector: {
        backgroundColor: modernColors.background,
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    selectorPlaceholder: { borderColor: modernColors.border },
    selectorText: { fontSize: 14, color: modernColors.text },
    placeholderText: { color: modernColors.textSecondary },
    locationHint: { fontSize: 11, color: modernColors.primary, marginTop: 2 },
    clearButton: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
    clearText: { fontSize: 12, color: modernColors.error, fontWeight: '600' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.2)', justifyContent: 'flex-end' },
    modalContainer: { backgroundColor: modernColors.surface, borderTopLeftRadius: 12, borderTopRightRadius: 12, maxHeight: '80%' },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: modernColors.border },
    modalTitle: { fontSize: 16, fontWeight: '700', color: modernColors.text },
    closeButton: { padding: 6 },
    locationToggle: { paddingHorizontal: 16, paddingVertical: 8 },
    locationToggleButton: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: modernColors.background, borderWidth: 1, borderColor: modernColors.border },
    locationToggleActive: { backgroundColor: '#EFF6FF', borderColor: modernColors.primary },
    locationToggleText: { fontSize: 13, color: modernColors.textSecondary, fontWeight: '600' },
    locationToggleTextActive: { color: modernColors.primary },
    searchContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
    searchInput: { flex: 1, borderWidth: 1, borderColor: modernColors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: modernColors.text },
    addButton: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#EFF6FF', marginHorizontal: 16, marginBottom: 12, borderRadius: 8, borderWidth: 1, borderColor: modernColors.primary },
    addButtonText: { fontSize: 13, fontWeight: '600', color: modernColors.primary },
    optionsList: { paddingHorizontal: 6 },
    loadingContainer: { padding: 24, alignItems: 'center' },
    loadingText: { fontSize: 14, color: modernColors.textSecondary, marginBottom: 4 },
    loadingHint: { fontSize: 12, color: modernColors.primary },
    emptyContainer: { padding: 32, alignItems: 'center' },
    emptyText: { fontSize: 14, fontWeight: '600', color: modernColors.textSecondary, marginTop: 12 },
    emptyHint: { fontSize: 12, color: modernColors.textSecondary, marginTop: 4, textAlign: 'center' },
    optionItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: modernColors.border },
    optionText: { fontSize: 14, color: modernColors.text, flex: 1 },
    addModalContainer: { backgroundColor: modernColors.surface, borderRadius: 12, margin: 20, padding: 20 },
    addModalTitle: { fontSize: 16, fontWeight: '700', color: modernColors.text, marginBottom: 16 },
    addModalInput: { borderWidth: 1, borderColor: modernColors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: modernColors.text, marginBottom: 16 },
    addModalButtons: { flexDirection: 'row', gap: 12 },
    addModalButton: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
    addModalButtonCancel: { backgroundColor: modernColors.background, borderWidth: 1, borderColor: modernColors.border },
    addModalButtonConfirm: { backgroundColor: modernColors.primary },
    addModalButtonTextCancel: { fontSize: 14, fontWeight: '600', color: modernColors.text },
    addModalButtonTextConfirm: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
});

export default HealthStructureSelector;

