import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { SafeNativeView } from '../../components/SafeNativeView';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import useGlobalPromos from '../../hooks/useGlobalPromos';
import { modernColors } from '../../theme/modernTheme';
import type { GlobalPromoEntry } from '../../types/GlobalPromo';

const formatDateTimeLocal = (value: Date) => {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    const hours = String(value.getHours()).padStart(2, '0');
    const minutes = String(value.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const slugify = (value: string) =>
    value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60);

const availabilityOptions = [
    { value: 'online', label: t('globalPromoManager.catalogueEnLigne') },
    { value: 'live', label: t('globalPromoManager.ventesLiveUniquement') },
    { value: 'both', label: t('globalPromoManager.catalogueLive') },
];

const GlobalPromoManagerScreen: React.FC = () => {
    const { t } = useLanguageSafe();
    const {
        events,
        entries,
        selectedEvent,
        loadingEvents,
        loadingEntries,
        error,
        selectEvent,
        refreshEvents,
        createEvent,
        upsertEntry,
        reviewEntry,
        reviewEntriesBulk,
    } = useGlobalPromos();

    const [eventForm, setEventForm] = useState({
        displayName: 'Black Friday national',
        theme: 'black_friday',
        slug: '',
        description: '',
        startsAt: formatDateTimeLocal(new Date()),
        endsAt: formatDateTimeLocal(new Date(Date.now() + 2 * 60 * 60 * 1000)),
        recurrenceRule: '',
        highlightColor: '#6366F1',
        bannerText: 'Promotions exceptionnelles visibles par tous',
    });

    const [entryForm, setEntryForm] = useState({
        serviceId: '',
        discountPercentage: '',
        promoPriceCfa: '',
        stockCap: '',
        availability: 'online',
        metadata: '',
        highlighted: true,
        priorityScore: 10,
    });

    const [submittingEvent, setSubmittingEvent] = useState(false);
    const [submittingEntry, setSubmittingEntry] = useState(false);
    const [selectedEntryForDetails, setSelectedEntryForDetails] = useState<GlobalPromoEntry | null>(null);
    const [selectedEntryIds, setSelectedEntryIds] = useState<string[]>([]);
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending_review' | 'approved' | 'rejected'>('all');
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);
    const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');
    const [pendingPickerField, setPendingPickerField] = useState<'startsAt' | 'endsAt'>('startsAt');

    const stats = useMemo(() => {
        const liveCount = events.filter((event) => event.status === 'live').length;
        const scheduledCount = events.filter((event) => event.status === 'scheduled').length;
        return { liveCount, scheduledCount };
    }, [events]);

    const filteredEntries = useMemo(() => {
        if (statusFilter === 'all') return entries;
        return entries.filter((entry) => entry.status === statusFilter);
    }, [entries, statusFilter]);

    const handleEventSubmit = async () => {
        setSubmittingEvent(true);
        try {
            const slug = eventForm.slug.trim() || slugify(eventForm.displayName);
            await createEvent({
                slug,
                theme: eventForm.theme,
                displayName: eventForm.displayName,
                description: eventForm.description || undefined,
                startsAt: new Date(eventForm.startsAt).toISOString(),
                endsAt: new Date(eventForm.endsAt).toISOString(),
                recurrenceRule: eventForm.recurrenceRule || undefined,
                config: {
                    highlightColor: eventForm.highlightColor,
                    bannerText: eventForm.bannerText,
                },
            });
            setEventForm((prev) => ({
                ...prev,
                slug: '',
                description: '',
                recurrenceRule: '',
            }));
            Alert.alert(t('message.success'), t('promoManager.campaignCreated'));
        } catch (err: any) {
            Alert.alert(t('message.error'), err.message || t('promoManager.cannotCreateCampaign'));
        } finally {
            setSubmittingEvent(false);
        }
    };

    const handleEntrySubmit = async () => {
        if (!selectedEvent) return;
        setSubmittingEntry(true);
        try {
            const metadataSafe =
                entryForm.metadata.trim().length > 0
                    ? JSON.parse(entryForm.metadata)
                    : {
                        badge: 'Black Friday',
                        highlight: true,
                    };

            await upsertEntry({
                serviceId: Number(entryForm.serviceId),
                discountPercentage: entryForm.discountPercentage ? Number(entryForm.discountPercentage) : undefined,
                promoPriceCfa: entryForm.promoPriceCfa ? Number(entryForm.promoPriceCfa) : undefined,
                stockCap: entryForm.stockCap ? Number(entryForm.stockCap) : undefined,
                availability: entryForm.availability as 'online' | 'live' | 'both',
                metadata: metadataSafe,
                highlighted: entryForm.highlighted,
                priorityScore: entryForm.priorityScore,
            });

            setEntryForm((prev) => ({
                ...prev,
                serviceId: '',
                discountPercentage: '',
                promoPriceCfa: '',
                stockCap: '',
            }));
            Alert.alert(t('message.success'), t('promoManager.productAdded'));
        } catch (err: any) {
            Alert.alert(t('message.error'), err.message || t('promoManager.cannotCreateEntry'));
        } finally {
            setSubmittingEntry(false);
        }
    };

    const handleApproveEntry = async (entryId: string) => {
        try {
            await reviewEntry(entryId, { status: 'approved' });
            Alert.alert(t('message.success'), t('promoManager.entryApproved'));
        } catch (err: any) {
            Alert.alert(t('message.error'), err.message || t('promoManager.cannotApprove'));
        }
    };

    const [rejectModalVisible, setRejectModalVisible] = useState(false);
    const [rejectEntryId, setRejectEntryId] = useState<string | null>(null);
    const [rejectMessage, setRejectMessage] = useState('');

    const handleRejectEntry = (entryId: string) => {
        setRejectEntryId(entryId);
        setRejectMessage('');
        setRejectModalVisible(true);
    };

    const confirmReject = async () => {
        if (!rejectEntryId) return;
        try {
            await reviewEntry(rejectEntryId, {
                status: 'rejected',
                message: rejectMessage || undefined,
            });
            Alert.alert(t('message.success'), t('promoManager.entryRejected'));
            setRejectModalVisible(false);
            setRejectEntryId(null);
            setRejectMessage('');
        } catch (err: any) {
            Alert.alert(t('message.error'), err.message || t('promoManager.cannotReject'));
        }
    };

    const handleBulkApprove = async () => {
        if (selectedEntryIds.length === 0) return;
        try {
            await reviewEntriesBulk(selectedEntryIds, { status: 'approved' });
            setSelectedEntryIds([]);
            Alert.alert(t('message.success'), t('promoManager.bulkApproved'));
        } catch (err: any) {
            Alert.alert(t('message.error'), err.message || t('promoManager.cannotBulkApprove'));
        }
    };

    return (
        <SafeNativeView style={styles.container}>
            <LinearGradient colors={modernColors.primaryGradient} style={styles.header}>
                <View style={styles.headerContent}>
                    <Text style={styles.headerTitle}>🔥 Configuration Black Friday</Text>
                    <Text style={styles.headerSubtitle}>{t('globalPromoManager.gestionDesCampagnesGlobales')}</Text>
                </View>
            </LinearGradient>

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
                {/* Statistiques */}
                <View style={styles.statsContainer}>
                    <View style={styles.statCard}>
                        <Text style={styles.statValue}>{events.length}</Text>
                        <Text style={styles.statLabel}>Campagnes</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={[styles.statValue, styles.statValueLive]}>{stats.liveCount}</Text>
                        <Text style={styles.statLabel}>Actives</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={[styles.statValue, styles.statValueScheduled]}>{stats.scheduledCount}</Text>
                        <Text style={styles.statLabel}>{t('globalPromoManager.programmees')}</Text>
                    </View>
                </View>

                {error && (
                    <View style={styles.errorContainer}>
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                )}

                {/* Formulaire de création d'événement */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t('globalPromoManager.creerPlanifierUnEvenement')}</Text>
                    <View style={styles.form}>
                        <View style={styles.field}>
                            <Text style={styles.label}>Nom public *</Text>
                            <TextInput
                                style={styles.input}
                                value={eventForm.displayName}
                                onChangeText={(value) => setEventForm((prev) => ({ ...prev, displayName: value }))}
                                placeholder="Black Friday national"
                            />
                        </View>

                        <View style={styles.field}>
                            <Text style={styles.label}>Slug (optionnel)</Text>
                            <TextInput
                                style={styles.input}
                                value={eventForm.slug}
                                onChangeText={(value) => setEventForm((prev) => ({ ...prev, slug: value }))}
                                placeholder="black-friday-2025"
                            />
                        </View>

                        <View style={styles.field}>
                            <Text style={styles.label}>{t('globalPromoManager.theme')}</Text>
                            <TextInput
                                style={styles.input}
                                value={eventForm.theme}
                                onChangeText={(value) => setEventForm((prev) => ({ ...prev, theme: value }))}
                                placeholder="black_friday"
                            />
                        </View>

                        <View style={styles.field}>
                            <Text style={styles.label}>Description</Text>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                value={eventForm.description}
                                onChangeText={(value) => setEventForm((prev) => ({ ...prev, description: value }))}
                                multiline
                                numberOfLines={2}
                                placeholder={t('globalPromoManager.descriptionDeLaCampagne')}
                            />
                        </View>

                        <View style={styles.row}>
                            <View style={[styles.field, styles.fieldHalf]}>
                                <Text style={styles.label}>{t('globalPromoManager.debut')}</Text>
                                <TouchableOpacity
                                    style={styles.input}
                                    onPress={() => {
                                        setPendingPickerField('startsAt');
                                        setPickerMode('date');
                                        setShowStartPicker(true);
                                    }}
                                >
                                    <Text style={styles.dateText}>
                                        {new Date(eventForm.startsAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                                    </Text>
                                </TouchableOpacity>
                                {showStartPicker && (
                                    <DateTimePicker
                                        value={new Date(eventForm.startsAt)}
                                        mode={pickerMode}
                                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                        onChange={(_e: any, selectedDate?: Date) => {
                                            if (Platform.OS === 'android') setShowStartPicker(false);
                                            if (selectedDate) {
                                                if (pickerMode === 'date') {
                                                    setEventForm(prev => ({ ...prev, startsAt: formatDateTimeLocal(selectedDate) }));
                                                    setPickerMode('time');
                                                    if (Platform.OS === 'android') setShowStartPicker(true);
                                                } else {
                                                    setEventForm(prev => ({ ...prev, startsAt: formatDateTimeLocal(selectedDate) }));
                                                    setShowStartPicker(false);
                                                    setPickerMode('date');
                                                }
                                            }
                                        }}
                                    />
                                )}
                            </View>
                            <View style={[styles.field, styles.fieldHalf]}>
                                <Text style={styles.label}>Fin *</Text>
                                <TouchableOpacity
                                    style={styles.input}
                                    onPress={() => {
                                        setPendingPickerField('endsAt');
                                        setPickerMode('date');
                                        setShowEndPicker(true);
                                    }}
                                >
                                    <Text style={styles.dateText}>
                                        {new Date(eventForm.endsAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                                    </Text>
                                </TouchableOpacity>
                                {showEndPicker && (
                                    <DateTimePicker
                                        value={new Date(eventForm.endsAt)}
                                        mode={pickerMode}
                                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                        onChange={(_e: any, selectedDate?: Date) => {
                                            if (Platform.OS === 'android') setShowEndPicker(false);
                                            if (selectedDate) {
                                                if (pickerMode === 'date') {
                                                    setEventForm(prev => ({ ...prev, endsAt: formatDateTimeLocal(selectedDate) }));
                                                    setPickerMode('time');
                                                    if (Platform.OS === 'android') setShowEndPicker(true);
                                                } else {
                                                    setEventForm(prev => ({ ...prev, endsAt: formatDateTimeLocal(selectedDate) }));
                                                    setShowEndPicker(false);
                                                    setPickerMode('date');
                                                }
                                            }
                                        }}
                                    />
                                )}
                            </View>
                        </View>

                        <TouchableOpacity
                            style={[styles.button, styles.buttonPrimary, submittingEvent && styles.buttonDisabled]}
                            onPress={handleEventSubmit}
                            disabled={submittingEvent}
                        >
                            {submittingEvent ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.buttonText}>{t('globalPromoManager.ajouterMettreAJour')}</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Liste des campagnes existantes */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Campagnes existantes</Text>
                    {loadingEvents ? (
                        <ActivityIndicator size="large" color={modernColors.primary} />
                    ) : (
                        <View style={styles.eventList}>
                            {events.map((event) => (
                                <TouchableOpacity
                                    key={event.id}
                                    style={[
                                        styles.eventCard,
                                        selectedEvent?.id === event.id && styles.eventCardSelected,
                                    ]}
                                    onPress={() => selectEvent(event.id)}
                                >
                                    <View style={styles.eventCardHeader}>
                                        <Text style={styles.eventName}>{event.displayName}</Text>
                                        <View style={[styles.statusBadge, styles[`status_${event.status}`]]}>
                                            <Text style={styles.statusText}>{event.status}</Text>
                                        </View>
                                    </View>
                                    <Text style={styles.eventDates}>
                                        {new Date(event.startsAt).toLocaleString('fr-FR')} →{' '}
                                        {new Date(event.endsAt).toLocaleString('fr-FR')}
                                    </Text>
                                    {event.description && (
                                        <Text style={styles.eventDescription} numberOfLines={2}>
                                            {event.description}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            ))}
                            {!events.length && (
                                <Text style={styles.emptyText}>
                                    Aucune campagne enregistrée. Créez votre premier Black Friday pour synchroniser tous
                                    les prestataires.
                                </Text>
                            )}
                        </View>
                    )}
                </View>

                {/* Gestion des entrées de la campagne sélectionnée */}
                {selectedEvent && (
                    <View style={styles.section}>
                        <View style={styles.selectedEventHeader}>
                            <View>
                                <Text style={styles.selectedEventLabel}>{t('globalPromoManager.campagneSelectionnee')}</Text>
                                <Text style={styles.selectedEventName}>{selectedEvent.displayName}</Text>
                                <Text style={styles.selectedEventInfo}>
                                    {entries.length} produit(s) participant(s) – statut{' '}
                                    <Text style={styles.selectedEventStatus}>{selectedEvent.status}</Text>
                                </Text>
                            </View>
                        </View>

                        {/* Filtre de statut */}
                        <View style={styles.filterContainer}>
                            <Text style={styles.filterLabel}>Filtrer par statut :</Text>
                            <View style={styles.filterButtons}>
                                {(['all', 'pending_review', 'approved', 'rejected'] as const).map((status) => (
                                    <TouchableOpacity
                                        key={status}
                                        style={[
                                            styles.filterButton,
                                            statusFilter === status && styles.filterButtonActive,
                                        ]}
                                        onPress={() => setStatusFilter(status)}
                                    >
                                        <Text
                                            style={[
                                                styles.filterButtonText,
                                                statusFilter === status && styles.filterButtonTextActive,
                                            ]}
                                        >
                                            {status === 'all'
                                                ? 'Tous'
                                                : status === 'pending_review'
                                                    ? 'En revue'
                                                    : status === 'approved'
                                                        ? t('globalPromoManagerScreen.approuve')
                                                        : t('globalPromoManagerScreen.refuse')}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            {selectedEntryIds.length > 0 && (
                                <TouchableOpacity style={styles.bulkApproveButton} onPress={handleBulkApprove}>
                                    <Text style={styles.bulkApproveText}>
                                        Approuver la sélection ({selectedEntryIds.length})
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Liste des entrées */}
                        {loadingEntries ? (
                            <ActivityIndicator size="large" color={modernColors.primary} />
                        ) : (
                            <View style={styles.entriesList}>
                                {filteredEntries.map((entry) => (
                                    <View key={entry.id} style={styles.entryCard}>
                                        <View style={styles.entryHeader}>
                                            <TouchableOpacity
                                                style={styles.checkbox}
                                                onPress={() => {
                                                    if (selectedEntryIds.includes(entry.id)) {
                                                        setSelectedEntryIds((prev) =>
                                                            prev.filter((id) => id !== entry.id),
                                                        );
                                                    } else {
                                                        setSelectedEntryIds((prev) => [...prev, entry.id]);
                                                    }
                                                }}
                                            >
                                                {selectedEntryIds.includes(entry.id) && (
                                                    <SafeIcon name="check" size={16} color={modernColors.primary} />
                                                )}
                                            </TouchableOpacity>
                                            <Text style={styles.entryServiceId}>Service #{entry.serviceId}</Text>
                                            <View style={[styles.statusBadge, styles[`status_${entry.status}`]]}>
                                                <Text style={styles.statusText}>
                                                    {entry.status === 'pending_review'
                                                        ? 'En revue'
                                                        : entry.status === 'approved'
                                                            ? t('globalPromoManagerScreen.approuve')
                                                            : entry.status === 'rejected'
                                                                ? t('globalPromoManagerScreen.refuse')
                                                                : entry.status}
                                                </Text>
                                            </View>
                                        </View>
                                        <View style={styles.entryDetails}>
                                            <Text style={styles.entryDetail}>
                                                Prix: {entry.promoPriceCfa ? `${entry.promoPriceCfa.toLocaleString('fr-FR')} CFA` : '—'}
                                            </Text>
                                            <Text style={styles.entryDetail}>
                                                Réduction: {entry.discountPercentage ? `${entry.discountPercentage}%` : '—'}
                                            </Text>
                                            <Text style={styles.entryDetail}>
                                                Stock: {entry.stockCap ? entry.stockCap : '—'}
                                            </Text>
                                            <Text style={styles.entryDetail}>{t('globalPromoManagerScreen.disponibilite')} {entry.availability}</Text>
                                        </View>
                                        <View style={styles.entryActions}>
                                            <TouchableOpacity
                                                style={styles.actionButton}
                                                onPress={() => setSelectedEntryForDetails(entry)}
                                            >
                                                <Text style={styles.actionButtonText}>{t('globalPromoManager.details')}</Text>
                                            </TouchableOpacity>
                                            {entry.status === 'pending_review' && (
                                                <>
                                                    <TouchableOpacity
                                                        style={[styles.actionButton, styles.actionButtonApprove]}
                                                        onPress={() => handleApproveEntry(entry.id)}
                                                    >
                                                        <Text style={styles.actionButtonText}>Approuver</Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        style={[styles.actionButton, styles.actionButtonReject]}
                                                        onPress={() => handleRejectEntry(entry.id)}
                                                    >
                                                        <Text style={styles.actionButtonText}>Refuser</Text>
                                                    </TouchableOpacity>
                                                </>
                                            )}
                                        </View>
                                    </View>
                                ))}
                                {!filteredEntries.length && (
                                    <Text style={styles.emptyText}>
                                        {loadingEntries
                                            ? 'Chargement des produits...'
                                            : "Aucun produit n'est rattaché à cette campagne."}
                                    </Text>
                                )}
                            </View>
                        )}

                        {/* Formulaire d'ajout d'entrée */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>{t('globalPromoManager.ajouterLesProduitsDesPrestataires')}</Text>
                            <View style={styles.form}>
                                <View style={styles.row}>
                                    <View style={[styles.field, styles.fieldHalf]}>
                                        <Text style={styles.label}>{t('globalPromoManager.idService')}</Text>
                                        <TextInput
                                            style={styles.input}
                                            value={entryForm.serviceId}
                                            onChangeText={(value) =>
                                                setEntryForm((prev) => ({ ...prev, serviceId: value }))
                                            }
                                            keyboardType="numeric"
                                            placeholder="2458"
                                        />
                                    </View>
                                    <View style={[styles.field, styles.fieldHalf]}>
                                        <Text style={styles.label}>Prix promo (CFA)</Text>
                                        <TextInput
                                            style={styles.input}
                                            value={entryForm.promoPriceCfa}
                                            onChangeText={(value) =>
                                                setEntryForm((prev) => ({ ...prev, promoPriceCfa: value }))
                                            }
                                            keyboardType="numeric"
                                            placeholder="50000"
                                        />
                                    </View>
                                </View>

                                <View style={styles.row}>
                                    <View style={[styles.field, styles.fieldHalf]}>
                                        <Text style={styles.label}>{t('globalPromoManager.reduction')}</Text>
                                        <TextInput
                                            style={styles.input}
                                            value={entryForm.discountPercentage}
                                            onChangeText={(value) =>
                                                setEntryForm((prev) => ({ ...prev, discountPercentage: value }))
                                            }
                                            keyboardType="numeric"
                                            placeholder="20"
                                        />
                                    </View>
                                    <View style={[styles.field, styles.fieldHalf]}>
                                        <Text style={styles.label}>{t('globalPromoManager.stockPromo')}</Text>
                                        <TextInput
                                            style={styles.input}
                                            value={entryForm.stockCap}
                                            onChangeText={(value) =>
                                                setEntryForm((prev) => ({ ...prev, stockCap: value }))
                                            }
                                            keyboardType="numeric"
                                            placeholder="100"
                                        />
                                    </View>
                                </View>

                                <View style={styles.field}>
                                    <Text style={styles.label}>{t('globalPromoManager.disponibilite')}</Text>
                                    <View style={styles.radioGroup}>
                                        {availabilityOptions.map((option) => (
                                            <TouchableOpacity
                                                key={option.value}
                                                style={[
                                                    styles.radioOption,
                                                    entryForm.availability === option.value && styles.radioOptionActive,
                                                ]}
                                                onPress={() =>
                                                    setEntryForm((prev) => ({ ...prev, availability: option.value }))
                                                }
                                            >
                                                <Text
                                                    style={[
                                                        styles.radioText,
                                                        entryForm.availability === option.value &&
                                                        styles.radioTextActive,
                                                    ]}
                                                >
                                                    {option.label}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>

                                <View style={styles.field}>
                                    <Text style={styles.label}>{t('globalPromoManager.scoreDePrioriteTriCatalogue')}</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={String(entryForm.priorityScore)}
                                        onChangeText={(value) =>
                                            setEntryForm((prev) => ({ ...prev, priorityScore: Number(value) || 10 }))
                                        }
                                        keyboardType="numeric"
                                        placeholder="10"
                                    />
                                </View>

                                <View style={styles.checkboxRow}>
                                    <TouchableOpacity
                                        style={styles.checkbox}
                                        onPress={() =>
                                            setEntryForm((prev) => ({ ...prev, highlighted: !prev.highlighted }))
                                        }
                                    >
                                        {entryForm.highlighted && (
                                            <SafeIcon name="check" size={16} color={modernColors.primary} />
                                        )}
                                    </TouchableOpacity>
                                    <Text style={styles.checkboxLabel}>
                                        Mettre en avant dans le carrousel public
                                    </Text>
                                </View>

                                <View style={styles.field}>
                                    <Text style={styles.label}>{t('globalPromoManager.metadonneesJson')}</Text>
                                    <TextInput
                                        style={[styles.input, styles.textArea]}
                                        value={entryForm.metadata}
                                        onChangeText={(value) =>
                                            setEntryForm((prev) => ({ ...prev, metadata: value }))
                                        }
                                        multiline
                                        numberOfLines={3}
                                        placeholder='{"tagline":"Promo nationale"}'
                                    />
                                </View>

                                <TouchableOpacity
                                    style={[styles.button, styles.buttonPrimary, submittingEntry && styles.buttonDisabled]}
                                    onPress={handleEntrySubmit}
                                    disabled={submittingEntry}
                                >
                                    {submittingEntry ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <Text style={styles.buttonText}>{t('globalPromoManager.ajouterMettreAJourCe')}</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                )}

                {/* Modal de refus d'entrée */}
                <Modal
                    visible={rejectModalVisible}
                    transparent={true}
                    animationType="slide"
                    onRequestClose={() => setRejectModalVisible(false)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Motif du refus</Text>
                                <TouchableOpacity onPress={() => setRejectModalVisible(false)}>
                                    <SafeIcon name="x" size={24} color="#666" />
                                </TouchableOpacity>
                            </View>
                            <View style={styles.modalBody}>
                                <Text style={styles.label}>{t('globalPromoManager.motifDuRefusVisibleCote')}</Text>
                                <TextInput
                                    style={[styles.input, styles.textArea]}
                                    value={rejectMessage}
                                    onChangeText={setRejectMessage}
                                    multiline
                                    numberOfLines={4}
                                    placeholder={t('globalPromoManager.entrezLeMotifDuRefus')}
                                />
                                <View style={styles.modalActions}>
                                    <TouchableOpacity
                                        style={[styles.button, styles.buttonSecondary]}
                                        onPress={() => setRejectModalVisible(false)}
                                    >
                                        <Text style={styles.buttonSecondaryText}>{t('globalPromoManagerScreen.annuler')}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.button, styles.buttonReject]}
                                        onPress={confirmReject}
                                    >
                                        <Text style={styles.buttonText}>{t('globalPromoManagerScreen.confirmerLeRefus')}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </View>
                </Modal>

                {/* Modal de détails d'entrée */}
                <Modal
                    visible={selectedEntryForDetails !== null}
                    transparent={true}
                    animationType="slide"
                    onRequestClose={() => setSelectedEntryForDetails(null)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>
                                    Détails de l'entrée #{selectedEntryForDetails?.serviceId}
                                </Text>
                                <TouchableOpacity onPress={() => setSelectedEntryForDetails(null)}>
                                    <SafeIcon name="x" size={24} color="#666" />
                                </TouchableOpacity>
                            </View>
                            {selectedEntryForDetails && (
                                <ScrollView style={styles.modalBody}>
                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>Statut:</Text>
                                        <Text style={styles.detailValue}>{selectedEntryForDetails.status}</Text>
                                    </View>
                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>{t('globalPromoManager.disponibilite')}</Text>
                                        <Text style={styles.detailValue}>{selectedEntryForDetails.availability}</Text>
                                    </View>
                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>Prix promo:</Text>
                                        <Text style={styles.detailValue}>
                                            {selectedEntryForDetails.promoPriceCfa
                                                ? `${selectedEntryForDetails.promoPriceCfa.toLocaleString('fr-FR')} CFA`
                                                : '—'}
                                        </Text>
                                    </View>
                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>{t('globalPromoManager.reduction')}</Text>
                                        <Text style={styles.detailValue}>
                                            {selectedEntryForDetails.discountPercentage
                                                ? `${selectedEntryForDetails.discountPercentage}%`
                                                : '—'}
                                        </Text>
                                    </View>
                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>{t('globalPromoManager.stockCible')}</Text>
                                        <Text style={styles.detailValue}>
                                            {selectedEntryForDetails.stockCap ? selectedEntryForDetails.stockCap : '—'}
                                        </Text>
                                    </View>
                                    <View style={styles.detailSection}>
                                        <Text style={styles.detailSectionTitle}>{t('globalPromoManager.metadonneesJson')}</Text>
                                        <Text style={styles.detailJson}>
                                            {JSON.stringify(selectedEntryForDetails.metadata ?? {}, null, 2)}
                                        </Text>
                                    </View>
                                </ScrollView>
                            )}
                        </View>
                    </View>
                </Modal>
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
        paddingTop: 60,
        paddingBottom: 20,
        paddingHorizontal: 20,
    },
    headerContent: {
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 4,
    },
    headerSubtitle: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.9)',
    },
    scrollView: {
        flex: 1,
    },
    content: {
        padding: 16,
    },
    statsContainer: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 20,
    },
    statCard: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    statValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1F2937',
        marginBottom: 4,
    },
    statValueLive: {
        color: '#10B981',
    },
    statValueScheduled: {
        color: '#6366F1',
    },
    statLabel: {
        fontSize: 12,
        color: '#6B7280',
    },
    errorContainer: {
        backgroundColor: '#FEE2E2',
        borderRadius: 8,
        padding: 12,
        marginBottom: 20,
    },
    errorText: {
        color: '#DC2626',
        fontSize: 14,
    },
    section: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1F2937',
        marginBottom: 16,
    },
    form: {
        gap: 12,
    },
    field: {
        marginBottom: 12,
    },
    fieldHalf: {
        flex: 1,
    },
    row: {
        flexDirection: 'row',
        gap: 12,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 6,
    },
    input: {
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 8,
        padding: 12,
        fontSize: 14,
        color: '#1F2937',
        backgroundColor: '#FFFFFF',
    },
    dateText: {
        fontSize: 14,
        color: '#1F2937',
    },
    textArea: {
        minHeight: 80,
        textAlignVertical: 'top',
    },
    button: {
        borderRadius: 8,
        padding: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonPrimary: {
        backgroundColor: '#6366F1',
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    buttonSecondary: {
        backgroundColor: '#E5E7EB',
    },
    buttonSecondaryText: {
        color: '#374151',
        fontSize: 16,
        fontWeight: '600',
    },
    buttonReject: {
        backgroundColor: '#EF4444',
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 16,
    },
    eventList: {
        gap: 12,
    },
    eventCard: {
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        padding: 16,
        backgroundColor: '#FFFFFF',
    },
    eventCardSelected: {
        borderColor: '#6366F1',
        backgroundColor: '#EEF2FF',
    },
    eventCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    eventName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1F2937',
        flex: 1,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    status_live: {
        backgroundColor: '#D1FAE5',
    },
    status_scheduled: {
        backgroundColor: '#E0E7FF',
    },
    status_pending_review: {
        backgroundColor: '#FEF3C7',
    },
    status_approved: {
        backgroundColor: '#D1FAE5',
    },
    status_rejected: {
        backgroundColor: '#FEE2E2',
    },
    statusText: {
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    eventDates: {
        fontSize: 12,
        color: '#6B7280',
        marginBottom: 8,
    },
    eventDescription: {
        fontSize: 14,
        color: '#4B5563',
    },
    emptyText: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
        padding: 20,
    },
    selectedEventHeader: {
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderStyle: 'dashed',
    },
    selectedEventLabel: {
        fontSize: 12,
        color: '#6B7280',
        marginBottom: 4,
    },
    selectedEventName: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1F2937',
        marginBottom: 8,
    },
    selectedEventInfo: {
        fontSize: 14,
        color: '#4B5563',
    },
    selectedEventStatus: {
        fontWeight: '600',
    },
    filterContainer: {
        marginBottom: 16,
    },
    filterLabel: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 8,
    },
    filterButtons: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 12,
    },
    filterButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#D1D5DB',
        backgroundColor: '#FFFFFF',
    },
    filterButtonActive: {
        backgroundColor: '#6366F1',
        borderColor: '#6366F1',
    },
    filterButtonText: {
        fontSize: 12,
        color: '#6B7280',
    },
    filterButtonTextActive: {
        color: '#FFFFFF',
        fontWeight: '600',
    },
    bulkApproveButton: {
        backgroundColor: '#10B981',
        borderRadius: 8,
        padding: 10,
        alignItems: 'center',
    },
    bulkApproveText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
    },
    entriesList: {
        gap: 12,
        marginBottom: 16,
    },
    entryCard: {
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        padding: 16,
        backgroundColor: '#FFFFFF',
    },
    entryHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 12,
    },
    checkbox: {
        width: 20,
        height: 20,
        borderWidth: 2,
        borderColor: '#6366F1',
        borderRadius: 4,
        alignItems: 'center',
        justifyContent: 'center',
    },
    entryServiceId: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1F2937',
        flex: 1,
    },
    entryDetails: {
        gap: 4,
        marginBottom: 12,
    },
    entryDetail: {
        fontSize: 13,
        color: '#4B5563',
    },
    entryActions: {
        flexDirection: 'row',
        gap: 8,
        flexWrap: 'wrap',
    },
    actionButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#D1D5DB',
        backgroundColor: '#FFFFFF',
    },
    actionButtonApprove: {
        backgroundColor: '#10B981',
        borderColor: '#10B981',
    },
    actionButtonReject: {
        backgroundColor: '#EF4444',
        borderColor: '#EF4444',
    },
    actionButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#374151',
    },
    radioGroup: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    radioOption: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#D1D5DB',
        backgroundColor: '#FFFFFF',
    },
    radioOptionActive: {
        backgroundColor: '#6366F1',
        borderColor: '#6366F1',
    },
    radioText: {
        fontSize: 13,
        color: '#6B7280',
    },
    radioTextActive: {
        color: '#FFFFFF',
        fontWeight: '600',
    },
    checkboxRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    checkboxLabel: {
        fontSize: 14,
        color: '#374151',
        flex: 1,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        width: '100%',
        maxHeight: '80%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
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
        fontWeight: 'bold',
        color: '#1F2937',
    },
    modalBody: {
        padding: 16,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    detailLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
    },
    detailValue: {
        fontSize: 14,
        color: '#1F2937',
    },
    detailSection: {
        marginTop: 16,
    },
    detailSectionTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6B7280',
        textTransform: 'uppercase',
        marginBottom: 8,
    },
    detailJson: {
        fontSize: 11,
        fontFamily: 'monospace',
        backgroundColor: '#1F2937',
        color: '#F9FAFB',
        padding: 12,
        borderRadius: 8,
    },
});

export default GlobalPromoManagerScreen;

