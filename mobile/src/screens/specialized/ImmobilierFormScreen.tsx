// ✅ REFONTE TOTALE 2026-03-05: ImmobilierFormScreen → Formulaire pro avec sections visuelles
// Header gradient, sections collapsibles, chips design, media uploader, GPS intégré
// Exploite endpoints: CRUD immobilier, upload média, Google Places photos, recherche
import { useNavigation, useRoute } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import IntelligentChat from '../../components/IntelligentChat';
import IntelligentChatFab from '../../components/IntelligentChatFab';
import LocationSelector, { LocationObject } from '../../components/LocationSelector';
import ModernGPSModal from '../../components/ModernGPSModal';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton, NativeInput } from '../../components/SafeNativeDesign';
import MediaUploader, { MediaItem } from '../../components/specialized/MediaUploader';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { useLocation } from '../../contexts/LocationContext';
import { getCurrencyFromGPS, useCurrencyDetection } from '../../hooks/useCurrencyDetection';
import { clearSavedFormData, useFormAutoSave } from '../../hooks/useFormAutoSave';
import { useFormValidation } from '../../hooks/useFormValidation';
import { usePartnerData } from '../../hooks/usePartnerData';
import { apiPut, servicesApi } from '../../services/api';
import { googlePlacesMediaService } from '../../services/googlePlacesMediaService';
import { immobilierService } from '../../services/immobilierService';
import { uploadFiles } from '../../services/uploadApi';
import { modernColors } from '../../theme/modernTheme';
import { getCurrencyIntelligently } from '../../utils/currencyUtils';

const STORAGE_KEY = '@immobilier_form';

const ImmobilierFormScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user, logout } = useAuth();
    const { t } = useLanguageSafe();

    const TYPES_BIEN = [
        { key: 'maison', label: t('immobilierForm.maison'), icon: 'home' },
        { key: 'appartement', label: t('immobilierForm.appartement'), icon: 'building' },
        { key: 'terrain', label: t('immobilierForm.terrain'), icon: 'map' },
        { key: 'bureau', label: t('immobilierForm.bureau'), icon: 'briefcase' },
        { key: 'local_commercial', label: t('immobilierForm.localCommercial'), icon: 'store' },
        { key: 'hotel', label: t('immobilierForm.hotel'), icon: 'building' },
        { key: 'meuble', label: t('immobilierForm.meubleLocationMeublee'), icon: 'home' },
    ];
    const STATUTS = [
        { key: 'vente', label: t('immobilierForm.vente'), icon: 'tag' },
        { key: 'location', label: t('immobilierForm.location'), icon: 'key' },
        { key: 'les_deux', label: t('immobilierForm.lesDeux'), icon: 'layers' },
    ];
    const STANDINGS = [t('immobilierFormScreen.economique'), t('immobilierFormScreen.moyen'), t('immobilierFormScreen.hautDeGamme'), t('immobilierFormScreen.luxe')];
    const ETATS = [t('immobilierFormScreen.neuf'), t('immobilierFormScreen.bonEtat'), t('immobilierFormScreen.arenover'), t('immobilierFormScreen.renove')];
    const { location } = useLocation();
    const [serviceId, setServiceId] = useState<number | null>((route.params as any)?.serviceId || null);
    const propertyId = (route.params as any)?.propertyId as number | undefined;
    const mode = (route.params as any)?.mode as string | undefined;
    const initialTypeBien = (route.params as any)?.initialTypeBien as string | undefined;

    const [formData, setFormData] = useState({
        titre: '', description: '', type_bien: initialTypeBien || 'maison', statut: initialTypeBien === 'hotel' || initialTypeBien === 'meuble' ? 'location' : 'vente',
        adresse: '', quartier: null as LocationObject | null, ville: null as LocationObject | null,
        superficie_m2: '', nb_chambres: '', nb_salles_bain: '',
        standing: '', etat_general: '',
        prix_vente: '', prix_location_mensuel: '',
    });

    const [loading, setLoading] = useState(false);
    const [showGPSModal, setShowGPSModal] = useState(false);
    const [selectedGPS, setSelectedGPS] = useState<string | null>(null);
    const [media, setMedia] = useState<MediaItem[]>([]);
    const [importingGoogleMedia, setImportingGoogleMedia] = useState(false);
    const [lastImportedPlaceId, setLastImportedPlaceId] = useState<string | null>(null);
    const [showChat, setShowChat] = useState(false);

    const defaultCurrency = useCurrencyDetection(formData.ville || formData.quartier);
    const [devise, setDevise] = useState(defaultCurrency);

    const { partnerData } = usePartnerData(user?.role);
    const { errors, validateField, validateForm, setError } = useFormValidation({
        titre: { required: true, minLength: 5 },
        description: { required: true, minLength: 20 },
    });

    useFormAutoSave(STORAGE_KEY, formData, true, 1000);

    // Currency detection
    useEffect(() => {
        const src = formData.ville || formData.quartier;
        if (src) {
            const c = getCurrencyIntelligently(src, location?.coords ? { lat: location.coords.latitude, lng: location.coords.longitude } : null);
            if (c) setDevise(c);
        } else if (location?.coords) {
            setDevise(getCurrencyFromGPS({ lat: location.coords.latitude, lng: location.coords.longitude }));
        }
    }, [formData.ville, formData.quartier, location]);

    // Auto-create service
    useEffect(() => {
        if (!serviceId && user?.id && formData.titre) {
            (async () => {
                try {
                    const resp = await servicesApi.createService({ titre_service: formData.titre || t('immobilierForm.bienImmobilier'), description: `Bien: ${formData.type_bien}`, category: 'immobilier', specialized_type: 'immobilier' });
                    if (resp.success && resp.data && typeof resp.data === 'object' && 'id' in resp.data) setServiceId((resp.data as any).id);
                } catch (e) { console.error('[Immobilier] Service:', e); }
            })();
        }
    }, [formData.titre, serviceId, user?.id]);

    // Load edit data
    useEffect(() => {
        if (mode === 'edit' && propertyId) {
            (async () => {
                try {
                    setLoading(true);
                    const resp = await immobilierService.getPropertyDetails(propertyId);
                    if (resp.success && resp.data) {
                        const d = resp.data as any;
                        setFormData({
                            titre: d.titre || '', description: d.description || '',
                            type_bien: d.type_bien || 'maison', statut: d.statut || 'vente',
                            adresse: d.adresse || '',
                            quartier: d.quartier ? { raw: d.quartier, place_name: d.quartier } as any : null,
                            ville: d.ville ? { raw: d.ville, place_name: d.ville } as any : null,
                            superficie_m2: d.superficie_m2?.toString() || '', nb_chambres: d.nb_chambres?.toString() || '',
                            nb_salles_bain: d.nb_salles_bain?.toString() || '', standing: d.standing || '',
                            etat_general: d.etat_general || '',
                            prix_vente: d.prix_vente?.toString() || '', prix_location_mensuel: d.prix_location_mensuel?.toString() || '',
                        });
                        if (d.gps) setSelectedGPS(d.gps);
                        if (d.service_id) setServiceId(d.service_id);
                        if (d.photos && Array.isArray(d.photos)) {
                            setMedia(d.photos.map((p: string) => ({ uri: p, type: 'image', uploaded: true, uploadUrl: p })));
                        }
                    }
                } catch (e) { console.error('[Immobilier] Edit load:', e); } finally { setLoading(false); }
            })();
        }
    }, [mode, propertyId]);

    // Google Places photos import
    const importGooglePlacePhotos = async (placeId: string) => {
        if (!placeId || placeId === lastImportedPlaceId) return;
        try {
            setImportingGoogleMedia(true);
            const photoUrls = await googlePlacesMediaService.getPlacePhotoUrls(placeId, { maxPhotos: 10, maxWidth: 1600 });
            if (photoUrls.length === 0) { setLastImportedPlaceId(placeId); return; }
            const uris = await Promise.all(photoUrls.map(async (url, i) => {
                const dest = `${FileSystem.cacheDirectory}google_place_${placeId}_${i}.jpg`;
                const r = await FileSystem.downloadAsync(url, dest);
                return r.uri;
            }));
            const uploaded = await uploadFiles(uris.map((uri, i) => ({ uri, type: 'image/jpeg', name: `google_place_${placeId}_${i}.jpg` })));
            const items: MediaItem[] = uploaded.filter(f => f?.url).map((f, i) => ({ uri: uris[i], type: 'image', uploaded: true, uploadUrl: f.url }));
            if (items.length > 0) {
                setMedia(prev => {
                    const existing = new Set(prev.map(m => m.uploadUrl).filter(Boolean));
                    return [...prev, ...items.filter(m => !m.uploadUrl || !existing.has(m.uploadUrl))];
                });
                Alert.alert(t('immobilierForm.photosAdded'), t('immobilierForm.photosImported', { count: items.length }));
            }
            setLastImportedPlaceId(placeId);
        } catch (e) { console.error('[Immobilier] Google photos:', e); } finally { setImportingGoogleMedia(false); }
    };

    // Submit
    const handleSubmit = async () => {
        if (!formData.titre.trim()) { Alert.alert(t('message.error'), t('immobilierForm.titleRequired')); return; }
        if (!serviceId) { Alert.alert(t('message.error'), t('immobilierForm.serviceNotCreated')); return; }
        if (!formData.ville && !selectedGPS) { Alert.alert(t('message.error'), t('immobilierForm.locationRequired')); return; }
        if (formData.statut === 'vente' && !formData.prix_vente) { Alert.alert(t('message.error'), t('immobilierForm.salePriceRequired')); return; }
        if (formData.statut === 'location' && !formData.prix_location_mensuel) { Alert.alert(t('message.error'), t('immobilierForm.rentPriceRequired')); return; }

        setLoading(true);
        try {
            const photos = media.filter(m => m.type === 'image' && m.uploadUrl).map(m => m.uploadUrl!);
            const videos = media.filter(m => m.type === 'video' && m.uploadUrl).map(m => m.uploadUrl!);
            const payload: any = {
                service_id: serviceId, titre: formData.titre.trim(),
                description: formData.description.trim() || null, type_bien: formData.type_bien,
                statut: formData.statut, adresse: formData.adresse.trim() || null,
                quartier: formData.quartier?.raw || formData.quartier?.place_name || null,
                ville: formData.ville?.raw || formData.ville?.place_name || null,
                gps: selectedGPS || (location ? `${location.coords.latitude},${location.coords.longitude}` : null),
                superficie_m2: formData.superficie_m2 ? parseFloat(formData.superficie_m2) : null,
                nb_chambres: formData.nb_chambres ? parseInt(formData.nb_chambres) : null,
                nb_salles_bain: formData.nb_salles_bain ? parseInt(formData.nb_salles_bain) : null,
                standing: formData.standing || null, etat_general: formData.etat_general || null,
                prix_vente: formData.prix_vente ? parseFloat(formData.prix_vente) : null,
                prix_location_mensuel: formData.prix_location_mensuel ? parseFloat(formData.prix_location_mensuel) : null,
                photos: photos.length > 0 ? photos : null, videos: videos.length > 0 ? videos : null,
            };
            let resp;
            if (mode === 'edit' && propertyId) {
                resp = await apiPut(`/api/immobilier/biens/${propertyId}`, payload);
            } else {
                resp = await immobilierService.createProperty(payload);
            }
            if (resp.success) {
                await clearSavedFormData(STORAGE_KEY);
                Alert.alert(t('message.success'), mode === 'edit' ? t('immobilierForm.propertyUpdated') : t('immobilierForm.propertyCreated'), [{ text: 'OK', onPress: () => navigation.goBack() }]);
            } else { Alert.alert(t('message.error'), (resp as any).error || t('immobilierForm.cannotSave')); }
        } catch (e: any) { Alert.alert(t('message.error'), e.message || t('immobilierForm.genericError')); } finally { setLoading(false); }
    };

    const formatLabel = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    // ─── RENDER ──────────────────────────────────────────────────────────
    return (
        <View style={st.container}>
            {/* Header */}
            <LinearGradient colors={['#7C3AED', '#A855F7']} style={st.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={st.backBtn}>
                    <SafeIcon name="arrow-left" size={24} color="#fff" />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={st.headerTitle}>{mode === 'edit' ? t('immobilierFormScreen.modifierLeBien') : t('immobilierForm.nouveauBienImmobilier')}</Text>
                    <Text style={st.headerSub}>{formData.type_bien ? formatLabel(formData.type_bien) : 'Maison'} · {formatLabel(formData.statut)}</Text>
                </View>
            </LinearGradient>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
                {/* Section: Informations */}
                <View style={st.section}>
                    <View style={st.sectionHdr}><SafeIcon name="file-text" size={18} color="#7C3AED" /><Text style={st.sectionTitle}>{t('immobilierForm.informationsGenerales')}</Text></View>
                    <View style={st.field}><NativeInput label={`${t('immobilierForm.titre')} *`} value={formData.titre} onChangeText={v => setFormData({ ...formData, titre: v })} placeholder={t('immobilierForm.titrePlaceholder')} /></View>
                    <View style={st.field}><NativeInput label={`${t('immobilierForm.description')} *`} value={formData.description} onChangeText={v => setFormData({ ...formData, description: v })} placeholder={t('immobilierForm.descriptionDetailleeDuBien')} multiline style={{ minHeight: 100, textAlignVertical: 'top' }} /></View>
                </View>

                {/* Section: Type & Statut */}
                <View style={st.section}>
                    <View style={st.sectionHdr}><SafeIcon name="home" size={18} color="#7C3AED" /><Text style={st.sectionTitle}>{t('immobilierForm.typeEtStatut')}</Text></View>
                    <Text style={st.label}>{t('immobilierForm.typeDeBien')}</Text>
                    <View style={st.typeGrid}>
                        {TYPES_BIEN.map(t => (
                            <TouchableOpacity key={t.key} style={[st.typeCard, formData.type_bien === t.key && st.typeCardOn]} onPress={() => setFormData({ ...formData, type_bien: t.key })}>
                                <SafeIcon name={t.icon as any} size={20} color={formData.type_bien === t.key ? '#fff' : '#6B7280'} />
                                <Text style={[st.typeText, formData.type_bien === t.key && st.typeTextOn]}>{t.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <Text style={[st.label, { marginTop: 16 }]}>{t('immobilierForm.statut')} *</Text>
                    <View style={st.statutRow}>
                        {STATUTS.map(s => (
                            <TouchableOpacity key={s.key} style={[st.statutBtn, formData.statut === s.key && st.statutBtnOn]} onPress={() => setFormData({ ...formData, statut: s.key })}>
                                <SafeIcon name={s.icon as any} size={16} color={formData.statut === s.key ? '#fff' : '#6B7280'} />
                                <Text style={[st.statutText, formData.statut === s.key && st.statutTextOn]}>{s.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Section: Localisation */}
                <View style={st.section}>
                    <View style={st.sectionHdr}><SafeIcon name="map-pin" size={18} color="#7C3AED" /><Text style={st.sectionTitle}>{t('immobilierForm.localisation')}</Text></View>
                    <View style={st.field}>
                        <LocationSelector label="Ville *" value={formData.ville ? (typeof formData.ville === 'string' ? { raw: formData.ville, place_name: formData.ville } : formData.ville) : ''} onSelect={(loc: LocationObject) => setFormData({ ...formData, ville: loc })} placeholder={t('immobilierForm.rechercherLaVille')} scope="all" enrichWithBackend />
                    </View>
                    <View style={st.field}>
                        <LocationSelector label={t('immobilierForm.quartier')} value={formData.quartier ? (typeof formData.quartier === 'string' ? { raw: formData.quartier, place_name: formData.quartier } : formData.quartier) : ''} onSelect={(loc: LocationObject) => setFormData({ ...formData, quartier: loc })} placeholder={t('immobilierForm.quartierRue')} scope="all" cityContext={formData.ville?.raw || formData.ville?.place_name || ''} enrichWithBackend />
                    </View>
                    <View style={st.field}>
                        <LocationSelector label={t('immobilierForm.adresseComplete')} value={formData.adresse ? { raw: formData.adresse, place_name: formData.adresse } as any : ''} onSelect={(loc: LocationObject) => {
                            setFormData(p => ({
                                ...p, adresse: loc.raw || loc.place_name || p.adresse,
                                ville: p.ville || (loc.components?.ville ? { raw: loc.components.ville, place_name: loc.components.ville } as any : p.ville),
                                quartier: p.quartier || (loc.components?.quartier ? { raw: loc.components.quartier, place_name: loc.components.quartier } as any : p.quartier),
                            }));
                            if (loc.coordinates?.lat && loc.coordinates?.lng) setSelectedGPS(`${loc.coordinates.lat},${loc.coordinates.lng}`);
                            if (loc.place_id) importGooglePlacePhotos(loc.place_id);
                        }} placeholder={t('immobilierFormScreen.adresseExacte')} scope="all" cityContext={formData.ville?.raw || formData.ville?.place_name || ''} enrichWithBackend />
                        {importingGoogleMedia && <Text style={st.hint}>📥 Import photos Google en cours...</Text>}
                    </View>
                    <TouchableOpacity style={st.gpsBtn} onPress={() => setShowGPSModal(true)}>
                        <SafeIcon name="map-pin" size={20} color={modernColors.primary} />
                        <Text style={st.gpsBtnText}>{selectedGPS ? t('immobilierFormScreen.gpsSelectionne') : t('immobilierFormScreen.selectionnerSurLaCarte')}</Text>
                        <SafeIcon name="chevron-right" size={18} color="#9CA3AF" />
                    </TouchableOpacity>
                </View>

                {/* Section: Caractéristiques */}
                <View style={st.section}>
                    <View style={st.sectionHdr}><SafeIcon name="ruler" size={18} color="#7C3AED" /><Text style={st.sectionTitle}>{t('immobilierForm.caracteristiquesPrincipales')}</Text></View>

                    {/* ✅ AMÉLIORÉ: Design plus intuitif avec icônes et labels clairs */}
                    <View style={st.characteristicsGrid}>
                        <View style={st.characteristicCard}>
                            <SafeIcon name="maximize-2" size={20} color="#7C3AED" />
                            <Text style={st.characteristicLabel}>Superficie</Text>
                            <NativeInput
                                label="Surface (m²)"
                                value={formData.superficie_m2}
                                onChangeText={t => setFormData({ ...formData, superficie_m2: t })}
                                placeholder="120"
                                keyboardType="numeric"
                                style={st.characteristicInput}
                            />
                        </View>

                        <View style={st.characteristicCard}>
                            <SafeIcon name="door-open" size={20} color="#7C3AED" />
                            <Text style={st.characteristicLabel}>Chambres</Text>
                            <NativeInput
                                label="Nb chambres"
                                value={formData.nb_chambres}
                                onChangeText={t => setFormData({ ...formData, nb_chambres: t })}
                                placeholder="3"
                                keyboardType="numeric"
                                style={st.characteristicInput}
                            />
                        </View>

                        <View style={st.characteristicCard}>
                            <SafeIcon name="droplet" size={20} color="#7C3AED" />
                            <Text style={st.characteristicLabel}>Salles bain</Text>
                            <NativeInput
                                label="Nb SDB"
                                value={formData.nb_salles_bain}
                                onChangeText={t => setFormData({ ...formData, nb_salles_bain: t })}
                                placeholder="2"
                                keyboardType="numeric"
                                style={st.characteristicInput}
                            />
                        </View>
                    </View>

                    <Text style={st.label}>{t('immobilierForm.standingDuBien')}</Text>
                    <View style={st.chips}>{STANDINGS.map(s => <TouchableOpacity key={s} style={[st.chip, formData.standing === s && st.chipOn]} onPress={() => setFormData({ ...formData, standing: s })}><Text style={[st.chipText, formData.standing === s && st.chipTextOn]}>{formatLabel(s)}</Text></TouchableOpacity>)}</View>
                    <Text style={[st.label, { marginTop: 16 }]}>{t('immobilierForm.etatGeneral')}</Text>
                    <View style={st.chips}>{ETATS.map(e => <TouchableOpacity key={e} style={[st.chip, formData.etat_general === e && st.chipOn]} onPress={() => setFormData({ ...formData, etat_general: e })}><Text style={[st.chipText, formData.etat_general === e && st.chipTextOn]}>{formatLabel(e)}</Text></TouchableOpacity>)}</View>
                </View>

                {/* Section: Prix */}
                <View style={st.section}>
                    <View style={st.sectionHdr}><SafeIcon name="banknote" size={18} color="#7C3AED" /><Text style={st.sectionTitle}>{t('immobilierForm.prix')}</Text></View>
                    {(formData.statut === 'vente' || formData.statut === 'les_deux') && (
                        <View style={st.field}><NativeInput label={`${t('immobilierFormScreen.salePrice')} (${devise}) *`} value={formData.prix_vente} onChangeText={t => setFormData({ ...formData, prix_vente: t })} placeholder="0" keyboardType="numeric" /></View>
                    )}
                    {(formData.statut === 'location' || formData.statut === 'les_deux') && (
                        <View style={st.field}><NativeInput label={`${t('immobilierFormScreen.monthlyRent')} (${devise}) *`} value={formData.prix_location_mensuel} onChangeText={t => setFormData({ ...formData, prix_location_mensuel: t })} placeholder="0" keyboardType="numeric" /></View>
                    )}
                </View>

                {/* Section: Médias */}
                <View style={st.section}>
                    <View style={st.sectionHdr}><SafeIcon name="image" size={18} color="#7C3AED" /><Text style={st.sectionTitle}>{t('immobilierForm.photosVideos')}</Text></View>
                    <MediaUploader media={media} onMediaChange={setMedia} maxImages={10} maxVideos={3} allowVideos label={t('immobilierForm.ajoutezDesPhotosEtVideos')} />
                </View>

                {/* Section: Visite virtuelle 360° */}
                {mode === 'edit' && propertyId && (
                    <View style={st.section}>
                        <View style={st.sectionHdr}>
                            <SafeIcon name="video" size={18} color="#7C3AED" />
                            <Text style={st.sectionTitle}>{t('immobilierForm.visiteVirtuelle360') || 'Visite virtuelle 360°'}</Text>
                        </View>
                        <Text style={st.hint}>
                            {t('immobilierForm.visiteVirtuelleDescription') || 'Ajoutez une visite virtuelle 360° ou un modèle 3D pour attirer plus de clients.'}
                        </Text>
                        <TouchableOpacity
                            style={st.virtualTourBtn}
                            onPress={async () => {
                                try {
                                    const result = await require('expo-image-picker').launchImageLibraryAsync({
                                        mediaTypes: ['videos'],
                                        allowsEditing: false,
                                        quality: 1,
                                    });
                                    if (!result.canceled && result.assets?.[0]) {
                                        const asset = result.assets[0];
                                        Alert.alert(
                                            t('immobilierForm.uploadEnCours') || 'Upload en cours',
                                            t('immobilierForm.uploadVisiteVirtuelle') || 'Upload de la visite virtuelle...'
                                        );
                                        const resp = await immobilierService.uploadVirtualTour(propertyId, {
                                            uri: asset.uri,
                                            type: asset.mimeType || 'video/mp4',
                                            name: asset.fileName || `virtual_tour_${Date.now()}.mp4`,
                                        });
                                        const data = (resp?.data || resp) as any;
                                        if (data?.success) {
                                            Alert.alert(
                                                t('message.success'),
                                                t('immobilierForm.visiteVirtuelleAjoutee') || 'Visite virtuelle ajoutée avec succès !'
                                            );
                                        } else {
                                            Alert.alert(t('message.error'), data?.message || t('immobilierForm.erreurUpload') || 'Erreur lors de l\'upload');
                                        }
                                    }
                                } catch (e: any) {
                                    console.error('[ImmobilierForm] Virtual tour upload:', e);
                                    Alert.alert(t('message.error'), e.message || t('immobilierForm.erreurUpload') || 'Erreur lors de l\'upload');
                                }
                            }}
                        >
                            <SafeIcon name="upload" size={20} color="#7C3AED" />
                            <Text style={st.virtualTourBtnText}>
                                {t('immobilierForm.ajouterVisiteVirtuelle') || 'Ajouter une visite virtuelle 360°'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Submit */}
                <View style={{ paddingHorizontal: 16 }}>
                    <NativeButton
                        title={loading ? t('immobilierForm.enregistrement') : mode === 'edit' ? t('immobilierFormScreen.modifierLeBien') : t('immobilierForm.publierLeBien')}
                        onPress={handleSubmit}
                        disabled={loading || !formData.titre.trim() || !serviceId || (!formData.ville && !selectedGPS)}
                        variant="primary" size="large" style={{ marginTop: 8 }}
                    />
                </View>

                {/* Sortir */}
                <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
                    <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' }}
                        onPress={() => { Alert.alert(t('common.deconnexion'), t('common.confirmDeconnexion'), [{ text: t('common.cancel'), style: 'cancel' }, { text: t('common.seDeconnecter'), style: 'destructive', onPress: logout }]); }}
                    >
                        <SafeIcon name="log-out" size={20} color="#DC2626" />
                        <Text style={{ fontSize: 15, fontWeight: '600', color: '#DC2626' }}>{t('common.sortir')}</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            <ModernGPSModal visible={showGPSModal} onClose={() => setShowGPSModal(false)} onSelect={(c: string) => { setSelectedGPS(c); setShowGPSModal(false); }} currentLocation={location ? { lat: location.coords.latitude, lng: location.coords.longitude } : null} title={t('immobilierForm.localisation')} />

            {/* Intelligent Chat FAB */}
            <IntelligentChatFab
                onPress={() => setShowChat(true)}
                visible={!showChat && !showGPSModal}
                screenName="ImmobilierForm"
            />
            <IntelligentChat
                visible={showChat}
                onClose={() => setShowChat(false)}
                screenContext={{
                    screenName: 'ImmobilierForm',
                    screenType: 'form',
                    userData: { role: user?.role, partner_type: user?.partner_type, name: user?.name },
                    serviceData: {
                        nom: formData.titre || t('immobilierForm.nouveauBienImmobilier'),
                        description: `${formData.type_bien} - ${formData.statut}`,
                    },
                }}
            />
        </View>
    );
};

// ─── STYLES ──────────────────────────────────────────────────────────────
const st = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F3F4F6' },

    // Header
    header: { paddingTop: 50, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
    backBtn: { marginRight: 12, padding: 4 },
    headerTitle: { fontSize: 22, fontWeight: '700', color: '#fff' },
    headerSub: { fontSize: 13, color: '#ffffffCC', marginTop: 2 },

    // Sections
    section: { backgroundColor: '#fff', borderRadius: 12, marginHorizontal: 16, marginTop: 12, padding: 16, elevation: 1, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
    sectionHdr: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },

    // Form
    field: { marginBottom: 16 },
    label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
    hint: { marginTop: 6, fontSize: 12, color: '#6B7280', fontStyle: 'italic' },

    // Type Grid
    typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    typeCard: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
    typeCardOn: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
    typeText: { fontSize: 13, fontWeight: '500', color: '#374151' },
    typeTextOn: { color: '#fff', fontWeight: '700' },

    // Statut
    statutRow: { flexDirection: 'row', gap: 8 },
    statutBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 10, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
    statutBtnOn: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
    statutText: { fontSize: 13, fontWeight: '500', color: '#374151' },
    statutTextOn: { color: '#fff', fontWeight: '700' },

    // GPS
    gpsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, gap: 12, marginTop: 4 },
    gpsBtnText: { flex: 1, fontSize: 14, color: '#111827' },

    // Chips
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
    chipOn: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
    chipText: { fontSize: 13, color: '#374151' },
    chipTextOn: { color: '#fff', fontWeight: '600' },

    // ✅ NOUVEAU: Caractéristiques améliorées
    characteristicsGrid: { flexDirection: 'column', gap: 16 },
    characteristicCard: {
        backgroundColor: '#FAFBFF',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12
    },
    characteristicLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        minWidth: 70,
        textAlign: 'center'
    },
    characteristicInput: {
        flex: 1,
        marginBottom: 0,
    },
    virtualTourBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        marginTop: 12,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: '#F5F3FF',
        borderWidth: 1,
        borderColor: '#DDD6FE',
    },
    virtualTourBtnText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#7C3AED',
    },
});

export default ImmobilierFormScreen;
