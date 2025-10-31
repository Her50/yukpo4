import React, { useEffect, useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { PlaceScope, placesService } from '../services/placesService';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';

interface LocationSelectorProps {
    label: string;
    value: string;
    onSelect: (value: string) => void;
    placeholder?: string;
    scope?: PlaceScope; // 'city' | 'point'
    cityContext?: string; // For point search filtering
    required?: boolean;
}

export const LocationSelector: React.FC<LocationSelectorProps> = ({
    label,
    value,
    onSelect,
    placeholder = 'Rechercher... ',
    scope = 'city',
    cityContext,
    required = false,
}) => {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [options, setOptions] = useState<string[]>([]);

    // Debounce query
    const debouncedQuery = useMemo(() => query.trim(), [query]);

    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            setLoading(true);
            try {
                const results = await placesService.autocomplete(debouncedQuery, scope, cityContext);
                if (!cancelled) setOptions(results);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        run();
        return () => { cancelled = true; };
    }, [debouncedQuery, scope, cityContext]);

    return (
        <View style={styles.container}>
            <Text style={styles.label}>
                {label} {required && <Text style={styles.required}>*</Text>}
            </Text>
            <TouchableOpacity
                style={[styles.selector, !value && styles.selectorPlaceholder]}
                onPress={() => setOpen(true)}
            >
                <Text style={[styles.selectorText, !value && styles.placeholderText]}>
                    {value || placeholder}
                </Text>
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
                            <Text style={styles.modalTitle}>Rechercher {scope === 'city' ? 'une ville' : 'un lieu'}</Text>
                            <TouchableOpacity onPress={() => setOpen(false)} style={styles.closeButton}>
                                <SafeIcon name="x" size={22} color={modernColors.text} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.searchContainer}>
                            <SafeIcon name="search" size={18} color={modernColors.textSecondary} />
                            <TextInput
                                placeholder={placeholder}
                                value={query}
                                onChangeText={setQuery}
                                style={styles.searchInput}
                                placeholderTextColor={modernColors.textSecondary}
                                autoFocus
                            />
                            {query.length > 0 && (
                                <TouchableOpacity onPress={() => setQuery('')}>
                                    <SafeIcon name="x-circle" size={18} color={modernColors.textSecondary} />
                                </TouchableOpacity>
                            )}
                        </View>

                        <ScrollView style={styles.optionsList}>
                            {loading ? (
                                <Text style={styles.loadingText}>Chargement...</Text>
                            ) : options.length === 0 ? (
                                <Text style={styles.emptyText}>Aucun résultat</Text>
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
                                        <Text style={styles.optionText}>{opt}</Text>
                                    </TouchableOpacity>
                                ))
                            )}
                        </ScrollView>
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
    clearButton: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
    clearText: { fontSize: 12, color: modernColors.error, fontWeight: '600' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.2)', justifyContent: 'flex-end' },
    modalContainer: { backgroundColor: modernColors.surface, borderTopLeftRadius: 12, borderTopRightRadius: 12, maxHeight: '75%' },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
    modalTitle: { fontSize: 16, fontWeight: '700', color: modernColors.text },
    closeButton: { padding: 6 },
    searchContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
    searchInput: { flex: 1, borderWidth: 1, borderColor: modernColors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: modernColors.text },
    optionsList: { paddingHorizontal: 6 },
    loadingText: { padding: 16, color: modernColors.textSecondary },
    emptyText: { padding: 16, color: modernColors.textSecondary },
    optionItem: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: modernColors.border },
    optionText: { fontSize: 14, color: modernColors.text },
});

export default LocationSelector;
