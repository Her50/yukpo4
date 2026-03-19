import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { apiGet } from '../services/api';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';
import { useLanguageSafe } from '../contexts/LanguageContext';

export interface Partner {
    id: number;
    name: string;
    description?: string;
    partner_type: string;
    contact_email?: string;
    contact_phone?: string;
    address?: string;
    city?: string;
    country: string;
    continent?: string;
    website?: string;
    logo_url?: string;
    location_latitude?: number;
    location_longitude?: number;
    location_address?: string;
    is_active: boolean;
}

interface PartnerSelectorProps {
    label: string;
    value: Partner | null;
    onChange: (partner: Partner | null) => void;
    partnerType: 'pharmacie' | 'hopital' | 'laboratoire' | 'agence de voyage' | 'demenagement' | 'transport' | 'assureur' | 'supermarche' | 'telecom' | 'livraison';
    required?: boolean;
    placeholder?: string;
    disabled?: boolean;
}

const PartnerSelector: React.FC<PartnerSelectorProps> = ({
    label,
    value,
    onChange,
    partnerType,
    required = false,
    placeholder,
    disabled = false,
}) => {
        const { t } = useLanguageSafe();
const [searchQuery, setSearchQuery] = useState('');
    const [partners, setPartners] = useState<Partner[]>([]);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [selectedPartner, setSelectedPartner] = useState<Partner | null>(value);

    // Charger les partenaires lors de l'ouverture du modal
    useEffect(() => {
        if (showModal) {
            loadPartners('');
        }
    }, [showModal, partnerType]);

    // Synchroniser selectedPartner avec value
    useEffect(() => {
        setSelectedPartner(value);
    }, [value]);

    const loadPartners = async (query: string = '') => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                type: partnerType,
                limit: '20',
            });
            if (query.trim()) {
                params.append('query', query.trim());
            }

            const response = await apiGet<{
                success: boolean;
                partners: Partner[];
                total: number;
            }>(`/api/partners/search?${params.toString()}`);

            if (response.success && response.partners) {
                setPartners(response.partners);
            } else {
                setPartners([]);
            }
        } catch (error: any) {
            console.error('[PartnerSelector] Erreur chargement partenaires:', error);
            setPartners([]);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (text: string) => {
        setSearchQuery(text);
        // Debounce: charger après 300ms d'inactivité
        const timeoutId = setTimeout(() => {
            loadPartners(text);
        }, 300);
        return () => clearTimeout(timeoutId);
    };

    const handleSelectPartner = (partner: Partner) => {
        setSelectedPartner(partner);
        onChange(partner);
        setShowModal(false);
        setSearchQuery('');
    };

    const handleClear = () => {
        setSelectedPartner(null);
        onChange(null);
        setSearchQuery('');
    };

    const formatPartnerDisplay = (partner: Partner): string => {
        const parts: string[] = [partner.name];
        if (partner.city) {
            parts.push(partner.city);
        }
        if (partner.country) {
            parts.push(partner.country);
        }
        return parts.join(', ');
    };

    return (
        <View style={styles.container}>
            <Text style={styles.label}>
                {label}
                {required && <Text style={styles.required}> *</Text>}
            </Text>

            <TouchableOpacity
                style={[styles.input, disabled && styles.inputDisabled]}
                onPress={() => !disabled && setShowModal(true)}
                disabled={disabled}
            >
                {selectedPartner ? (
                    <View style={styles.selectedContainer}>
                        <View style={styles.selectedInfo}>
                            <Text style={styles.selectedName}>{selectedPartner.name}</Text>
                            {(selectedPartner.city || selectedPartner.country) && (
                                <Text style={styles.selectedLocation}>
                                    {[selectedPartner.city, selectedPartner.country].filter(Boolean).join(', ')}
                                </Text>
                            )}
                        </View>
                        {!disabled && (
                            <TouchableOpacity
                                onPress={(e) => {
                                    e.stopPropagation();
                                    handleClear();
                                }}
                                style={styles.clearButton}
                            >
                                <SafeIcon name="x" size={18} color={modernColors.textSecondary} type="lucide" />
                            </TouchableOpacity>
                        )}
                    </View>
                ) : (
                    <Text style={styles.placeholder}>
                        {placeholder || t('partnerSelector.selectionnerUnPartenaire', { partnerType: partnerType })}
                    </Text>
                )}
                <SafeIcon name="chevron-down" size={20} color={modernColors.textSecondary} type="lucide" />
            </TouchableOpacity>

            <Modal
                visible={showModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{t('partnerSelector.selectionnerUnPartenaire')}</Text>
                            <TouchableOpacity
                                onPress={() => setShowModal(false)}
                                style={styles.modalCloseButton}
                            >
                                <SafeIcon name="x" size={24} color={modernColors.text} type="lucide" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.searchContainer}>
                            <SafeIcon name="search" size={20} color={modernColors.textSecondary} type="lucide" />
                            <TextInput
                                style={styles.searchInput}
                                placeholder={`Rechercher un partenaire ${partnerType}...`}
                                value={searchQuery}
                                onChangeText={handleSearch}
                                autoFocus
                            />
                            {loading && (
                                <ActivityIndicator size="small" color={modernColors.primary} style={styles.loader} />
                            )}
                        </View>

                        <ScrollView style={styles.partnersList} keyboardShouldPersistTaps="handled">
                            {partners.length === 0 && !loading && (
                                <View style={styles.emptyContainer}>
                                    <Text style={styles.emptyText}>
                                        {searchQuery ? t('partnerSelector.aucunPartenaireTrouve') : 'Aucun partenaire disponible'}
                                    </Text>
                                </View>
                            )}

                            {partners.map((partner) => (
                                <TouchableOpacity
                                    key={partner.id}
                                    style={[
                                        styles.partnerItem,
                                        selectedPartner?.id === partner.id && styles.partnerItemSelected,
                                    ]}
                                    onPress={() => handleSelectPartner(partner)}
                                >
                                    <View style={styles.partnerInfo}>
                                        <Text style={styles.partnerName}>{partner.name}</Text>
                                        {partner.description && (
                                            <Text style={styles.partnerDescription} numberOfLines={1}>
                                                {partner.description}
                                            </Text>
                                        )}
                                        <View style={styles.partnerLocation}>
                                            {partner.city && (
                                                <Text style={styles.partnerLocationText}>
                                                    📍 {partner.city}
                                                    {partner.country && `, ${partner.country}`}
                                                </Text>
                                            )}
                                            {!partner.city && partner.country && (
                                                <Text style={styles.partnerLocationText}>
                                                    📍 {partner.country}
                                                </Text>
                                            )}
                                        </View>
                                        {partner.contact_phone && (
                                            <Text style={styles.partnerContact}>
                                                📞 {partner.contact_phone}
                                            </Text>
                                        )}
                                    </View>
                                    {selectedPartner?.id === partner.id && (
                                        <SafeIcon name="check" size={20} color={modernColors.primary} type="lucide" />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
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
    },
    input: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: modernColors.surface,
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
        minHeight: 48,
    },
    inputDisabled: {
        opacity: 0.6,
        backgroundColor: modernColors.background,
    },
    placeholder: {
        flex: 1,
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    selectedContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    selectedInfo: {
        flex: 1,
    },
    selectedName: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    selectedLocation: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginTop: 2,
    },
    clearButton: {
        marginLeft: 8,
        padding: 4,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: modernColors.surface,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '80%',
        paddingBottom: 20,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.text,
    },
    modalCloseButton: {
        padding: 4,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: modernColors.background,
        margin: 16,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        color: modernColors.text,
        marginLeft: 8,
    },
    loader: {
        marginLeft: 8,
    },
    partnersList: {
        flex: 1,
    },
    emptyContainer: {
        padding: 32,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    partnerItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    partnerItemSelected: {
        backgroundColor: modernColors.primary + '10',
    },
    partnerInfo: {
        flex: 1,
    },
    partnerName: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 4,
    },
    partnerDescription: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginBottom: 4,
    },
    partnerLocation: {
        marginTop: 4,
    },
    partnerLocationText: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    partnerContact: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginTop: 2,
    },
});

export default PartnerSelector;

