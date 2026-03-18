/**
 * Modal de validation de commande pour Transport Intra-Urbain
 * Permet au client de confirmer sa course avec toutes les informations
 */
import React, { useState } from 'react';
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    Alert,
} from 'react-native';
import SafeIcon from '../../../components/SafeIcon';

interface OrderDetails {
    driverName: string;
    driverId: string;
    vehicleType: string;
    pickupLocation: {
        address: string;
        latitude: number;
        longitude: number;
    };
    destination: {
        address: string;
        latitude: number;
        longitude: number;
    };
    distance: number;
    unpavedDistance?: number;
    estimatedDuration: number;
    agreedPrice: number;
    serviceOptions: string[];
    paymentMethods: string[];
    comfortOptions?: string[];
}

interface OrderValidationModalProps {
    visible: boolean;
    onClose: () => void;
    orderDetails: OrderDetails;
    onConfirm: () => void;
    onModify: () => void;
}

const OrderValidationModal: React.FC<OrderValidationModalProps> = ({
    visible,
    onClose,
    orderDetails,
    onConfirm,
    onModify,
}) => {
    const [selectedPayment, setSelectedPayment] = useState<string>(orderDetails.paymentMethods[0] || '');

    const handleConfirm = () => {
        if (!selectedPayment) {
            Alert.alert('Mode de paiement', 'Veuillez sélectionner un mode de paiement');
            return;
        }

        Alert.alert(
            'Confirmer la course',
            'Êtes-vous sûr de vouloir confirmer cette course ?',
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Confirmer',
                    onPress: onConfirm,
                    style: 'default',
                },
            ]
        );
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <SafeIcon name="x" size={24} color="#1F2937" />
                    </TouchableOpacity>
                    <View style={styles.headerContent}>
                        <Text style={styles.headerTitle}>✅ Validation de la course</Text>
                        <Text style={styles.headerSubtitle}>Vérifiez les détails avant de confirmer</Text>
                    </View>
                </View>

                <ScrollView style={styles.content}>
                    {/* Informations chauffeur */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>\uD83D\uDE97 Chauffeur</Text>
                        <View style={styles.infoCard}>
                            <View style={styles.infoRow}>
                                <SafeIcon name="user" size={16} color="#F59E0B" />
                                <Text style={styles.infoLabel}>Nom:</Text>
                                <Text style={styles.infoValue}>{orderDetails.driverName}</Text>
                            </View>
                            <View style={styles.infoRow}>
                                <SafeIcon name="car" size={16} color="#F59E0B" />
                                <Text style={styles.infoLabel}>Véhicule:</Text>
                                <Text style={styles.infoValue}>{orderDetails.vehicleType}</Text>
                            </View>
                        </View>
                    </View>

                    {/* Itinéraire */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>\uD83D\uDCCD Itinéraire</Text>
                        <View style={styles.infoCard}>
                            <View style={styles.routeItem}>
                                <View style={styles.routeDot} />
                                <View style={styles.routeInfo}>
                                    <Text style={styles.routeLabel}>Départ</Text>
                                    <Text style={styles.routeAddress}>{orderDetails.pickupLocation.address}</Text>
                                </View>
                            </View>
                            <View style={styles.routeLine} />
                            <View style={styles.routeItem}>
                                <View style={[styles.routeDot, styles.routeDotDestination]} />
                                <View style={styles.routeInfo}>
                                    <Text style={styles.routeLabel}>Arrivée</Text>
                                    <Text style={styles.routeAddress}>{orderDetails.destination.address}</Text>
                                </View>
                            </View>
                        </View>

                        {/* Informations de distance */}
                        <View style={styles.distanceInfo}>
                            <View style={styles.distanceItem}>
                                <SafeIcon name="map-pin" size={16} color="#10B981" />
                                <Text style={styles.distanceText}>{orderDetails.distance.toFixed(1)} km</Text>
                            </View>
                            {orderDetails.unpavedDistance && orderDetails.unpavedDistance > 0 && (
                                <View style={styles.distanceItem}>
                                    <SafeIcon name="alert-triangle" size={16} color="#F59E0B" />
                                    <Text style={styles.distanceText}>
                                        {orderDetails.unpavedDistance.toFixed(1)} km non goudronné
                                    </Text>
                                </View>
                            )}
                            <View style={styles.distanceItem}>
                                <SafeIcon name="clock" size={16} color="#6B7280" />
                                <Text style={styles.distanceText}>~{orderDetails.estimatedDuration} min</Text>
                            </View>
                        </View>
                    </View>

                    {/* Prix */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>\uD83D\uDCB0 Prix</Text>
                        <View style={styles.priceCard}>
                            <Text style={styles.priceLabel}>Prix convenu</Text>
                            <Text style={styles.priceValue}>{orderDetails.agreedPrice} FCFA</Text>
                        </View>
                    </View>

                    {/* Options de confort */}
                    {orderDetails.comfortOptions && orderDetails.comfortOptions.length > 0 && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>⭐ Options de confort</Text>
                            <View style={styles.optionsContainer}>
                                {orderDetails.comfortOptions.map((option, index) => (
                                    <View key={index} style={styles.optionChip}>
                                        <SafeIcon name="check" size={12} color="#10B981" />
                                        <Text style={styles.optionText}>{option}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}

                    {/* Mode de paiement */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>\uD83D\uDCB3 Mode de paiement</Text>
                        <View style={styles.paymentOptions}>
                            {orderDetails.paymentMethods.map((method, index) => (
                                <TouchableOpacity
                                    key={index}
                                    style={[
                                        styles.paymentOption,
                                        selectedPayment === method && styles.paymentOptionSelected,
                                    ]}
                                    onPress={() => setSelectedPayment(method)}
                                >
                                    <View style={[
                                        styles.radio,
                                        selectedPayment === method && styles.radioSelected,
                                    ]}>
                                        {selectedPayment === method && (
                                            <View style={styles.radioDot} />
                                        )}
                                    </View>
                                    <Text style={[
                                        styles.paymentText,
                                        selectedPayment === method && styles.paymentTextSelected,
                                    ]}>
                                        {method}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Avertissement */}
                    <View style={styles.warningBox}>
                        <SafeIcon name="info" size={16} color="#F59E0B" />
                        <Text style={styles.warningText}>
                            En confirmant, vous acceptez les conditions de service et vous engagez à payer le montant convenu.
                        </Text>
                    </View>
                </ScrollView>

                {/* Actions */}
                <View style={styles.actions}>
                    <TouchableOpacity style={styles.modifyButton} onPress={onModify}>
                        <SafeIcon name="edit" size={16} color="#F59E0B" />
                        <Text style={styles.modifyButtonText}>Modifier</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
                        <SafeIcon name="check-circle" size={20} color="#FFFFFF" />
                        <Text style={styles.confirmButtonText}>Confirmer la course</Text>
                    </TouchableOpacity>
                </View>
            </View>
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
        backgroundColor: '#FFFFFF',
        paddingTop: 50,
        paddingBottom: 15,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    closeButton: {
        marginRight: 15,
    },
    headerContent: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1F2937',
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#6B7280',
        marginTop: 2,
    },
    content: {
        flex: 1,
        padding: 20,
    },
    section: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1F2937',
        marginBottom: 12,
    },
    infoCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 15,
        gap: 12,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    infoLabel: {
        fontSize: 14,
        color: '#6B7280',
        flex: 1,
    },
    infoValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1F2937',
        flex: 2,
    },
    routeItem: {
        flexDirection: 'row',
        gap: 12,
    },
    routeDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#10B981',
        marginTop: 4,
    },
    routeDotDestination: {
        backgroundColor: '#EF4444',
    },
    routeLine: {
        width: 2,
        height: 30,
        backgroundColor: '#E5E7EB',
        marginLeft: 5,
    },
    routeInfo: {
        flex: 1,
    },
    routeLabel: {
        fontSize: 12,
        color: '#6B7280',
        marginBottom: 4,
    },
    routeAddress: {
        fontSize: 14,
        fontWeight: '500',
        color: '#1F2937',
    },
    distanceInfo: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 15,
        marginTop: 12,
        backgroundColor: '#FFFFFF',
        padding: 15,
        borderRadius: 12,
    },
    distanceItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    distanceText: {
        fontSize: 13,
        color: '#6B7280',
        fontWeight: '500',
    },
    priceCard: {
        backgroundColor: '#FEF3C7',
        borderRadius: 12,
        padding: 20,
        alignItems: 'center',
    },
    priceLabel: {
        fontSize: 14,
        color: '#92400E',
        marginBottom: 8,
    },
    priceValue: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#92400E',
    },
    optionsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    optionChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        gap: 6,
    },
    optionText: {
        fontSize: 12,
        color: '#059669',
    },
    paymentOptions: {
        gap: 10,
    },
    paymentOption: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        padding: 15,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#E5E7EB',
        gap: 12,
    },
    paymentOptionSelected: {
        borderColor: '#F59E0B',
        backgroundColor: '#FEF3C7',
    },
    radio: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: '#D1D5DB',
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioSelected: {
        borderColor: '#F59E0B',
    },
    radioDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#F59E0B',
    },
    paymentText: {
        fontSize: 14,
        color: '#6B7280',
        flex: 1,
    },
    paymentTextSelected: {
        color: '#92400E',
        fontWeight: '600',
    },
    warningBox: {
        flexDirection: 'row',
        backgroundColor: '#FEF3C7',
        padding: 15,
        borderRadius: 12,
        gap: 12,
        marginTop: 10,
    },
    warningText: {
        fontSize: 12,
        color: '#92400E',
        flex: 1,
        lineHeight: 18,
    },
    actions: {
        flexDirection: 'row',
        padding: 20,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        gap: 10,
    },
    modifyButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 15,
        paddingHorizontal: 20,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#F59E0B',
        gap: 8,
    },
    modifyButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#F59E0B',
    },
    confirmButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 15,
        borderRadius: 12,
        backgroundColor: '#10B981',
        gap: 10,
    },
    confirmButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
});

export default OrderValidationModal;

