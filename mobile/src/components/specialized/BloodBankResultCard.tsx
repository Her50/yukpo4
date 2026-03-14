import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import {
    Linking,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { modernColors } from '../../theme/modernTheme';
import ChatModalMobile from '../ChatModalMobile';
import OrderDeliveryModal from '../delivery/OrderDeliveryModal';
import SafeIcon from '../SafeIcon';

interface BloodBankResultCardProps {
    banque: {
        id: number;
        service_id: number;
        nom: string;
        adresse?: string;
        quartier?: string;
        ville?: string;
        telephone?: string;
        telephone_urgence?: string;
        whatsapp?: string;
        stocks_groupes_sanguins?: Record<string, any>;
        accepte_dons: boolean;
        accepte_demandes: boolean;
        urgence_24h: boolean;
        is_available_now: boolean;
        distance_km?: number;
    };
}

const BloodBankResultCard: React.FC<BloodBankResultCardProps> = ({ banque }) => {
    const navigation = useNavigation();
    const { user } = useAuth();
    const [showChatModal, setShowChatModal] = useState(false);
    const [showDeliveryModal, setShowDeliveryModal] = useState(false);
    const [showStocksDetail, setShowStocksDetail] = useState(false);

    // Calculer les stocks détaillés
    const stocksDetails = banque.stocks_groupes_sanguins
        ? Object.entries(banque.stocks_groupes_sanguins).map(([groupe, stock]: [string, any]) => ({
            groupe,
            quantite: stock.quantite || 0,
            unite: stock.unite || 'poches',
            derniere_maj: stock.derniere_maj || null,
            statut: stock.quantite > 10 ? 'disponible' : stock.quantite > 5 ? 'moyen' : stock.quantite > 0 ? 'faible' : 'epuise',
        }))
        : [];

    const groupesDisponibles = stocksDetails.filter((s) => s.quantite > 0);
    const groupesFaibles = stocksDetails.filter((s) => s.quantite > 0 && s.quantite <= 5);
    const totalStock = stocksDetails.reduce((sum, s) => sum + s.quantite, 0);

    const handlePress = () => {
        // Navigation vers détails si nécessaire
        // navigation.navigate('BloodBankDetails', { id: banque.id });
    };

    return (
        <TouchableOpacity style={styles.card} onPress={handlePress} activeOpacity={0.7}>
            <View style={styles.header}>
                <View style={styles.titleRow}>
                    <SafeIcon name="droplet" size={24} color="#DC2626" />
                    <View style={styles.titleContainer}>
                        <Text style={styles.title}>{banque.nom}</Text>
                        {banque.urgence_24h && (
                            <View style={styles.urgenceBadge}>
                                <Text style={styles.urgenceText}>URGENCE 24H</Text>
                            </View>
                        )}
                    </View>
                </View>
                {banque.is_available_now && (
                    <View style={styles.availableBadge}>
                        <Text style={styles.availableText}>Disponible</Text>
                    </View>
                )}
            </View>

            {(banque.quartier || banque.ville) && (
                <View style={styles.locationRow}>
                    <SafeIcon name="map-pin" size={14} color="#6B7280" />
                    <Text style={styles.locationText}>
                        {[banque.quartier, banque.ville].filter(Boolean).join(', ')}
                    </Text>
                </View>
            )}

            {/* Section stocks améliorée */}
            <View style={styles.stocksSection}>
                <View style={styles.stocksHeader}>
                    <View style={styles.stocksHeaderLeft}>
                        <Text style={styles.stocksLabel}>Stocks disponibles</Text>
                        {totalStock > 0 && (
                            <Text style={styles.stocksTotal}>
                                {totalStock} poches totales
                            </Text>
                        )}
                    </View>
                    {groupesDisponibles.length > 0 && (
                        <TouchableOpacity
                            onPress={() => setShowStocksDetail(true)}
                            style={styles.viewAllButton}
                        >
                            <Text style={styles.viewAllText}>Voir tout</Text>
                            <SafeIcon name="chevron-right" size={14} color={modernColors.primary} />
                        </TouchableOpacity>
                    )}
                </View>

                {groupesFaibles.length > 0 && (
                    <View style={styles.alertBanner}>
                        <SafeIcon name="alert-triangle" size={16} color="#F59E0B" />
                        <Text style={styles.alertText}>
                            {groupesFaibles.length} groupe(s) en stock faible
                        </Text>
                    </View>
                )}

                {groupesDisponibles.length > 0 ? (
                    <View style={styles.groupesRow}>
                        {groupesDisponibles.slice(0, 6).map((stock) => (
                            <View
                                key={stock.groupe}
                                style={[
                                    styles.groupeTag,
                                    stock.statut === 'faible' && styles.groupeTagLow,
                                    stock.statut === 'epuise' && styles.groupeTagEmpty,
                                ]}
                            >
                                <Text style={styles.groupeText}>{stock.groupe}</Text>
                                <Text
                                    style={[
                                        styles.groupeQuantite,
                                        stock.statut === 'faible' && styles.groupeQuantiteLow,
                                    ]}
                                >
                                    {stock.quantite} {stock.unite}
                                </Text>
                            </View>
                        ))}
                        {groupesDisponibles.length > 6 && (
                            <TouchableOpacity
                                onPress={() => setShowStocksDetail(true)}
                                style={styles.moreButton}
                            >
                                <Text style={styles.moreText}>
                                    +{groupesDisponibles.length - 6}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                ) : (
                    <View style={styles.noStockContainer}>
                        <Text style={styles.noStockText}>Aucun stock disponible</Text>
                    </View>
                )}
            </View>

            <View style={styles.servicesRow}>
                {banque.accepte_dons && (
                    <View style={styles.serviceTag}>
                        <SafeIcon name="heart" size={12} color="#10B981" />
                        <Text style={styles.serviceTagText}>Accepte dons</Text>
                    </View>
                )}
                {banque.accepte_demandes && (
                    <View style={styles.serviceTag}>
                        <SafeIcon name="check-circle" size={12} color="#3B82F6" />
                        <Text style={styles.serviceTagText}>Accepte demandes</Text>
                    </View>
                )}
            </View>

            <View style={styles.footer}>
                {banque.distance_km && (
                    <View style={styles.distanceRow}>
                        <SafeIcon name="navigation" size={14} color={modernColors.primary} />
                        <Text style={styles.distanceText}>
                            {banque.distance_km.toFixed(1)} km
                        </Text>
                    </View>
                )}
                <View style={styles.contactRow}>
                    {banque.telephone && (
                        <TouchableOpacity
                            style={styles.contactButton}
                            onPress={() => Linking.openURL(`tel:${banque.telephone}`)}
                        >
                            <SafeIcon name="phone" size={16} color={modernColors.primary} />
                        </TouchableOpacity>
                    )}
                    {banque.telephone_urgence && (
                        <TouchableOpacity
                            style={[styles.contactButton, styles.urgenceButton]}
                            onPress={() => Linking.openURL(`tel:${banque.telephone_urgence}`)}
                        >
                            <SafeIcon name="phone" size={16} color="#DC2626" />
                        </TouchableOpacity>
                    )}
                    {banque.whatsapp && (
                        <TouchableOpacity
                            style={styles.contactButton}
                            onPress={() => {
                                const whatsappNumber = banque.whatsapp.replace(/[^0-9]/g, '');
                                Linking.openURL(`https://wa.me/${whatsappNumber}`);
                            }}
                        >
                            <SafeIcon name="message-circle" size={16} color="#25D366" />
                        </TouchableOpacity>
                    )}
                    {/* Bouton Chat */}
                    <TouchableOpacity
                        style={styles.contactButton}
                        onPress={() => setShowChatModal(true)}
                    >
                        <SafeIcon name="message-square" size={16} color={modernColors.primary} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Boutons d'action */}
            <View style={styles.actionsRow}>
                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => setShowChatModal(true)}
                >
                    <SafeIcon name="message-square" size={18} color={modernColors.primary} />
                    <Text style={styles.actionButtonText}>Chat</Text>
                </TouchableOpacity>
                {banque.accepte_demandes && (
                    <TouchableOpacity
                        style={[styles.actionButton, styles.deliveryButton]}
                        onPress={() => setShowDeliveryModal(true)}
                    >
                        <SafeIcon name="truck" size={18} color="#fff" />
                        <Text style={[styles.actionButtonText, styles.deliveryButtonText]}>
                            Livraison
                        </Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Modal détails stocks */}
            <Modal
                visible={showStocksDetail}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowStocksDetail(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Stocks détaillés</Text>
                            <TouchableOpacity
                                onPress={() => setShowStocksDetail(false)}
                                style={styles.modalCloseButton}
                            >
                                <SafeIcon name="x" size={24} color="#111827" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.modalBody}>
                            {stocksDetails.length > 0 ? (
                                stocksDetails.map((stock) => (
                                    <View
                                        key={stock.groupe}
                                        style={[
                                            styles.stockDetailRow,
                                            stock.statut === 'faible' && styles.stockDetailRowLow,
                                            stock.statut === 'epuise' && styles.stockDetailRowEmpty,
                                        ]}
                                    >
                                        <View style={styles.stockDetailLeft}>
                                            <Text style={styles.stockDetailGroupe}>
                                                {stock.groupe}
                                            </Text>
                                            {stock.derniere_maj && (
                                                <Text style={styles.stockDetailDate}>
                                                    Mis à jour: {new Date(stock.derniere_maj).toLocaleDateString('fr-FR')}
                                                </Text>
                                            )}
                                        </View>
                                        <View style={styles.stockDetailRight}>
                                            <Text
                                                style={[
                                                    styles.stockDetailQuantite,
                                                    stock.statut === 'faible' && styles.stockDetailQuantiteLow,
                                                    stock.statut === 'epuise' && styles.stockDetailQuantiteEmpty,
                                                ]}
                                            >
                                                {stock.quantite} {stock.unite}
                                            </Text>
                                            <View
                                                style={[
                                                    styles.stockStatusBadge,
                                                    stock.statut === 'disponible' && styles.stockStatusAvailable,
                                                    stock.statut === 'moyen' && styles.stockStatusMedium,
                                                    stock.statut === 'faible' && styles.stockStatusLow,
                                                    stock.statut === 'epuise' && styles.stockStatusEmpty,
                                                ]}
                                            >
                                                <Text style={styles.stockStatusText}>
                                                    {stock.statut === 'disponible'
                                                        ? 'Disponible'
                                                        : stock.statut === 'moyen'
                                                            ? 'Moyen'
                                                            : stock.statut === 'faible'
                                                                ? 'Faible'
                                                                : 'Épuisé'}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                ))
                            ) : (
                                <Text style={styles.noStockText}>Aucun stock enregistré</Text>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Chat Modal */}
            <ChatModalMobile
                visible={showChatModal}
                onClose={() => setShowChatModal(false)}
                service={{
                    id: banque.service_id,
                    titre: banque.nom,
                    description: `Banque de sang: ${banque.nom}`,
                }}
                prestataireInfo={{
                    id: banque.service_id,
                    nom_complet: banque.nom,
                    telephone: banque.telephone,
                    whatsapp: banque.whatsapp,
                }}
                user={user}
            />

            {/* Delivery Modal */}
            <OrderDeliveryModal
                visible={showDeliveryModal}
                onClose={() => setShowDeliveryModal(false)}
                serviceId={banque.service_id}
                productName={`Sang - ${banque.nom}`}
                onSuccess={(deliveryId) => {
                    setShowDeliveryModal(false);
                    // Optionnel: navigation ou notification
                }}
            />
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    titleContainer: {
        marginLeft: 8,
        flex: 1,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    urgenceBadge: {
        backgroundColor: '#FEE2E2',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        alignSelf: 'flex-start',
    },
    urgenceText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#DC2626',
        textTransform: 'uppercase',
    },
    availableBadge: {
        backgroundColor: '#D1FAE5',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    availableText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#059669',
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    locationText: {
        fontSize: 14,
        color: '#6B7280',
        marginLeft: 6,
    },
    stocksSection: {
        marginBottom: 12,
        padding: 12,
        backgroundColor: '#FEF2F2',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#FEE2E2',
    },
    stocksLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#991B1B',
        marginBottom: 8,
    },
    groupesRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    groupeTag: {
        backgroundColor: '#fff',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#DC2626',
    },
    groupeText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#DC2626',
    },
    groupeQuantite: {
        fontSize: 10,
        color: '#991B1B',
        marginTop: 2,
    },
    moreText: {
        fontSize: 12,
        color: '#6B7280',
        alignSelf: 'center',
        marginLeft: 4,
    },
    servicesRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 12,
    },
    serviceTag: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 6,
        backgroundColor: '#F0FDF4',
        gap: 4,
    },
    serviceTagText: {
        fontSize: 12,
        color: '#059669',
        fontWeight: '600',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    distanceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    distanceText: {
        fontSize: 14,
        color: modernColors.primary,
        fontWeight: '600',
    },
    contactRow: {
        flexDirection: 'row',
        gap: 8,
    },
    contactButton: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
    },
    urgenceButton: {
        backgroundColor: '#FEE2E2',
    },
    stocksHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    stocksHeaderLeft: {
        flex: 1,
    },
    stocksTotal: {
        fontSize: 11,
        color: '#6B7280',
        marginTop: 2,
    },
    viewAllButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    viewAllText: {
        fontSize: 12,
        color: modernColors.primary,
        fontWeight: '600',
    },
    alertBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEF3C7',
        padding: 8,
        borderRadius: 6,
        marginBottom: 8,
        gap: 6,
    },
    alertText: {
        fontSize: 12,
        color: '#92400E',
        fontWeight: '600',
    },
    groupeTagLow: {
        borderColor: '#F59E0B',
        backgroundColor: '#FFFBEB',
    },
    groupeTagEmpty: {
        borderColor: '#9CA3AF',
        backgroundColor: '#F9FAFB',
    },
    groupeQuantiteLow: {
        color: '#F59E0B',
        fontWeight: '700',
    },
    noStockContainer: {
        padding: 16,
        alignItems: 'center',
    },
    noStockText: {
        fontSize: 14,
        color: '#9CA3AF',
        fontStyle: 'italic',
    },
    actionsRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    actionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
        gap: 6,
    },
    deliveryButton: {
        backgroundColor: modernColors.primary,
    },
    actionButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
    },
    deliveryButtonText: {
        color: '#fff',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: 16,
        width: '90%',
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    modalCloseButton: {
        padding: 4,
    },
    modalBody: {
        padding: 16,
    },
    stockDetailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
        marginBottom: 8,
        borderRadius: 8,
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    stockDetailRowLow: {
        backgroundColor: '#FFFBEB',
        borderColor: '#F59E0B',
    },
    stockDetailRowEmpty: {
        backgroundColor: '#F9FAFB',
        borderColor: '#9CA3AF',
        opacity: 0.6,
    },
    stockDetailLeft: {
        flex: 1,
    },
    stockDetailGroupe: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    stockDetailDate: {
        fontSize: 11,
        color: '#6B7280',
    },
    stockDetailRight: {
        alignItems: 'flex-end',
    },
    stockDetailQuantite: {
        fontSize: 16,
        fontWeight: '700',
        color: '#DC2626',
        marginBottom: 4,
    },
    stockDetailQuantiteLow: {
        color: '#F59E0B',
    },
    stockDetailQuantiteEmpty: {
        color: '#9CA3AF',
    },
    stockStatusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    stockStatusAvailable: {
        backgroundColor: '#D1FAE5',
    },
    stockStatusMedium: {
        backgroundColor: '#FEF3C7',
    },
    stockStatusLow: {
        backgroundColor: '#FEE2E2',
    },
    stockStatusEmpty: {
        backgroundColor: '#F3F4F6',
    },
    stockStatusText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#111827',
    },
    moreButton: {
        backgroundColor: '#F3F4F6',
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 4,
        alignItems: 'center',
        justifyContent: 'center',
    },
    moreText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#6B7280',
    },
});

export default BloodBankResultCard;

