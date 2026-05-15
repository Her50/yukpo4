// ✅ NOUVEAU: Écran de réservation pour hôtels et meublés (nuitées)
// Date: 2026-01-26

import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { NativeButton, NativeInput } from '../../components/SafeNativeDesign';
import SafeIcon from '../../components/SafeIcon';
import { SafeNativeView } from '../../components/SafeNativeView';
import { useAuth } from '../../contexts/AuthContext';
import { immobilierService } from '../../services/immobilierService';
import { modernColors } from '../../theme/modernTheme';
import { getCurrencyIntelligently } from '../../utils/currencyUtils';
import { notify } from '../../utils/notify'; // ✅ NOUVEAU 2026-01-27: Toast notifications

type RouteParams = {
    propertyId: number;
    propertyName?: string;
    propertyType?: string;
    serviceId?: number; // ✅ NOUVEAU 2026-01-26: Pour prix négociés
    conversationId?: string; // ✅ NOUVEAU 2026-01-26: Pour prix négociés
};

const HotelMeubleBookingScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
    const { user } = useAuth();
    const propertyId = route.params?.propertyId;
    const propertyName = route.params?.propertyName || 'Bien';
    const propertyType = route.params?.propertyType || 'hôtel';
    const serviceId = route.params?.serviceId;
    const conversationId = route.params?.conversationId;

    const [dateArrivee, setDateArrivee] = useState('');
    const [dateDepart, setDateDepart] = useState('');
    const [reservationType, setReservationType] = useState<'nightly' | 'hourly'>('nightly');
    const [heureArrivee, setHeureArrivee] = useState('');
    const [heureDepart, setHeureDepart] = useState('');
    const [nombreAdultes, setNombreAdultes] = useState('1');
    const [nombreEnfants, setNombreEnfants] = useState('0');
    const [nombreChambres, setNombreChambres] = useState('1');
    const [nomClient, setNomClient] = useState(user?.name || '');
    const [telephoneClient, setTelephoneClient] = useState(user?.phone || '');
    const [emailClient, setEmailClient] = useState(user?.email || '');
    const [notes, setNotes] = useState('');

    const [priceInfo, setPriceInfo] = useState<{
        reservation_type: string;
        nombre_nuitees: number;
        nombre_heures?: number;
        prix_nuitee?: number;
        prix_heure?: number;
        prix_total: number;
        frais_service: number;
        montant_total: number;
        is_available: boolean;
    } | null>(null);
    const [loading, setLoading] = useState(false);
    const [calculating, setCalculating] = useState(false);
    const [devise, setDevise] = useState('FCFA');

    // Calculer le prix quand les dates changent
    useEffect(() => {
        if (dateArrivee && dateDepart && propertyId) {
            calculatePrice();
        } else {
            setPriceInfo(null);
        }
    }, [dateArrivee, dateDepart, nombreChambres, propertyId]);

    const calculatePrice = async () => {
        if (!dateArrivee || !dateDepart || !propertyId) return;
        if (reservationType === 'hourly' && (!heureArrivee || !heureDepart)) return;

        try {
            setCalculating(true);
            const response = await immobilierService.calculateBookingPrice(
                propertyId,
                dateArrivee,
                dateDepart,
                parseInt(nombreAdultes) || 1,
                parseInt(nombreEnfants) || 0,
                parseInt(nombreChambres) || 1,
                conversationId, // ✅ NOUVEAU: Pour prix négociés
                user?.id ? parseInt(user.id) : undefined, // ✅ NOUVEAU: Pour prix négociés
                reservationType, // ✅ NOUVEAU 2026-01-26: Type de réservation
                reservationType === 'hourly' ? heureArrivee : undefined, // ✅ NOUVEAU 2026-01-26: Heure arrivée
                reservationType === 'hourly' ? heureDepart : undefined, // ✅ NOUVEAU 2026-01-26: Heure départ
            );

            if (response.success && response.data) {
                setPriceInfo({
                    reservation_type: response.data.reservation_type,
                    nombre_nuitees: response.data.nombre_nuitees,
                    nombre_heures: response.data.nombre_heures,
                    prix_nuitee: response.data.prix_nuitee,
                    prix_heure: response.data.prix_heure,
                    prix_total: response.data.prix_total,
                    frais_service: response.data.frais_service,
                    montant_total: response.data.montant_total,
                    is_available: response.data.is_available,
                });

                if (!response.data.is_available) {
                    notify.warning('Le bien n\'est pas disponible pour ces dates/heures');
                }
            }
        } catch (err: any) {
            console.error('[HotelMeubleBookingScreen] Erreur calcul prix:', err);
            notify.error(err.message || 'Erreur lors du calcul du prix');
        } finally {
            setCalculating(false);
        }
    };

    const handleSubmit = async () => {
        if (!dateArrivee || !dateDepart) {
            notify.error('Veuillez sélectionner les dates d\'arrivée et de départ');
            return;
        }

        if (reservationType === 'hourly' && (!heureArrivee || !heureDepart)) {
            notify.error('Veuillez renseigner l\'heure d\'arrivée et l\'heure de départ');
            return;
        }

        if (!priceInfo || !priceInfo.is_available) {
            notify.error('Le bien n\'est pas disponible pour ces dates/heures');
            return;
        }

        if (!nomClient.trim()) {
            notify.error('Veuillez renseigner votre nom');
            return;
        }

        if (!propertyId) {
            notify.error('Identifiant du bien manquant');
            return;
        }

        try {
            setLoading(true);
            const response = await immobilierService.createHotelBooking(
                propertyId,
                dateArrivee,
                dateDepart,
                parseInt(nombreAdultes) || 1,
                parseInt(nombreEnfants) || 0,
                parseInt(nombreChambres) || 1,
                nomClient,
                telephoneClient,
                emailClient,
                notes,
                conversationId, // ✅ NOUVEAU: Pour prix négociés
                user?.id ? parseInt(user.id) : undefined, // ✅ NOUVEAU: Pour prix négociés
                reservationType, // ✅ NOUVEAU 2026-01-26: Type de réservation
                reservationType === 'hourly' ? heureArrivee : undefined, // ✅ NOUVEAU 2026-01-26: Heure arrivée
                reservationType === 'hourly' ? heureDepart : undefined, // ✅ NOUVEAU 2026-01-26: Heure départ
            );

            if (response.success && response.data) {
                // Naviguer vers l'écran de paiement
                (navigation as any).navigate('HotelBookingPayment', {
                    reservationId: response.data.id,
                    montantTotal: response.data.montant_total,
                    propertyName: propertyName,
                });
            } else {
                notify.error('Impossible de créer la réservation');
            }
        } catch (err: any) {
            console.error('[HotelMeubleBookingScreen] Erreur:', err);
            notify.error(err.message || 'Erreur lors de la réservation');
        } finally {
            setLoading(false);
        }
    };

    const formatPrice = (price: number) => {
        return `${(price / 1000).toFixed(0)}K ${devise}`;
    };

    return (
        <SafeNativeView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <SafeIcon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <View style={styles.headerContent}>
                    <Text style={styles.title}>Réservation {propertyType}</Text>
                    <Text style={styles.subtitle}>{propertyName}</Text>
                </View>
                <View style={styles.headerSpacer} />
            </View>

            <ScrollView 
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Dates */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>📅 Dates de séjour</Text>
                    
                    <View style={styles.dateRow}>
                        <View style={styles.dateInput}>
                            <Text style={styles.label}>Date d'arrivée *</Text>
                            <NativeInput
                                placeholder="YYYY-MM-DD"
                                value={dateArrivee}
                                onChangeText={setDateArrivee}
                                style={styles.input}
                            />
                        </View>
                        <View style={styles.dateInput}>
                            <Text style={styles.label}>Date de départ *</Text>
                            <NativeInput
                                placeholder="YYYY-MM-DD"
                                value={dateDepart}
                                onChangeText={setDateDepart}
                                style={styles.input}
                            />
                        </View>
                    </View>

                    {calculating && (
                        <Text style={styles.calculatingText}>Calcul du prix...</Text>
                    )}

                    {priceInfo && (
                        <View style={styles.pricePreview}>
                            <Text style={styles.pricePreviewText}>
                                {priceInfo.reservation_type === 'hourly' 
                                    ? `${priceInfo.nombre_heures || 0} heure${(priceInfo.nombre_heures || 0) > 1 ? 's' : ''}`
                                    : `${priceInfo.nombre_nuitees} nuitée${priceInfo.nombre_nuitees > 1 ? 's' : ''}`
                                }
                            </Text>
                            {!priceInfo.is_available && (
                                <Text style={styles.unavailableText}>⚠️ Indisponible</Text>
                            )}
                        </View>
                    )}
                </View>

                {/* Occupants */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>👥 Occupants</Text>
                    
                    <View style={styles.row}>
                        <View style={styles.halfWidth}>
                            <Text style={styles.label}>Adultes *</Text>
                            <NativeInput
                                placeholder="1"
                                value={nombreAdultes}
                                onChangeText={setNombreAdultes}
                                keyboardType="numeric"
                                style={styles.input}
                            />
                        </View>
                        <View style={styles.halfWidth}>
                            <Text style={styles.label}>Enfants</Text>
                            <NativeInput
                                placeholder="0"
                                value={nombreEnfants}
                                onChangeText={setNombreEnfants}
                                keyboardType="numeric"
                                style={styles.input}
                            />
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Nombre de chambres *</Text>
                        <NativeInput
                            placeholder="1"
                            value={nombreChambres}
                            onChangeText={setNombreChambres}
                            keyboardType="numeric"
                            style={styles.input}
                        />
                    </View>
                </View>

                {/* Informations client */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>📋 Informations de contact</Text>
                    
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Nom complet *</Text>
                        <NativeInput
                            placeholder="Votre nom"
                            value={nomClient}
                            onChangeText={setNomClient}
                            style={styles.input}
                        />
                    </View>

                    <View style={styles.row}>
                        <View style={styles.halfWidth}>
                            <Text style={styles.label}>Téléphone</Text>
                            <NativeInput
                                placeholder="+XXX XX XX XX XX"
                                value={telephoneClient}
                                onChangeText={setTelephoneClient}
                                keyboardType="phone-pad"
                                style={styles.input}
                            />
                        </View>
                        <View style={styles.halfWidth}>
                            <Text style={styles.label}>Email</Text>
                            <NativeInput
                                placeholder="email@example.com"
                                value={emailClient}
                                onChangeText={setEmailClient}
                                keyboardType="email-address"
                                style={styles.input}
                            />
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Notes spéciales (optionnel)</Text>
                        <NativeInput
                            placeholder="Demandes particulières..."
                            value={notes}
                            onChangeText={setNotes}
                            multiline
                            numberOfLines={3}
                            style={[styles.input, styles.textArea]}
                        />
                    </View>
                </View>

                {/* Résumé prix */}
                {priceInfo && priceInfo.is_available && (
                    <View style={styles.priceSection}>
                        <Text style={styles.sectionTitle}>💰 Résumé du prix</Text>
                        
                        {priceInfo.reservation_type === 'hourly' ? (
                            <View style={styles.priceRow}>
                                <Text style={styles.priceLabel}>Prix par heure</Text>
                                <Text style={styles.priceValue}>
                                    {formatPrice(priceInfo.prix_heure || 0)} × {priceInfo.nombre_heures || 0} heure{(priceInfo.nombre_heures || 0) > 1 ? 's' : ''}
                                </Text>
                            </View>
                        ) : (
                            <View style={styles.priceRow}>
                                <Text style={styles.priceLabel}>Prix par nuitée</Text>
                                <Text style={styles.priceValue}>
                                    {formatPrice(priceInfo.prix_nuitee || 0)} × {priceInfo.nombre_nuitees} nuitée{priceInfo.nombre_nuitees > 1 ? 's' : ''}
                                </Text>
                            </View>
                        )}

                        <View style={styles.priceRow}>
                            <Text style={styles.priceLabel}>Sous-total</Text>
                            <Text style={styles.priceValue}>{formatPrice(priceInfo.prix_total)}</Text>
                        </View>

                        <View style={styles.priceRow}>
                            <Text style={styles.priceLabel}>Frais de service</Text>
                            <Text style={styles.priceValue}>{formatPrice(priceInfo.frais_service)}</Text>
                        </View>

                        <View style={[styles.priceRow, styles.priceTotal]}>
                            <Text style={styles.priceTotalLabel}>Total</Text>
                            <Text style={styles.priceTotalValue}>
                                {formatPrice(priceInfo.montant_total)}
                            </Text>
                        </View>
                    </View>
                )}

                {/* Bouton réservation */}
                <NativeButton
                    title={loading ? 'Création en cours...' : 'Créer la réservation'}
                    onPress={handleSubmit}
                    disabled={loading || !priceInfo || !priceInfo.is_available}
                    variant="primary"
                    size="large"
                    style={styles.submitButton}
                />
            </ScrollView>
        </SafeNativeView>
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
        padding: 16,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: {
        padding: 8,
    },
    headerContent: {
        flex: 1,
        marginLeft: 8,
    },
    title: {
        fontSize: 20,
        fontWeight: '600',
        color: '#111827',
    },
    subtitle: {
        fontSize: 14,
        color: '#6B7280',
        marginTop: 2,
    },
    headerSpacer: {
        width: 40,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
    },
    section: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        ...modernColors.shadowLight,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 16,
    },
    dateRow: {
        flexDirection: 'row',
        gap: 12,
    },
    dateInput: {
        flex: 1,
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        color: '#374151',
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
    },
    textArea: {
        minHeight: 80,
        textAlignVertical: 'top',
    },
    calculatingText: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 8,
        fontStyle: 'italic',
    },
    pricePreview: {
        marginTop: 12,
        padding: 12,
        backgroundColor: '#EFF6FF',
        borderRadius: 8,
    },
    pricePreviewText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1E40AF',
    },
    unavailableText: {
        fontSize: 12,
        color: '#EF4444',
        marginTop: 4,
    },
    row: {
        flexDirection: 'row',
        gap: 12,
    },
    halfWidth: {
        flex: 1,
    },
    inputGroup: {
        marginBottom: 16,
    },
    priceSection: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        ...modernColors.shadowLight,
    },
    priceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    priceLabel: {
        fontSize: 14,
        color: '#6B7280',
    },
    priceValue: {
        fontSize: 14,
        fontWeight: '500',
        color: '#111827',
    },
    priceTotal: {
        borderTopWidth: 2,
        borderTopColor: '#E5E7EB',
        borderBottomWidth: 0,
        marginTop: 8,
        paddingTop: 12,
    },
    priceTotalLabel: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    priceTotalValue: {
        fontSize: 20,
        fontWeight: '700',
        color: modernColors.primary,
    },
    submitButton: {
        marginTop: 8,
        marginBottom: 32,
    },
});

export default HotelMeubleBookingScreen;

