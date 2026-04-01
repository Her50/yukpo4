import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import LocationSelector, { LocationObject } from '../../components/LocationSelector';
import HotelVariantManager, { HotelVariant } from '../../components/HotelVariantManager';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton, NativeInput } from '../../components/SafeNativeDesign';
import MediaUploader, { MediaItem } from '../../components/specialized/MediaUploader';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { useLocation } from '../../contexts/LocationContext';
import { getCurrencyFromGPS, useCurrencyDetection } from '../../hooks/useCurrencyDetection';
import { clearSavedFormData, useFormAutoSave } from '../../hooks/useFormAutoSave';
import { apiPut, servicesApi } from '../../services/api';
import { immobilierService } from '../../services/immobilierService';
import { modernColors } from '../../theme/modernTheme';
import { getCurrencyIntelligently } from '../../utils/currencyUtils';

const STORAGE_KEY = '@hotel_meuble_partner_form';

const HotelMeublePartnerFormScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();
    const { t } = useLanguageSafe();
    const { location } = useLocation();

    const tr = (key: string, fallback: string) => {
        const translated = t(key) as unknown as string;
        return translated && translated !== key ? translated : fallback;
    };

    const mode = ((route.params as any)?.mode as 'create' | 'edit' | undefined) || 'create';
    const propertyId = (route.params as any)?.propertyId as number | undefined;
    const routeServiceId = (route.params as any)?.serviceId as number | undefined;
    const initialTypeBienFromRoute = (route.params as any)?.initialTypeBien as 'hotel' | 'meuble' | undefined;
    const inferredPartnerType = user?.partner_type === 'meuble' ? 'meuble' : 'hotel';
    const initialTypeBien = initialTypeBienFromRoute || inferredPartnerType;

    const [serviceId, setServiceId] = useState<number | null>(routeServiceId || null);
    const [loading, setLoading] = useState(false);
    const [media, setMedia] = useState<MediaItem[]>([]);
    const [variants, setVariants] = useState<HotelVariant[]>([]);

    const [formData, setFormData] = useState({
        titre: '',
        description: '',
        type_bien: initialTypeBien as 'hotel' | 'meuble',
        ville: null as LocationObject | null,
        quartier: null as LocationObject | null,
        adresse: '',
        standing: '',
        nb_chambres: '',
        prix_nuitee: '',
    });

    useFormAutoSave(STORAGE_KEY, formData, mode !== 'edit', 1200);

    const detectedCurrency = useCurrencyDetection(formData.ville || formData.quartier || null);
    const [devise, setDevise] = useState(detectedCurrency || 'XAF');

    useEffect(() => {
        const src = formData.ville || formData.quartier;
        if (src) {
            const c = getCurrencyIntelligently(
                src,
                location?.coords ? { lat: location.coords.latitude, lng: location.coords.longitude } : null
            );
            if (c) setDevise(c);
            return;
        }
        if (location?.coords) {
            setDevise(getCurrencyFromGPS({ lat: location.coords.latitude, lng: location.coords.longitude }));
        }
    }, [formData.ville, formData.quartier, location]);

    useEffect(() => {
        if (mode !== 'edit' || !propertyId) return;
        (async () => {
            try {
                setLoading(true);
                const resp = await immobilierService.getPropertyDetails(propertyId);
                const payload = (resp?.data || resp) as any;
                const d = payload?.data || payload;
                if (!d) return;

                setFormData(prev => ({
                    ...prev,
                    titre: d.titre || '',
                    description: d.description || '',
                    type_bien: (d.type_bien === 'meuble' ? 'meuble' : 'hotel') as 'hotel' | 'meuble',
                    ville: d.ville ? ({ raw: d.ville, place_name: d.ville } as LocationObject) : null,
                    quartier: d.quartier ? ({ raw: d.quartier, place_name: d.quartier } as LocationObject) : null,
                    adresse: d.adresse || '',
                    standing: d.standing || '',
                    nb_chambres: d.nb_chambres ? String(d.nb_chambres) : '',
                    prix_nuitee: d.prix_location_mensuel ? String(d.prix_location_mensuel) : '',
                }));

                if (d.service_id) setServiceId(d.service_id);
                if (Array.isArray(d.photos)) {
                    setMedia(d.photos.map((uri: string) => ({
                        uri,
                        type: 'image',
                        uploaded: true,
                        uploadUrl: uri,
                    })));
                }
                if (Array.isArray(d.hotel_variants)) {
                    setVariants(d.hotel_variants);
                }
            } catch (e) {
                console.error('[HotelMeublePartnerForm] load edit data:', e);
                Alert.alert(tr('message.error', 'Erreur'), tr('immobilierForm.genericError', 'Une erreur est survenue'));
            } finally {
                setLoading(false);
            }
        })();
    }, [mode, propertyId]);

    const canSubmit = useMemo(() => {
        return !!(
            formData.titre.trim() &&
            formData.ville &&
            formData.prix_nuitee.trim()
        );
    }, [formData.titre, formData.ville, formData.prix_nuitee]);

    const ensureServiceId = async (): Promise<number | null> => {
        if (serviceId) return serviceId;
        try {
            const resp = await servicesApi.createService({
                titre_service: formData.titre.trim() || tr('hotelDashboard.ajouterUnBien', 'Nouveau bien'),
                description: formData.description?.trim() || `${formData.type_bien} - hebergement`,
                category: 'immobilier',
                specialized_type: 'immobilier',
            });
            if (resp.success && resp.data && typeof resp.data === 'object' && 'id' in resp.data) {
                const id = (resp.data as any).id as number;
                setServiceId(id);
                return id;
            }
        } catch (e) {
            console.error('[HotelMeublePartnerForm] create service:', e);
        }
        return null;
    };

    const handleSubmit = async () => {
        if (!formData.titre.trim()) {
            Alert.alert(tr('message.error', 'Erreur'), tr('immobilierForm.titleRequired', 'Titre obligatoire'));
            return;
        }
        if (!formData.ville) {
            Alert.alert(tr('message.error', 'Erreur'), tr('immobilierForm.locationRequired', 'Localisation requise'));
            return;
        }
        if (!formData.prix_nuitee.trim()) {
            Alert.alert(tr('message.error', 'Erreur'), tr('immobilierForm.rentPriceRequired', 'Prix location requis'));
            return;
        }

        setLoading(true);
        try {
            const ensuredServiceId = await ensureServiceId();
            if (!ensuredServiceId) {
                Alert.alert(tr('message.error', 'Erreur'), tr('immobilierForm.serviceNotCreated', 'Service non cree'));
                setLoading(false);
                return;
            }

            const photos = media
                .filter(m => m.type === 'image' && m.uploadUrl)
                .map(m => m.uploadUrl!);
            const videos = media
                .filter(m => m.type === 'video' && m.uploadUrl)
                .map(m => m.uploadUrl!);

            const payload: any = {
                service_id: ensuredServiceId,
                titre: formData.titre.trim(),
                description: formData.description.trim() || null,
                type_bien: formData.type_bien,
                statut: 'location',
                adresse: formData.adresse.trim() || null,
                quartier: formData.quartier?.raw || formData.quartier?.place_name || null,
                ville: formData.ville?.raw || formData.ville?.place_name || null,
                standing: formData.standing || null,
                nb_chambres: formData.nb_chambres ? parseInt(formData.nb_chambres, 10) : null,
                prix_location_mensuel: parseFloat(formData.prix_nuitee) || 0,
                photos: photos.length > 0 ? photos : null,
                videos: videos.length > 0 ? videos : null,
                hotel_variants: variants.length > 0 ? variants : null,
                devise,
            };

            let resp: any;
            if (mode === 'edit' && propertyId) {
                resp = await apiPut(`/api/immobilier/biens/${propertyId}`, payload);
            } else {
                resp = await immobilierService.createProperty(payload);
            }

            if (resp?.success) {
                await clearSavedFormData(STORAGE_KEY);
                Alert.alert(
                    tr('message.success', 'Succes'),
                    mode === 'edit'
                        ? tr('immobilierForm.propertyUpdated', 'Bien modifie !')
                        : tr('immobilierForm.propertyCreated', 'Bien cree !'),
                    [{ text: 'OK', onPress: () => navigation.goBack() }]
                );
            } else {
                Alert.alert(tr('message.error', 'Erreur'), resp?.error || tr('immobilierForm.cannotSave', 'Impossible d enregistrer'));
            }
        } catch (e: any) {
            console.error('[HotelMeublePartnerForm] submit:', e);
            Alert.alert(tr('message.error', 'Erreur'), e?.message || tr('immobilierForm.genericError', 'Une erreur est survenue'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <SafeIcon name="arrow-left" size={22} color="#fff" />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.title}>
                        {mode === 'edit'
                            ? tr('hotelDashboardScreen.modifier', 'Modifier')
                            : tr('hotelDashboard.ajouterUnBien', 'Ajouter un bien')}
                    </Text>
                    <Text style={styles.subtitle}>
                        {formData.type_bien === 'meuble'
                            ? tr('hotelDashboardScreen.meuble', 'Meuble')
                            : tr('hotelDashboardScreen.hotel', 'Hotel')}
                    </Text>
                </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Informations</Text>
                    <NativeInput
                        label={`${tr('immobilierForm.titre', 'Titre')} *`}
                        value={formData.titre}
                        onChangeText={(v) => setFormData(prev => ({ ...prev, titre: v }))}
                        placeholder={tr('immobilierForm.titrePlaceholder', 'Ex: Residence meublee Akwa')}
                    />
                    <NativeInput
                        label={tr('immobilierForm.description', 'Description')}
                        value={formData.description}
                        onChangeText={(v) => setFormData(prev => ({ ...prev, description: v }))}
                        placeholder={tr('immobilierForm.descriptionDetailleeDuBien', 'Description detaillee...')}
                        multiline
                        style={{ minHeight: 88, textAlignVertical: 'top' }}
                    />
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Localisation</Text>
                    <LocationSelector
                        label="Ville *"
                        value={formData.ville || ''}
                        onSelect={(loc: LocationObject) => setFormData(prev => ({ ...prev, ville: loc }))}
                        placeholder={tr('immobilierForm.rechercherLaVille', 'Rechercher la ville...')}
                        scope="all"
                        enrichWithBackend
                    />
                    <LocationSelector
                        label={tr('immobilierForm.quartier', 'Quartier')}
                        value={formData.quartier || ''}
                        onSelect={(loc: LocationObject) => setFormData(prev => ({ ...prev, quartier: loc }))}
                        placeholder={tr('immobilierForm.quartierRue', 'Quartier, rue...')}
                        scope="all"
                        cityContext={formData.ville?.raw || formData.ville?.place_name || ''}
                        enrichWithBackend
                    />
                    <NativeInput
                        label={tr('immobilierForm.adresseComplete', 'Adresse complete')}
                        value={formData.adresse}
                        onChangeText={(v) => setFormData(prev => ({ ...prev, adresse: v }))}
                        placeholder={tr('immobilierFormScreen.adresseExacte', 'Adresse exacte')}
                    />
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Hebergement</Text>
                    <NativeInput
                        label={tr('hotelDashboard.chambres', 'Chambres')}
                        value={formData.nb_chambres}
                        onChangeText={(v) => setFormData(prev => ({ ...prev, nb_chambres: v.replace(/\D/g, '') }))}
                        keyboardType="numeric"
                        placeholder="10"
                    />
                    <NativeInput
                        label={`${tr('immobilierFormScreen.monthlyRent', 'Prix par nuit')} (${devise}) *`}
                        value={formData.prix_nuitee}
                        onChangeText={(v) => setFormData(prev => ({ ...prev, prix_nuitee: v.replace(/[^\d.]/g, '') }))}
                        keyboardType="numeric"
                        placeholder="25000"
                    />
                    <NativeInput
                        label={tr('immobilierForm.standingDuBien', 'Standing')}
                        value={formData.standing}
                        onChangeText={(v) => setFormData(prev => ({ ...prev, standing: v }))}
                        placeholder="Standard / Confort / Luxe"
                    />
                </View>

                <View style={styles.section}>
                    <HotelVariantManager
                        variants={variants}
                        onChange={setVariants}
                        globalDevise={devise}
                    />
                </View>

                <View style={styles.section}>
                    <MediaUploader
                        media={media}
                        onMediaChange={setMedia}
                        maxImages={15}
                        maxVideos={5}
                        allowVideos
                        label={tr('immobilierForm.ajoutezDesPhotosEtVideos', 'Ajoutez des photos et videos')}
                    />
                </View>

                <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
                    <NativeButton
                        title={
                            loading
                                ? tr('immobilierForm.enregistrement', 'Enregistrement...')
                                : mode === 'edit'
                                    ? tr('hotelDashboardScreen.modifier', 'Modifier')
                                    : tr('immobilierForm.publierLeBien', 'Publier le bien')
                        }
                        onPress={handleSubmit}
                        disabled={loading || !canSubmit}
                        variant="primary"
                        size="large"
                    />
                </View>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F3F4F6' },
    header: {
        backgroundColor: '#2563EB',
        paddingTop: 48,
        paddingBottom: 14,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
    },
    backBtn: { marginRight: 10, padding: 4 },
    title: { color: '#fff', fontSize: 20, fontWeight: '700' },
    subtitle: { color: '#DBEAFE', fontSize: 13, marginTop: 2 },
    section: {
        marginTop: 12,
        marginHorizontal: 16,
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 14,
    },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },
});

export default HotelMeublePartnerFormScreen;

