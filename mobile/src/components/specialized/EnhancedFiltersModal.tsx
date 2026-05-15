// ✅ NOUVEAU Phase 1.2: Filtres visuels améliorés avec sliders et prévisualisation
import React, { useState, useEffect } from 'react';
import {
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { PropertySearchFilters } from '../../services/immobilierService';
import SafeIcon from '../SafeIcon';
import { modernColors } from '../../theme/modernTheme';
import Slider from '@react-native-community/slider';

interface EnhancedFiltersModalProps {
    visible: boolean;
    filters: PropertySearchFilters;
    onClose: () => void;
    onApply: (filters: PropertySearchFilters) => void;
    onClear: () => void;
    estimatedResults?: number;
}

const EnhancedFiltersModal: React.FC<EnhancedFiltersModalProps> = ({
    visible,
    filters,
    onClose,
    onApply,
    onClear,
    estimatedResults,
}) => {
    const [localFilters, setLocalFilters] = useState<PropertySearchFilters>(filters);

    useEffect(() => {
        setLocalFilters(filters);
    }, [filters]);

    const handleFilterChange = (key: keyof PropertySearchFilters, value: any) => {
        setLocalFilters(prev => ({
            ...prev,
            [key]: value,
        }));
    };

    const handleApply = () => {
        onApply(localFilters);
        onClose();
    };

    const formatPrice = (price?: number) => {
        if (!price) return '0';
        if (price >= 1000000) return `${(price / 1000000).toFixed(1)}M`;
        return `${(price / 1000).toFixed(0)}K`;
    };

    const formatSuperficie = (superficie?: number) => {
        if (!superficie) return '0';
        return `${superficie.toFixed(0)}`;
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>Filtres avancés</Text>
                        {estimatedResults !== undefined && (
                            <Text style={styles.resultsPreview}>
                                ~{estimatedResults} résultats
                            </Text>
                        )}
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <SafeIcon name="x" size={24} color="#111827" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
                        {/* Prix */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Prix</Text>
                            
                            {/* Prix min */}
                            <View style={styles.sliderContainer}>
                                <Text style={styles.sliderLabel}>
                                    Prix minimum: {formatPrice(localFilters.prix_min)} FCFA
                                </Text>
                                <Slider
                                    style={styles.slider}
                                    minimumValue={0}
                                    maximumValue={500000000}
                                    step={1000000}
                                    value={localFilters.prix_min || 0}
                                    onValueChange={(value) => handleFilterChange('prix_min', value)}
                                    minimumTrackTintColor={modernColors.primary}
                                    maximumTrackTintColor="#E5E7EB"
                                    thumbTintColor={modernColors.primary}
                                />
                            </View>

                            {/* Prix max */}
                            <View style={styles.sliderContainer}>
                                <Text style={styles.sliderLabel}>
                                    Prix maximum: {formatPrice(localFilters.prix_max)} FCFA
                                </Text>
                                <Slider
                                    style={styles.slider}
                                    minimumValue={0}
                                    maximumValue={500000000}
                                    step={1000000}
                                    value={localFilters.prix_max || 500000000}
                                    onValueChange={(value) => handleFilterChange('prix_max', value)}
                                    minimumTrackTintColor={modernColors.primary}
                                    maximumTrackTintColor="#E5E7EB"
                                    thumbTintColor={modernColors.primary}
                                />
                            </View>
                        </View>

                        {/* Superficie */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Superficie (m²)</Text>
                            
                            <View style={styles.sliderContainer}>
                                <Text style={styles.sliderLabel}>
                                    Minimum: {formatSuperficie(localFilters.superficie_min)} m²
                                </Text>
                                <Slider
                                    style={styles.slider}
                                    minimumValue={0}
                                    maximumValue={1000}
                                    step={10}
                                    value={localFilters.superficie_min || 0}
                                    onValueChange={(value) => handleFilterChange('superficie_min', value)}
                                    minimumTrackTintColor={modernColors.primary}
                                    maximumTrackTintColor="#E5E7EB"
                                    thumbTintColor={modernColors.primary}
                                />
                            </View>

                            <View style={styles.sliderContainer}>
                                <Text style={styles.sliderLabel}>
                                    Maximum: {formatSuperficie(localFilters.superficie_max)} m²
                                </Text>
                                <Slider
                                    style={styles.slider}
                                    minimumValue={0}
                                    maximumValue={1000}
                                    step={10}
                                    value={localFilters.superficie_max || 1000}
                                    onValueChange={(value) => handleFilterChange('superficie_max', value)}
                                    minimumTrackTintColor={modernColors.primary}
                                    maximumTrackTintColor="#E5E7EB"
                                    thumbTintColor={modernColors.primary}
                                />
                            </View>
                        </View>

                        {/* Distance */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Distance</Text>
                            
                            <View style={styles.sliderContainer}>
                                <Text style={styles.sliderLabel}>
                                    Rayon de recherche: {localFilters.max_distance_km || 50} km
                                </Text>
                                <Slider
                                    style={styles.slider}
                                    minimumValue={1}
                                    maximumValue={100}
                                    step={1}
                                    value={localFilters.max_distance_km || 50}
                                    onValueChange={(value) => handleFilterChange('max_distance_km', value)}
                                    minimumTrackTintColor={modernColors.primary}
                                    maximumTrackTintColor="#E5E7EB"
                                    thumbTintColor={modernColors.primary}
                                />
                            </View>
                        </View>
                    </ScrollView>

                    {/* Footer */}
                    <View style={styles.footer}>
                        <TouchableOpacity
                            style={[styles.button, styles.clearButton]}
                            onPress={onClear}
                        >
                            <Text style={styles.clearButtonText}>Réinitialiser</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.button, styles.applyButton]}
                            onPress={handleApply}
                        >
                            <Text style={styles.applyButtonText}>Appliquer</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '90%',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
    },
    resultsPreview: {
        fontSize: 14,
        color: modernColors.primary,
        fontWeight: '600',
    },
    closeButton: {
        padding: 4,
    },
    scrollContent: {
        padding: 20,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 16,
    },
    sliderContainer: {
        marginBottom: 20,
    },
    sliderLabel: {
        fontSize: 14,
        color: '#374151',
        marginBottom: 8,
    },
    slider: {
        width: '100%',
        height: 40,
    },
    footer: {
        flexDirection: 'row',
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        gap: 12,
    },
    button: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    clearButton: {
        backgroundColor: '#F3F4F6',
    },
    clearButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
    },
    applyButton: {
        backgroundColor: modernColors.primary,
    },
    applyButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
});

export default EnhancedFiltersModal;

