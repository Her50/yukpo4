// ✅ Écran de réservation de visite
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeButton, NativeInput } from '../../components/SafeNativeDesign';
import SafeIcon from '../../components/SafeIcon';
import { immobilierService } from '../../services/immobilierService';
import { modernColors } from '../../theme/modernTheme';
import { useLanguageSafe } from '../../contexts/LanguageContext';

type RouteParams = {
    propertyId: number;
    propertyName?: string;
};

const ImmobilierBookingScreen: React.FC = () => {
    const navigation = useNavigation();
    const { t } = useLanguageSafe();
    const route = useRoute() as any;
    const propertyId = route.params?.propertyId;
    const propertyName = route.params?.propertyName || t('immobilierBooking.bienImmobilier');

    const [dateVisite, setDateVisite] = useState('');
    const [heureVisite, setHeureVisite] = useState('');
    const [typeVisite, setTypeVisite] = useState('Physique');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (!dateVisite.trim() || !heureVisite.trim()) {
            Alert.alert('Erreur', 'Veuillez renseigner la date et l\'heure de visite');
            return;
        }

        if (!propertyId) {
            Alert.alert('Erreur', 'Identifiant du bien manquant');
            return;
        }

        try {
            setLoading(true);
            const response = await immobilierService.bookVisit(
                propertyId,
                dateVisite,
                heureVisite,
                typeVisite
            );

            if (response.success) {
                Alert.alert(
                    t('immobilierBookingScreen.succes'),
                    t('immobilierBookingScreen.votreDemandeDeVisiteAEte'),
                    [
                        {
                            text: 'OK',
                            onPress: () => navigation.goBack(),
                        },
                    ]
                );
            } else {
                Alert.alert('Erreur', t('immobilierBookingScreen.impossibleDeReserverLaVisite'));
            }
        } catch (err: any) {
            console.error('[ImmobilierBookingScreen] Erreur:', err);
            Alert.alert('Erreur', err.message || t('immobilierBookingScreen.erreurLorsDeLaReservation'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
                <Text style={styles.title}>{t('immobilierBooking.reserverUneVisite')}</Text>
                <Text style={styles.subtitle}>{propertyName}</Text>
            </View>

            <View style={styles.content}>
                {/* Type de visite */}
                <View style={styles.section}>
                    <Text style={styles.label}>{t('immobilierBooking.typeDeVisite')}</Text>
                    <View style={styles.typeContainer}>
                        {['Physique', 'Virtuelle'].map((type) => (
                            <View
                                key={type}
                                style={[
                                    styles.typeButton,
                                    typeVisite === type && styles.typeButtonActive,
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.typeButtonText,
                                        typeVisite === type && styles.typeButtonTextActive,
                                    ]}
                                    onPress={() => setTypeVisite(type)}
                                >
                                    {type}
                                </Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Date */}
                <View style={styles.section}>
                    <Text style={styles.label}>{t('immobilierBooking.dateDeVisite')}</Text>
                    <NativeInput
                        placeholder="YYYY-MM-DD (ex: 2025-02-15)"
                        value={dateVisite}
                        onChangeText={setDateVisite}
                        style={styles.input}
                    />
                    <Text style={styles.hint}>
                        Format: AAAA-MM-JJ
                    </Text>
                </View>

                {/* Heure */}
                <View style={styles.section}>
                    <Text style={styles.label}>{t('immobilierBooking.heureDeVisite')}</Text>
                    <NativeInput
                        placeholder="HH:MM (ex: 14:30)"
                        value={heureVisite}
                        onChangeText={setHeureVisite}
                        style={styles.input}
                    />
                    <Text style={styles.hint}>
                        Format: HH:MM (24h)
                    </Text>
                </View>

                {/* Informations */}
                <View style={styles.infoBox}>
                    <SafeIcon name="info" size={20} color={modernColors.primary} />
                    <Text style={styles.infoText}>
                        Votre demande sera transmise au propriétaire. Vous recevrez une confirmation par notification.
                    </Text>
                </View>

                <NativeButton
                    title={t('immobilierBooking.confirmerLaReservation')}
                    onPress={handleSubmit}
                    style={styles.submitButton}
                    loading={loading}
                />
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 16,
        color: '#6B7280',
    },
    content: {
        padding: 16,
    },
    section: {
        marginBottom: 24,
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 8,
    },
    typeContainer: {
        flexDirection: 'row',
        gap: 12,
    },
    typeButton: {
        flex: 1,
        padding: 16,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
    },
    typeButtonActive: {
        backgroundColor: modernColors.primary,
    },
    typeButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#6B7280',
    },
    typeButtonTextActive: {
        color: '#fff',
    },
    input: {
        marginBottom: 4,
    },
    hint: {
        fontSize: 12,
        color: '#9CA3AF',
        marginTop: 4,
    },
    infoBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: 16,
        backgroundColor: '#EFF6FF',
        borderRadius: 8,
        marginBottom: 24,
        gap: 12,
    },
    infoText: {
        flex: 1,
        fontSize: 14,
        color: '#1E40AF',
        lineHeight: 20,
    },
    submitButton: {
        marginBottom: 32,
    },
});

export default ImmobilierBookingScreen;

