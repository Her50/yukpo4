import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { NativeButton, NativeCard } from '../../components/SafeNativeDesign';
import { SafeNativeView } from '../../components/SafeNativeView';
import useMyGlobalPromos from '../../hooks/useMyGlobalPromos';
import { modernColors } from '../../theme/modernTheme';
import { useLanguageSafe } from '../../contexts/LanguageContext';

const GlobalPromoSubmissionScreen: React.FC = () => {
    const { events, entries, selectedEventId, setSelectedEventId, loading, submitting, submit } =
        useMyGlobalPromos();
        const { t } = useLanguageSafe();
const [form, setForm] = useState({
        serviceId: '',
        promoPriceCfa: '',
        discountPercentage: '',
        stockCap: '',
        note: '',
    });

    const selectedEvent = useMemo(
        () => events.find((event) => event.id === selectedEventId),
        [events, selectedEventId],
    );

    const handleSubmit = async () => {
        if (!selectedEventId) {
            Alert.alert('Campagne requise', 'Sélectionnez une campagne Black Friday.');
            return;
        }
        if (!form.serviceId) {
            Alert.alert('Service requis', 'Indiquez l’identifiant de votre service.');
            return;
        }

        await submit({
            serviceId: Number(form.serviceId),
            promoPriceCfa: form.promoPriceCfa ? Number(form.promoPriceCfa) : undefined,
            discountPercentage: form.discountPercentage ? Number(form.discountPercentage) : undefined,
            stockCap: form.stockCap ? Number(form.stockCap) : undefined,
            metadata: {
                note: form.note,
            },
        });
        setForm({
            serviceId: '',
            promoPriceCfa: '',
            discountPercentage: '',
            stockCap: '',
            note: '',
        });
    };

    return (
        <SafeNativeView style={styles.container}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.header}>
                    <Text style={styles.kicker}>Campagne officielle Yukpo</Text>
                    <Text style={styles.title}>🔥 Black Friday collectif</Text>
                    <Text style={styles.subtitle}>
                        Sélectionnez la campagne ouverte puis renseignez l’identifiant de votre service pour qu’il
                        soit ajouté à la promo globale.
                    </Text>
                </View>

                <NativeCard style={styles.card}>
                    <Text style={styles.sectionTitle}>{t('globalPromoSubmission.1ChoisirLaCampagne')}</Text>
                    <View style={styles.eventList}>
                        {events.map((event) => (
                            <NativeButton
                                key={event.id}
                                label={`${event.displayName} (${new Date(event.startsAt).toLocaleDateString('fr-FR')})`}
                                onPress={() => setSelectedEventId(event.id)}
                                variant={selectedEventId === event.id ? 'primary' : 'outline'}
                                style={styles.eventButton}
                            />
                        ))}
                        {!events.length && !loading && (
                            <Text style={styles.emptyText}>{t('globalPromoSubmission.aucuneCampagneOuverteActuellement')}</Text>
                        )}
                    </View>
                </NativeCard>

                {selectedEvent && (
                    <NativeCard style={styles.card}>
                        <Text style={styles.sectionTitle}>2. Renseigner votre service</Text>

                        <View style={styles.field}>
                            <Text style={styles.label}>ID du service</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Ex: 2458"
                                keyboardType="numeric"
                                value={form.serviceId}
                                onChangeText={(value) => setForm((prev) => ({ ...prev, serviceId: value }))}
                            />
                            <Text style={styles.helper}>
                                Retrouvez l’ID dans vos fiches services Yukpo (liste Mes Services).
                            </Text>
                        </View>

                        <View style={styles.row}>
                            <View style={styles.rowItem}>
                                <Text style={styles.label}>Prix promo</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Ex: 15000"
                                    keyboardType="numeric"
                                    value={form.promoPriceCfa}
                                    onChangeText={(value) => setForm((prev) => ({ ...prev, promoPriceCfa: value }))}
                                />
                            </View>
                            <View style={styles.rowItem}>
                                <Text style={styles.label}>{t('globalPromoSubmission.reduction')}</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Ex: 20"
                                    keyboardType="numeric"
                                    value={form.discountPercentage}
                                    onChangeText={(value) =>
                                        setForm((prev) => ({ ...prev, discountPercentage: value }))
                                    }
                                />
                            </View>
                        </View>

                        <View style={styles.field}>
                            <Text style={styles.label}>{t('globalPromoSubmission.stockPromoOptionnel')}</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Ex: 25"
                                keyboardType="numeric"
                                value={form.stockCap}
                                onChangeText={(value) => setForm((prev) => ({ ...prev, stockCap: value }))}
                            />
                        </View>

                        <View style={styles.field}>
                            <Text style={styles.label}>{t('globalPromoSubmission.notePourLequipeYukpo')}</Text>
                            <TextInput
                                style={[styles.input, styles.textarea]}
                                placeholder={t('globalPromoSubmission.exLivePrevuSamedi18h')}
                                multiline
                                numberOfLines={4}
                                value={form.note}
                                onChangeText={(value) => setForm((prev) => ({ ...prev, note: value }))}
                            />
                        </View>

                        <NativeButton
                            label={submitting ? 'Envoi...' : 'Envoyer ma promotion'}
                            onPress={handleSubmit}
                            disabled={!form.serviceId || submitting}
                        />
                    </NativeCard>
                )}

                <NativeCard style={styles.card}>
                    <Text style={styles.sectionTitle}>{t('globalPromoSubmission.mesDemandes')}</Text>
                    {entries.slice(0, 5).map((entry) => (
                        <View key={entry.id} style={styles.entryRow}>
                            <Text style={styles.entryService}>Service #{entry.serviceId}</Text>
                            <Text style={styles.entryStatus}>{entry.status}</Text>
                        </View>
                    ))}
                    {!entries.length && <Text style={styles.emptyText}>{t('globalPromoSubmission.aucuneDemandeEnvoyeePourLinstant')}</Text>}
                </NativeCard>
            </ScrollView>
        </SafeNativeView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: modernColors.background,
    },
    content: {
        padding: 16,
        gap: 16,
    },
    header: {
        backgroundColor: '#1E1B4B',
        borderRadius: 24,
        padding: 20,
        gap: 6,
    },
    kicker: {
        color: '#C7D2FE',
        fontSize: 12,
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    title: {
        color: '#fff',
        fontSize: 24,
        fontWeight: '700',
    },
    subtitle: {
        color: '#E0E7FF',
        fontSize: 13,
    },
    card: {
        backgroundColor: '#fff',
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 12,
    },
    eventList: {
        gap: 8,
    },
    eventButton: {
        width: '100%',
    },
    field: {
        marginBottom: 12,
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.text,
    },
    input: {
        marginTop: 6,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 14,
        color: modernColors.text,
        backgroundColor: '#F9FAFB',
    },
    textarea: {
        minHeight: 100,
        textAlignVertical: 'top',
    },
    helper: {
        marginTop: 4,
        fontSize: 12,
        color: '#94A3B8',
    },
    row: {
        flexDirection: 'row',
        gap: 12,
    },
    rowItem: {
        flex: 1,
    },
    entryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    entryService: {
        fontWeight: '600',
        color: modernColors.text,
    },
    entryStatus: {
        fontSize: 12,
        color: '#475569',
    },
    emptyText: {
        fontSize: 13,
        color: '#94A3B8',
        marginTop: 8,
    },
});

export default GlobalPromoSubmissionScreen;

