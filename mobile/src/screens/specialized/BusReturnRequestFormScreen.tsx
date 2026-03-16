// Écran pour créer une demande de retour après achat d'un ticket aller
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { ConfirmationSection } from '../../components/FormConfirmationModal';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton, NativeInput } from '../../components/SafeNativeDesign';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { useFormValidation } from '../../hooks/useFormValidation';
import { apiPost } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';

const BusReturnRequestFormScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();
    const { t } = useLanguageSafe();

    const outboundPaymentId = (route.params as any)?.outboundPaymentId;
    const outboundTicket = (route.params as any)?.outboundTicket;

    const [returnDate, setReturnDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [returnTime, setReturnTime] = useState('');
    const [flexibilityDays, setFlexibilityDays] = useState(1);
    const [numberOfSeats, setNumberOfSeats] = useState(1);
    const [passengerNames, setPassengerNames] = useState<string[]>(['']);
    const [loading, setLoading] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);

    const { errors, validateForm } = useFormValidation({
        passengerNames: {
            custom: (value) => {
                if (!value || (Array.isArray(value) && value.every((n: string) => !n.trim()))) {
                    return 'Au moins un nom de passager requis';
                }
                return null;
            }
        },
    });

    const formatDate = (date: Date) => {
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    const confirmationSections: ConfirmationSection[] = [
        {
            title: t('busReturnRequestForm.retour'),
            icon: 'calendar',
            fields: [
                { label: t('busReturnRequestFormScreen.dateRetour'), value: formatDate(returnDate) },
                { label: 'Heure', value: returnTime || t('busReturnRequestForm.nonSpecifiee') },
                { label: t('busReturnRequestForm.flexibilite'), value: `± ${flexibilityDays} jour(s)` },
            ],
        },
        {
            title: 'Passagers',
            icon: 'users',
            fields: [
                { label: t('busReturnRequestForm.nombreDePlaces'), value: String(numberOfSeats), type: 'number' as const },
                { label: 'Passagers', value: passengerNames.filter(n => n.trim()).join(', ') },
            ],
        },
    ];

    const handleSubmit = () => {
        if (!outboundPaymentId) {
            Alert.alert(t('message.error'), t('busReturn.missingOutboundTicket'));
            return;
        }
        if (passengerNames.length === 0 || passengerNames.every((name) => !name.trim())) {
            Alert.alert(t('message.error'), t('busReturn.enterPassengerName'));
            return;
        }
        setShowConfirmation(true);
    };

    const handleFinalSubmit = async () => {
        if (!outboundPaymentId) {
            Alert.alert(t('message.error'), t('busReturn.missingOutboundTicket'));
            return;
        }

        if (passengerNames.length === 0 || passengerNames.every((name) => !name.trim())) {
            Alert.alert(t('message.error'), t('busReturn.enterPassengerName'));
            return;
        }

        try {
            setLoading(true);

            const payload = {
                outbound_payment_id: outboundPaymentId,
                preferred_return_date: formatDate(returnDate),
                preferred_return_time: returnTime.trim() || null,
                date_flexibility_days: flexibilityDays,
                passenger_names: passengerNames.filter((name) => name.trim()),
                number_of_seats: numberOfSeats,
                already_paid: false,
            };

            const response = await apiPost('/api/bus-tickets/return-request', payload);
            const resData = (response?.data || response) as any;

            if (resData.success) {
                Alert.alert(
                    t('busReturn.requestCreated'),
                    t('busReturn.requestCreatedMsg'),
                    [
                        {
                            text: 'OK',
                            onPress: () => navigation.goBack(),
                        },
                    ]
                );
            } else {
                Alert.alert(t('message.error'), (response as any).error || t('busReturn.cannotCreateRequest'));
            }
        } catch (error: any) {
            console.error('[BusReturnRequestFormScreen] Erreur:', error);
            Alert.alert(t('message.error'), error.message || t('busReturn.cannotCreateRequest'));
        } finally {
            setLoading(false);
            setShowConfirmation(false);
        }
    };

    const addPassenger = () => {
        setPassengerNames([...passengerNames, '']);
    };

    const updatePassengerName = (index: number, name: string) => {
        const updated = [...passengerNames];
        updated[index] = name;
        setPassengerNames(updated);
    };

    const removePassenger = (index: number) => {
        if (passengerNames.length > 1) {
            setPassengerNames(passengerNames.filter((_, i) => i !== index));
        }
    };

    if (!outboundPaymentId) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <SafeIcon name="arrow-left" size={24} color="#111827" />
                    </TouchableOpacity>
                    <Text style={styles.title}>{t('busReturnRequestForm.demandeDeRetour')}/Text>
                </View>
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{t('busReturnRequestForm.informationsDeTicketManquantes')}/Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <SafeIcon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.title}>{t('busReturnRequestForm.creerUneDemandeDeRetour')}</Text>
            </View>

            <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                {outboundTicket && (
                    <View style={styles.ticketInfoCard}>
                        <Text style={styles.cardTitle}>{t('busReturnRequestForm.ticketAller')}/Text>
                        <Text style={styles.ticketRoute}>
                            {outboundTicket.departure_city} → {outboundTicket.arrival_city}
                        </Text>
                        <Text style={styles.ticketDate}>
                            {outboundTicket.departure_date} à {outboundTicket.departure_time}
                        </Text>
                    </View>
                )}

                <View style={styles.form}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>{t('busReturnRequestForm.dateDeRetourSouhaitee')}</Text>
                        <TouchableOpacity
                            style={styles.dateButton}
                            onPress={() => setShowDatePicker(true)}
                        >
                            <SafeIcon name="calendar" size={20} color={modernColors.primary} />
                            <Text style={styles.dateButtonText}>{formatDate(returnDate)}</Text>
                        </TouchableOpacity>
                    </View>

                    {showDatePicker && (
                        <DateTimePicker
                            value={returnDate}
                            mode="date"
                            display="default"
                            minimumDate={new Date()}
                            onChange={(event, selectedDate) => {
                                setShowDatePicker(false);
                                if (selectedDate) {
                                    setReturnDate(selectedDate);
                                }
                            }}
                        />
                    )}

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>{t('busReturnRequestForm.heureDeRetourOptionnel')}</Text>
                        <NativeInput
                            value={returnTime}
                            onChangeText={setReturnTime}
                            placeholder="HH:MM (ex: 14:30)"
                            keyboardType="default"
                        />
                        <Text style={styles.helpText}>
                            Laissez vide si vous êtes flexible sur l'heure
                        </Text>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>{t('busReturnRequestForm.flexibiliteSurLaDate')}</Text>
                        <View style={styles.flexibilityRow}>
                            <TouchableOpacity
                                style={[
                                    styles.flexibilityButton,
                                    flexibilityDays === 0 && styles.flexibilityButtonActive,
                                ]}
                                onPress={() => setFlexibilityDays(0)}
                            >
                                <Text
                                    style={[
                                        styles.flexibilityButtonText,
                                        flexibilityDays === 0 && styles.flexibilityButtonTextActive,
                                    ]}
                                >
                                    Exact
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.flexibilityButton,
                                    flexibilityDays === 1 && styles.flexibilityButtonActive,
                                ]}
                                onPress={() => setFlexibilityDays(1)}
                            >
                                <Text
                                    style={[
                                        styles.flexibilityButtonText,
                                        flexibilityDays === 1 && styles.flexibilityButtonTextActive,
                                    ]}
                                >
                                    ± 1 jour
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.flexibilityButton,
                                    flexibilityDays === 2 && styles.flexibilityButtonActive,
                                ]}
                                onPress={() => setFlexibilityDays(2)}
                            >
                                <Text
                                    style={[
                                        styles.flexibilityButtonText,
                                        flexibilityDays === 2 && styles.flexibilityButtonTextActive,
                                    ]}
                                >
                                    ± 2 jours
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>{t('busReturnRequestForm.nombreDePlaces')}</Text>
                        <View style={styles.seatsRow}>
                            <TouchableOpacity
                                style={styles.seatsButton}
                                onPress={() => numberOfSeats > 1 && setNumberOfSeats(numberOfSeats - 1)}
                                disabled={numberOfSeats === 1}
                            >
                                <SafeIcon
                                    name="minus"
                                    size={20}
                                    color={numberOfSeats === 1 ? '#9CA3AF' : '#111827'}
                                />
                            </TouchableOpacity>
                            <Text style={styles.seatsValue}>{numberOfSeats}</Text>
                            <TouchableOpacity
                                style={styles.seatsButton}
                                onPress={() => setNumberOfSeats(numberOfSeats + 1)}
                            >
                                <SafeIcon name="plus" size={20} color="#111827" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <View style={styles.labelRow}>
                            <Text style={styles.label}>Noms des passagers *</Text>
                            <TouchableOpacity onPress={addPassenger}>
                                <SafeIcon name="plus-circle" size={24} color={modernColors.primary} />
                            </TouchableOpacity>
                        </View>
                        {passengerNames.map((name, index) => (
                            <View key={index} style={styles.passengerRow}>
                                <NativeInput
                                    value={name}
                                    onChangeText={(text) => updatePassengerName(index, text)}
                                    placeholder={`Passager ${index + 1}`}
                                    style={styles.passengerInput}
                                />
                                {passengerNames.length > 1 && (
                                    <TouchableOpacity
                                        onPress={() => removePassenger(index)}
                                        style={styles.removeButton}
                                    >
                                        <SafeIcon name="trash-2" size={20} color="#EF4444" />
                                    </TouchableOpacity>
                                )}
                            </View>
                        ))}
                    </View>

                    <NativeButton
                        title={loading ? t('busReturnRequestFormScreen.creationEnCours') : t('busReturnRequestFormScreen.creerLaDemande')}
                        onPress={handleSubmit}
                        disabled={loading}
                        variant="primary"
                        size="large"
                        style={styles.submitButton}
                    />
                </View>
            </ScrollView>
        </View>
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
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: {
        marginRight: 12,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: 16,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorText: {
        fontSize: 16,
        color: '#EF4444',
    },
    ticketInfoCard: {
        backgroundColor: '#EFF6FF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#DBEAFE',
    },
    cardTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1E40AF',
        marginBottom: 8,
    },
    ticketRoute: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
    },
    ticketDate: {
        fontSize: 14,
        color: '#6B7280',
    },
    form: {
        gap: 16,
    },
    inputGroup: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 8,
    },
    labelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    dateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#fff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    dateButtonText: {
        marginLeft: 8,
        fontSize: 16,
        color: '#111827',
    },
    helpText: {
        marginTop: 4,
        fontSize: 12,
        color: '#6B7280',
    },
    flexibilityRow: {
        flexDirection: 'row',
        gap: 8,
    },
    flexibilityButton: {
        flex: 1,
        padding: 12,
        backgroundColor: '#fff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        alignItems: 'center',
    },
    flexibilityButtonActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    flexibilityButtonText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#111827',
    },
    flexibilityButtonTextActive: {
        color: '#fff',
    },
    seatsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    seatsButton: {
        width: 40,
        height: 40,
        borderRadius: 8,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        justifyContent: 'center',
        alignItems: 'center',
    },
    seatsValue: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
        minWidth: 40,
        textAlign: 'center',
    },
    passengerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    passengerInput: {
        flex: 1,
    },
    removeButton: {
        padding: 8,
    },
    submitButton: {
        marginTop: 8,
    },
});

export default BusReturnRequestFormScreen;

