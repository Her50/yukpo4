// ✅ NOUVEAU Phase 2.3: Comparaison de biens side-by-side
import React, { useState } from 'react';
import {
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { RealEstateProperty } from '../../services/immobilierService';
import SafeIcon from '../SafeIcon';
import { modernColors } from '../../theme/modernTheme';

interface PropertyComparisonModalProps {
    visible: boolean;
    properties: RealEstateProperty[];
    onClose: () => void;
    onPropertyPress: (property: RealEstateProperty) => void;
    maxProperties?: number;
}

const PropertyComparisonModal: React.FC<PropertyComparisonModalProps> = ({
    visible,
    properties,
    onClose,
    onPropertyPress,
    maxProperties = 4,
}) => {
    const [selectedProperties, setSelectedProperties] = useState<RealEstateProperty[]>([]);

    const toggleProperty = (property: RealEstateProperty) => {
        setSelectedProperties(prev => {
            const exists = prev.find(p => p.id === property.id);
            if (exists) {
                return prev.filter(p => p.id !== property.id);
            } else if (prev.length < maxProperties) {
                return [...prev, property];
            }
            return prev;
        });
    };

    const formatPrice = (price?: number) => {
        if (!price) return 'N/A';
        if (price >= 1000000) return `${(price / 1000000).toFixed(1)}M`;
        return `${(price / 1000).toFixed(0)}K`;
    };

    const comparisonFields = [
        { key: 'titre', label: 'Titre' },
        { key: 'type_bien', label: 'Type' },
        { key: 'statut', label: 'Statut' },
        { key: 'superficie_m2', label: 'Superficie (m²)' },
        { key: 'nb_chambres', label: 'Chambres' },
        { key: 'nb_salles_bain', label: 'Salles de bain' },
        { key: 'prix_vente', label: 'Prix vente' },
        { key: 'prix_location_mensuel', label: 'Prix location' },
        { key: 'standing', label: 'Standing' },
        { key: 'etat_general', label: 'État' },
    ];

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
                        <Text style={styles.headerTitle}>
                            Comparer les biens ({selectedProperties.length}/{maxProperties})
                        </Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <SafeIcon name="x" size={24} color="#111827" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.scrollContent} horizontal showsHorizontalScrollIndicator={false}>
                        <View style={styles.comparisonTable}>
                            {/* En-têtes */}
                            <View style={styles.headerRow}>
                                <View style={styles.criteriaColumn}>
                                    <Text style={styles.criteriaHeader}>Critères</Text>
                                </View>
                                {selectedProperties.map((property, index) => (
                                    <TouchableOpacity
                                        key={property.id}
                                        style={styles.propertyColumn}
                                        onPress={() => onPropertyPress(property)}
                                    >
                                        <Text style={styles.propertyHeader} numberOfLines={2}>
                                            {property.titre}
                                        </Text>
                                        <TouchableOpacity
                                            style={styles.removeButton}
                                            onPress={() => toggleProperty(property)}
                                        >
                                            <SafeIcon name="x" size={16} color="#EF4444" />
                                        </TouchableOpacity>
                                    </TouchableOpacity>
                                ))}
                                {selectedProperties.length < maxProperties && (
                                    <View style={styles.addColumn}>
                                        <Text style={styles.addText}>Ajouter</Text>
                                    </View>
                                )}
                            </View>

                            {/* Lignes de comparaison */}
                            {comparisonFields.map((field) => (
                                <View key={field.key} style={styles.comparisonRow}>
                                    <View style={styles.criteriaColumn}>
                                        <Text style={styles.criteriaLabel}>{field.label}</Text>
                                    </View>
                                    {selectedProperties.map((property) => (
                                        <View key={property.id} style={styles.propertyColumn}>
                                            <Text style={styles.propertyValue} numberOfLines={1}>
                                                {field.key === 'prix_vente' || field.key === 'prix_location_mensuel'
                                                    ? formatPrice((property as any)[field.key])
                                                    : (property as any)[field.key] || 'N/A'}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            ))}
                        </View>
                    </ScrollView>

                    {/* Liste des biens disponibles */}
                    <View style={styles.propertiesList}>
                        <Text style={styles.listTitle}>Sélectionner des biens à comparer</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            {properties.map((property) => {
                                const isSelected = selectedProperties.find(p => p.id === property.id);
                                const canAdd = selectedProperties.length < maxProperties;

                                return (
                                    <TouchableOpacity
                                        key={property.id}
                                        style={[
                                            styles.propertyCard,
                                            isSelected && styles.propertyCardSelected,
                                            !canAdd && !isSelected && styles.propertyCardDisabled,
                                        ]}
                                        onPress={() => {
                                            if (isSelected || canAdd) {
                                                toggleProperty(property);
                                            }
                                        }}
                                        disabled={!canAdd && !isSelected}
                                    >
                                        <Text style={styles.propertyCardTitle} numberOfLines={2}>
                                            {property.titre}
                                        </Text>
                                        <Text style={styles.propertyCardPrice}>
                                            {formatPrice(property.prix_vente || property.prix_location_mensuel)}
                                        </Text>
                                        {isSelected && (
                                            <View style={styles.selectedBadge}>
                                                <SafeIcon name="check" size={16} color="#FFFFFF" />
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>

                    {/* Footer */}
                    <View style={styles.footer}>
                        <TouchableOpacity
                            style={[styles.button, styles.closeButtonFooter]}
                            onPress={onClose}
                        >
                            <Text style={styles.closeButtonText}>Fermer</Text>
                        </TouchableOpacity>
                        {selectedProperties.length >= 2 && (
                            <TouchableOpacity
                                style={[styles.button, styles.compareButton]}
                                onPress={() => {
                                    // Action de comparaison détaillée
                                    onClose();
                                }}
                            >
                                <Text style={styles.compareButtonText}>Comparer</Text>
                            </TouchableOpacity>
                        )}
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
    closeButton: {
        padding: 4,
    },
    scrollContent: {
        maxHeight: 400,
    },
    comparisonTable: {
        minWidth: '100%',
    },
    headerRow: {
        flexDirection: 'row',
        borderBottomWidth: 2,
        borderBottomColor: '#E5E7EB',
    },
    criteriaColumn: {
        width: 120,
        padding: 12,
        backgroundColor: '#F9FAFB',
        borderRightWidth: 1,
        borderRightColor: '#E5E7EB',
    },
    criteriaHeader: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111827',
    },
    propertyColumn: {
        width: 150,
        padding: 12,
        borderRightWidth: 1,
        borderRightColor: '#E5E7EB',
        position: 'relative',
    },
    propertyHeader: {
        fontSize: 12,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
    },
    removeButton: {
        position: 'absolute',
        top: 8,
        right: 8,
        padding: 4,
    },
    addColumn: {
        width: 150,
        padding: 12,
        justifyContent: 'center',
        alignItems: 'center',
        borderStyle: 'dashed',
        borderWidth: 2,
        borderColor: '#D1D5DB',
    },
    addText: {
        fontSize: 12,
        color: '#6B7280',
    },
    comparisonRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    criteriaLabel: {
        fontSize: 12,
        color: '#6B7280',
    },
    propertyValue: {
        fontSize: 12,
        color: '#111827',
        fontWeight: '500',
    },
    propertiesList: {
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    listTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 12,
    },
    propertyCard: {
        width: 140,
        padding: 12,
        marginRight: 12,
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#E5E7EB',
        position: 'relative',
    },
    propertyCardSelected: {
        backgroundColor: '#EFF6FF',
        borderColor: modernColors.primary,
    },
    propertyCardDisabled: {
        opacity: 0.5,
    },
    propertyCardTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
    },
    propertyCardPrice: {
        fontSize: 14,
        fontWeight: '700',
        color: modernColors.primary,
    },
    selectedBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: modernColors.primary,
        borderRadius: 12,
        width: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
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
    closeButtonFooter: {
        backgroundColor: '#F3F4F6',
    },
    closeButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
    },
    compareButton: {
        backgroundColor: modernColors.primary,
    },
    compareButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
});

export default PropertyComparisonModal;

