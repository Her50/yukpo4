import React, { useState } from 'react';
import {
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { LocationObject } from '../LocationSelector';
import { useSavedAddresses, UserSavedAddress } from '../../hooks/useSavedAddresses';
import { modernColors } from '../../theme/modernTheme';
import SafeIcon from '../SafeIcon';
import { NativeButton, NativeCard } from '../SafeNativeDesign';
import { useLanguageSafe } from '../../contexts/LanguageContext';

interface SavedAddressSelectorProps {
    addressType: 'pickup' | 'dropoff';
    value?: LocationObject | string | UserSavedAddress;
    onSelect: (address: UserSavedAddress | LocationObject) => void;
    allowNew?: boolean; // Permettre de créer une nouvelle adresse
    showQuickSave?: boolean; // Afficher option "Sauvegarder cette adresse" après sélection GPS
    onQuickSave?: (location: LocationObject) => void; // Callback pour sauvegarder rapidement
    placeholder?: string;
}

/**
 * Composant pour sélectionner une adresse sauvegardée ou en créer une nouvelle
 */
export const SavedAddressSelector: React.FC<SavedAddressSelectorProps> = ({
    addressType,
    value,
    onSelect,
    allowNew = true,
    showQuickSave = false,
    onQuickSave,
    placeholder={t('savedAddressSelector.selectionnerUneAdresse')},
}) => {
    const { addresses, loading, createAddressFromLocation, getDefaultAddress } = useSavedAddresses(addressType);
        const { t } = useLanguageSafe();
const [showModal, setShowModal] = useState(false);
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [saveLocation, setSaveLocation] = useState<LocationObject | null>(null);
    const [saveLabel, setSaveLabel] = useState('');

    // Filtrer les adresses par type
    const filteredAddresses = addresses.filter(addr => 
        addr.address_type === addressType || addr.address_type === 'both'
    );

    // Adresse par défaut
    const defaultAddress = getDefaultAddress(addressType);

    // Format de l'adresse pour l'affichage
    const formatAddressDisplay = (address: UserSavedAddress): string => {
        const parts = [address.address];
        if (address.building_number) parts.push(t('savedAddressSelector.bat', { address_building_number: address.building_number }));
        if (address.floor) parts.push(t('savedAddressSelector.etage', { address_floor: address.floor }));
        if (address.apartment) parts.push(`Appt. ${address.apartment}`);
        return parts.join(', ');
    };

    // Afficher la valeur actuelle
    const displayValue = (): string => {
        if (!value) return placeholder;
        
        if (typeof value === 'string') {
            return value;
        }
        
        if ('id' in value && 'label' in value) {
            // C'est un UserSavedAddress
            const addr = value as UserSavedAddress;
            return `${addr.label} - ${formatAddressDisplay(addr)}`;
        }
        
        // C'est un LocationObject
        const loc = value as LocationObject;
        return loc.raw || loc.place_name || placeholder;
    };

    const handleSelectSaved = async (address: UserSavedAddress) => {
        onSelect(address);
        setShowModal(false);
    };

    const handleQuickSave = () => {
        if (!saveLocation) return;
        setShowSaveModal(true);
    };

    const handleConfirmSave = async () => {
        if (!saveLocation || !saveLabel.trim()) {
            Alert.alert('Erreur', 'Veuillez entrer un nom pour cette adresse');
            return;
        }

        try {
            const saved = await createAddressFromLocation(
                saveLocation,
                saveLabel.trim(),
                addressType,
                {
                    is_default_pickup: addressType === 'pickup',
                    is_default_dropoff: addressType === 'dropoff',
                }
            );
            onSelect(saved);
            setShowSaveModal(false);
            setSaveLocation(null);
            setSaveLabel('');
            if (onQuickSave) {
                onQuickSave(saveLocation);
            }
        } catch (error: any) {
            Alert.alert('Erreur', error?.message || 'Erreur lors de la sauvegarde');
        }
    };

    return (
        <View style={styles.container}>
            <TouchableOpacity
                style={styles.selector}
                onPress={() => setShowModal(true)}
                activeOpacity={0.7}
            >
                <SafeIcon name="map-pin" size={20} color={modernColors.primary} />
                <Text style={[styles.selectorText, !value && styles.placeholderText]}>
                    {displayValue()}
                </Text>
                <SafeIcon name="chevron-down" size={20} color={modernColors.textSecondary} />
            </TouchableOpacity>

            {/* Modal de sélection */}
            <Modal
                visible={showModal}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setShowModal(false)}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>
                            {addressType === 'pickup' ? t('savedAddressSelector.adresseDeRecuperation') : 'Adresse de livraison'}
                        </Text>
                        <TouchableOpacity
                            onPress={() => setShowModal(false)}
                            style={styles.closeButton}
                        >
                            <SafeIcon name="x" size={24} color={modernColors.text} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.modalContent}>
                        {loading ? (
                            <View style={styles.loadingContainer}>
                                <Text style={styles.loadingText}>{t('savedAddressSelector.chargement')}</Text>
                            </View>
                        ) : filteredAddresses.length === 0 ? (
                            <View style={styles.emptyContainer}>
                                <SafeIcon name="map-pin" size={48} color={modernColors.textSecondary} />
                                <Text style={styles.emptyText}>{t('savedAddressSelector.aucuneAdresseSauvegardee')}</Text>
                                {allowNew && (
                                    <Text style={styles.emptyHint}>
                                        Utilisez le sélecteur GPS pour créer votre première adresse
                                    </Text>
                                )}
                            </View>
                        ) : (
                            <>
                                {/* Adresse par défaut en premier */}
                                {defaultAddress && (
                                    <View style={styles.section}>
                                        <Text style={styles.sectionTitle}>{t('savedAddressSelector.adresseParDefaut')}</Text>
                                        <TouchableOpacity
                                            style={[styles.addressCard, styles.defaultCard]}
                                            onPress={() => handleSelectSaved(defaultAddress)}
                                        >
                                            <View style={styles.addressHeader}>
                                                <SafeIcon name="star" size={16} color="#F59E0B" />
                                                <Text style={styles.addressLabel}>{defaultAddress.label}</Text>
                                                <View style={styles.defaultBadge}>
                                                    <Text style={styles.defaultBadgeText}>{t('savedAddressSelector.defaut')}</Text>
                                                </View>
                                            </View>
                                            <Text style={styles.addressText} numberOfLines={2}>
                                                {formatAddressDisplay(defaultAddress)}
                                            </Text>
                                            {defaultAddress.usage_count > 0 && (
                                                <Text style={styles.usageText}>
                                                    Utilisée {defaultAddress.usage_count} fois
                                                </Text>
                                            )}
                                        </TouchableOpacity>
                                    </View>
                                )}

                                {/* Autres adresses */}
                                {filteredAddresses.filter(a => a.id !== defaultAddress?.id).length > 0 && (
                                    <View style={styles.section}>
                                        <Text style={styles.sectionTitle}>{t('savedAddressSelector.mesAdresses')}</Text>
                                        {filteredAddresses
                                            .filter(a => a.id !== defaultAddress?.id)
                                            .map((address) => (
                                                <TouchableOpacity
                                                    key={address.id}
                                                    style={styles.addressCard}
                                                    onPress={() => handleSelectSaved(address)}
                                                >
                                                    <View style={styles.addressHeader}>
                                                        <SafeIcon 
                                                            name="map-pin" 
                                                            size={16} 
                                                            color={modernColors.textSecondary} 
                                                        />
                                                        <Text style={styles.addressLabel}>{address.label}</Text>
                                                    </View>
                                                    <Text style={styles.addressText} numberOfLines={2}>
                                                        {formatAddressDisplay(address)}
                                                    </Text>
                                                    {address.usage_count > 0 && (
                                                        <Text style={styles.usageText}>
                                                            Utilisée {address.usage_count} fois
                                                        </Text>
                                                    )}
                                                </TouchableOpacity>
                                            ))}
                                    </View>
                                )}
                            </>
                        )}
                    </ScrollView>
                </View>
            </Modal>

            {/* Modal de sauvegarde rapide */}
            <Modal
                visible={showSaveModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowSaveModal(false)}
            >
                <View style={styles.saveModalOverlay}>
                    <NativeCard style={styles.saveModalCard}>
                        <Text style={styles.saveModalTitle}>{t('savedAddressSelector.sauvegarderCetteAdresse')}</Text>
                        <Text style={styles.saveModalHint}>
                            Donnez un nom à cette adresse pour la retrouver facilement
                        </Text>
                        <TextInput
                            style={styles.saveModalInput}
                            value={saveLabel}
                            onChangeText={setSaveLabel}
                            placeholder="Ex: Domicile, Bureau, Maison..."
                            placeholderTextColor={modernColors.textSecondary}
                            autoFocus
                        />
                        <View style={styles.saveModalActions}>
                            <NativeButton
                                title={t('savedAddressSelector.annuler')}
                                onPress={() => {
                                    setShowSaveModal(false);
                                    setSaveLabel('');
                                }}
                                variant="outline"
                                size="small"
                            />
                            <NativeButton
                                title={t('savedAddressSelector.sauvegarder')}
                                onPress={handleConfirmSave}
                                variant="primary"
                                size="small"
                                disabled={!saveLabel.trim()}
                            />
                        </View>
                    </NativeCard>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginVertical: 8,
    },
    selector: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: modernColors.surface,
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: modernColors.border,
        gap: 8,
    },
    selectorText: {
        flex: 1,
        fontSize: 14,
        color: modernColors.text,
    },
    placeholderText: {
        color: modernColors.textSecondary,
    },
    modalContainer: {
        flex: 1,
        backgroundColor: modernColors.background,
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
        fontWeight: '600',
        color: modernColors.text,
    },
    closeButton: {
        padding: 4,
    },
    modalContent: {
        flex: 1,
        padding: 16,
    },
    loadingContainer: {
        padding: 32,
        alignItems: 'center',
    },
    loadingText: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    emptyContainer: {
        padding: 32,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        marginTop: 16,
        marginBottom: 8,
    },
    emptyHint: {
        fontSize: 14,
        color: modernColors.textSecondary,
        textAlign: 'center',
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.textSecondary,
        marginBottom: 12,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    addressCard: {
        backgroundColor: modernColors.surface,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    defaultCard: {
        borderColor: '#F59E0B',
        borderWidth: 2,
        backgroundColor: '#FEF3C7',
    },
    addressHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        gap: 8,
    },
    addressLabel: {
        flex: 1,
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
    },
    defaultBadge: {
        backgroundColor: '#F59E0B',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    defaultBadgeText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#FFFFFF',
        textTransform: 'uppercase',
    },
    addressText: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginBottom: 4,
    },
    usageText: {
        fontSize: 12,
        color: modernColors.textSecondary,
        fontStyle: 'italic',
    },
    saveModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    saveModalCard: {
        width: '100%',
        maxWidth: 400,
        padding: 24,
    },
    saveModalTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 8,
    },
    saveModalHint: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginBottom: 16,
    },
    saveModalInput: {
        backgroundColor: modernColors.surface,
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        color: modernColors.text,
        borderWidth: 1,
        borderColor: modernColors.border,
        marginBottom: 16,
    },
    saveModalActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
    },
});





