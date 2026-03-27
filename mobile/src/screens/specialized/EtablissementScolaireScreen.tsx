// Collecte des manuels scolaires (établissement) — source Yukpo : PDF/Excel/images, année scolaire.

import { useNavigation } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import ModernGPSModal from '../../components/ModernGPSModal';
import SafeIcon from '../../components/SafeIcon';
import { SafeNativeView } from '../../components/SafeNativeView';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { apiPost } from '../../services/api';
import { hapticPress } from '../../utils/hapticFeedback';
import { logger } from '../../utils/logger';

const NIVEAUX = [
    { id: 'maternelle', label: 'Maternelle' },
    { id: 'primaire', label: 'Primaire' },
    { id: 'college', label: 'Collège' },
    { id: 'lycee', label: 'Lycée / Secondaire' },
] as const;

interface AttachedFile {
    id: string;
    uri: string;
    name: string;
    type: 'image' | 'pdf' | 'document';
    base64?: string;
}

const EtablissementScolaireScreen: React.FC = () => {
    const navigation = useNavigation();
    const { t } = useLanguageSafe();
    const { user } = useAuth();

    const [nomEtablissement, setNomEtablissement] = useState(user?.nom_entreprise || '');
    const [pays, setPays] = useState('');
    const [ville, setVille] = useState('');
    const [niveaux, setNiveaux] = useState<Set<string>>(new Set());
    const [anneeScolaire, setAnneeScolaire] = useState('2025-2026');
    const [commentaire, setCommentaire] = useState('');
    const [files, setFiles] = useState<AttachedFile[]>([]);
    const [gpsCoords, setGpsCoords] = useState<string | null>(null);
    const [gpsAddress, setGpsAddress] = useState<string | null>(null);
    const [showGPSModal, setShowGPSModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const toggleNiveau = useCallback((id: string) => {
        setNiveaux(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    // ========================
    // Capture image (caméra)
    // ========================
    const takePhoto = useCallback(async () => {
        hapticPress();
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission requise', t('etablissementScolaire.cameraPermission', 'Veuillez autoriser l\'accès à la caméra.'));
            return;
        }
        try {
            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 0.8,
                base64: true,
            });
            if (!result.canceled && result.assets[0]) {
                const asset = result.assets[0];
                setFiles(prev => [...prev, {
                    id: `cam-${Date.now()}`,
                    uri: asset.uri,
                    name: `photo_${Date.now()}.jpg`,
                    type: 'image',
                    base64: asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : undefined,
                }]);
            }
        } catch (err) {
            logger.error('[EtablissementScolaire] Erreur photo:', err);
            Alert.alert('Erreur', t('etablissementScolaire.photoError', 'Impossible de prendre la photo.'));
        }
    }, [t]);

    // ========================
    // Galerie d'images
    // ========================
    const pickImage = useCallback(async () => {
        hapticPress();
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission requise', t('etablissementScolaire.galleryPermission', 'Veuillez autoriser l\'accès à la galerie.'));
            return;
        }
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsMultipleSelection: true,
                quality: 0.8,
                base64: true,
            });
            if (!result.canceled && result.assets.length > 0) {
                const newFiles: AttachedFile[] = result.assets.map((asset, i) => ({
                    id: `img-${Date.now()}-${i}`,
                    uri: asset.uri,
                    name: asset.fileName || `image_${Date.now()}_${i}.jpg`,
                    type: 'image' as const,
                    base64: asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : undefined,
                }));
                setFiles(prev => [...prev, ...newFiles]);
            }
        } catch (err) {
            logger.error('[EtablissementScolaire] Erreur galerie:', err);
            Alert.alert('Erreur', t('etablissementScolaire.galleryError', 'Impossible de sélectionner l\'image.'));
        }
    }, [t]);

    // ========================
    // Fichier joint (PDF, etc.)
    // ========================
    const pickDocument = useCallback(async () => {
        hapticPress();
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['application/pdf', 'image/*', 'application/vnd.ms-excel',
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
                copyToCacheDirectory: true,
                multiple: true,
            });
            if (result.canceled || !result.assets?.length) return;

            const newFiles: AttachedFile[] = [];
            for (const asset of result.assets) {
                const base64 = await FileSystem.readAsStringAsync(asset.uri, {
                    encoding: FileSystem.EncodingType.Base64,
                });
                const isImage = asset.mimeType?.startsWith('image/');
                newFiles.push({
                    id: `doc-${Date.now()}-${newFiles.length}`,
                    uri: asset.uri,
                    name: asset.name,
                    type: isImage ? 'image' : (asset.mimeType === 'application/pdf' ? 'pdf' : 'document'),
                    base64: `data:${asset.mimeType || 'application/octet-stream'};base64,${base64}`,
                });
            }
            setFiles(prev => [...prev, ...newFiles]);
        } catch (err) {
            logger.error('[EtablissementScolaire] Erreur document picker:', err);
            Alert.alert('Erreur', t('etablissementScolaire.fileError', 'Impossible de sélectionner le fichier.'));
        }
    }, [t]);

    const removeFile = useCallback((id: string) => {
        setFiles(prev => prev.filter(f => f.id !== id));
    }, []);

    // ========================
    // Soumission
    // ========================
    const handleSubmit = useCallback(async () => {
        if (!nomEtablissement.trim()) {
            Alert.alert('Champ requis', t('etablissementScolaire.nomRequired', 'Veuillez saisir le nom de l\'établissement.'));
            return;
        }
        if (niveaux.size === 0) {
            Alert.alert('Champ requis', t('etablissementScolaire.niveauRequired', 'Veuillez sélectionner au moins un niveau.'));
            return;
        }
        if (files.length === 0) {
            Alert.alert(
                'Pièce jointe requise',
                t(
                    'etablissementScolaire.fileRequired',
                    'Ajoutez au moins un document : photo (caméra ou galerie), ou fichier PDF / Excel.'
                )
            );
            return;
        }
        if (!gpsCoords && !ville.trim()) {
            Alert.alert('Localisation requise', t('etablissementScolaire.locationRequired', 'Veuillez indiquer votre position GPS ou au minimum votre ville.'));
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                nom_etablissement: nomEtablissement.trim(),
                pays: pays.trim() || undefined,
                ville: ville.trim() || undefined,
                niveaux: Array.from(niveaux),
                annee_scolaire: anneeScolaire,
                commentaire: commentaire.trim() || undefined,
                gps_coords: gpsCoords || undefined,
                gps_address: gpsAddress || undefined,
                fichiers: files.map(f => ({
                    nom: f.name,
                    type: f.type,
                    base64: f.base64,
                })),
                user_id: user?.id,
            };

            await apiPost('/api/bourse-livre/v2/programmes-scolaires/submit', payload);
            setSubmitted(true);
            hapticPress();
        } catch (err: any) {
            logger.error('[EtablissementScolaire] Erreur soumission:', err);
            Alert.alert('Erreur', err?.message || t('etablissementScolaire.submitError', 'Impossible d\'envoyer le programme. Réessayez.'));
        } finally {
            setSubmitting(false);
        }
    }, [nomEtablissement, pays, ville, niveaux, anneeScolaire, commentaire, gpsCoords, gpsAddress, files, user, t]);

    // ========================
    // Écran de succès
    // ========================
    if (submitted) {
        return (
            <SafeNativeView style={styles.container}>
                <View style={styles.successContainer}>
                    <View style={styles.successIcon}>
                        <SafeIcon name="check-circle" size={64} color="#059669" type="lucide" />
                    </View>
                    <Text style={styles.successTitle}>
                        {t('etablissementScolaire.successTitle', 'Manuels envoyés !')}
                    </Text>
                    <Text style={styles.successText}>
                        {t('etablissementScolaire.successText', 'Merci ! Vos manuels scolaires (établissement) ont été transmis. Yukpo les extrait (IA) et les ajoute au référentiel ; les librairies proches en sont informées.')}
                    </Text>
                    <TouchableOpacity
                        style={styles.successButton}
                        onPress={() => {
                            setSubmitted(false);
                            setFiles([]);
                            setNiveaux(new Set());
                            setCommentaire('');
                        }}
                    >
                        <SafeIcon name="plus" size={18} color="#fff" type="lucide" />
                        <Text style={styles.successButtonText}>
                            {t('etablissementScolaire.sendAnother', 'Envoyer une autre liste')}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.backButtonBottom}
                        onPress={() => navigation.goBack()}
                    >
                        <Text style={styles.backButtonBottomText}>
                            {t('etablissementScolaire.backToBourse', 'Retour à la bourse du livre')}
                        </Text>
                    </TouchableOpacity>
                </View>
            </SafeNativeView>
        );
    }

    // ========================
    // Formulaire principal
    // ========================
    return (
        <SafeNativeView style={styles.container}>
            <LinearGradient colors={['#059669', '#10B981', '#34D399']} style={styles.header}>
                <TouchableOpacity onPress={() => { hapticPress(); navigation.goBack(); }} style={styles.backBtn}>
                    <SafeIcon name="arrow-left" size={24} color="#fff" />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle}>
                        {t('etablissementScolaire.title', 'Établissement scolaire')}
                    </Text>
                    <Text style={styles.headerSubtitle}>
                        {t(
                            'etablissementScolaire.subtitle',
                            'Programmes & listes officielles (établissement) — caméra, galerie ou fichier (PDF, Excel, photo)'
                        )}
                    </Text>
                </View>
                <SafeIcon name="school" size={28} color="rgba(255,255,255,0.6)" type="lucide" />
            </LinearGradient>

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Info banner */}
                    <View style={styles.infoBanner}>
                        <SafeIcon name="info" size={18} color="#1D4ED8" type="lucide" />
                        <Text style={styles.infoBannerText}>
                            {t(
                                'etablissementScolaire.infoBanner',
                                'Programmes scolaires, listes de manuels ou fournitures : prenez une photo (caméra), choisissez dans la galerie, ou importez un fichier (PDF, Excel, image). Yukpo extrait les lignes par IA.'
                            )}
                        </Text>
                    </View>

                    {/* Nom de l'établissement */}
                    <Text style={styles.label}>
                        {t('etablissementScolaire.nomLabel', 'Nom de l\'établissement')} *
                    </Text>
                    <TextInput
                        style={styles.input}
                        value={nomEtablissement}
                        onChangeText={setNomEtablissement}
                        placeholder={t('etablissementScolaire.nomPlaceholder', 'Ex: Lycée Général Leclerc, École Primaire de Bonabéri...')}
                        placeholderTextColor="#9CA3AF"
                    />

                    {/* Pays & Ville */}
                    <View style={styles.row}>
                        <View style={styles.halfField}>
                            <Text style={styles.label}>
                                {t('etablissementScolaire.paysLabel', 'Pays')}
                            </Text>
                            <TextInput
                                style={styles.input}
                                value={pays}
                                onChangeText={setPays}
                                placeholder="Ex: Cameroun"
                                placeholderTextColor="#9CA3AF"
                            />
                        </View>
                        <View style={styles.halfField}>
                            <Text style={styles.label}>
                                {t('etablissementScolaire.villeLabel', 'Ville')}
                            </Text>
                            <TextInput
                                style={styles.input}
                                value={ville}
                                onChangeText={setVille}
                                placeholder="Ex: Douala"
                                placeholderTextColor="#9CA3AF"
                            />
                        </View>
                    </View>

                    {/* Localisation GPS */}
                    <Text style={styles.label}>
                        {t('etablissementScolaire.gpsLabel', 'Localisation GPS')}
                    </Text>
                    <TouchableOpacity
                        style={[styles.gpsButton, gpsCoords && styles.gpsButtonActive]}
                        onPress={() => setShowGPSModal(true)}
                    >
                        <SafeIcon name="map-pin" size={18} color={gpsCoords ? '#059669' : '#6B7280'} type="lucide" />
                        <Text style={[styles.gpsButtonText, gpsCoords && styles.gpsButtonTextActive]}>
                            {gpsCoords
                                ? (gpsAddress || t('etablissementScolaire.positionEnregistree', 'Position enregistrée'))
                                : t('etablissementScolaire.choisirPosition', 'Choisir ma position sur la carte')}
                        </Text>
                    </TouchableOpacity>

                    {/* Niveaux */}
                    <Text style={styles.label}>
                        {t('etablissementScolaire.niveauxLabel', 'Niveaux concernés')} *
                    </Text>
                    <View style={styles.niveauxGrid}>
                        {NIVEAUX.map(n => (
                            <TouchableOpacity
                                key={n.id}
                                style={[styles.niveauChip, niveaux.has(n.id) && styles.niveauChipActive]}
                                onPress={() => toggleNiveau(n.id)}
                            >
                                <Text style={[styles.niveauChipText, niveaux.has(n.id) && styles.niveauChipTextActive]}>
                                    {n.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Année scolaire */}
                    <Text style={styles.label}>
                        {t('etablissementScolaire.anneeLabel', 'Année scolaire')}
                    </Text>
                    <TextInput
                        style={styles.input}
                        value={anneeScolaire}
                        onChangeText={setAnneeScolaire}
                        placeholder="2025-2026"
                        placeholderTextColor="#9CA3AF"
                    />

                    {/* Pièces jointes */}
                    <Text style={styles.label}>
                        {t(
                            'etablissementScolaire.fichiersLabel',
                            'Programmes / listes — caméra, galerie ou import fichier (PDF, Excel, photo)'
                        )}{' '}
                        *
                    </Text>
                    <View style={styles.attachActions}>
                        <TouchableOpacity style={styles.attachBtn} onPress={takePhoto}>
                            <SafeIcon name="camera" size={20} color="#fff" type="lucide" />
                            <Text style={styles.attachBtnText}>
                                {t('etablissementScolaire.camera', 'Caméra')}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.attachBtn, styles.attachBtnGallery]} onPress={pickImage}>
                            <SafeIcon name="image" size={20} color="#fff" type="lucide" />
                            <Text style={styles.attachBtnText}>
                                {t('etablissementScolaire.galerie', 'Galerie')}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.attachBtn, styles.attachBtnFile]} onPress={pickDocument}>
                            <SafeIcon name="paperclip" size={20} color="#fff" type="lucide" />
                            <Text style={styles.attachBtnText}>
                                {t('etablissementScolaire.fichier', 'Fichier')}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Aperçu fichiers */}
                    {files.length > 0 && (
                        <View style={styles.filesPreview}>
                            <Text style={styles.filesCount}>
                                {files.length} {files.length === 1 ? 'fichier joint' : 'fichiers joints'}
                            </Text>
                            {files.map(f => (
                                <View key={f.id} style={styles.fileRow}>
                                    {f.type === 'image' ? (
                                        <Image source={{ uri: f.uri }} style={styles.fileThumbnail} />
                                    ) : (
                                        <View style={styles.fileIconContainer}>
                                            <SafeIcon
                                                name={f.type === 'pdf' ? 'file-text' : 'file'}
                                                size={24}
                                                color="#6B7280"
                                                type="lucide"
                                            />
                                        </View>
                                    )}
                                    <Text style={styles.fileName} numberOfLines={1}>{f.name}</Text>
                                    <TouchableOpacity
                                        onPress={() => removeFile(f.id)}
                                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                    >
                                        <SafeIcon name="x" size={18} color="#EF4444" type="lucide" />
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>
                    )}

                    {/* Commentaire */}
                    <Text style={styles.label}>
                        {t('etablissementScolaire.commentaireLabel', 'Commentaire (optionnel)')}
                    </Text>
                    <TextInput
                        style={[styles.input, styles.textArea]}
                        value={commentaire}
                        onChangeText={setCommentaire}
                        placeholder={t('etablissementScolaire.commentairePlaceholder', 'Précisions sur les classes, le système éducatif, etc.')}
                        placeholderTextColor="#9CA3AF"
                        multiline
                        numberOfLines={3}
                        textAlignVertical="top"
                    />

                    {/* Bouton envoyer */}
                    <TouchableOpacity
                        style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                        onPress={handleSubmit}
                        disabled={submitting}
                        activeOpacity={0.85}
                    >
                        {submitting ? (
                            <ActivityIndicator color="#fff" size="small" />
                        ) : (
                            <>
                                <SafeIcon name="send" size={20} color="#fff" type="lucide" />
                                <Text style={styles.submitButtonText}>
                                    {t('etablissementScolaire.submit', 'Envoyer le référentiel')}
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>

                    <View style={{ height: 40 }} />
                </ScrollView>
            </KeyboardAvoidingView>

            <ModernGPSModal
                visible={showGPSModal}
                onClose={() => setShowGPSModal(false)}
                onSelect={(coords: string) => {
                    setGpsCoords(coords);
                    setShowGPSModal(false);
                }}
                onSelectLocation={(loc) => {
                    setGpsCoords(`${loc.latitude},${loc.longitude}`);
                    const placeLabel = loc.placeName || loc.address || '';
                    setGpsAddress(loc.address || loc.placeName || null);
                    if (placeLabel && !nomEtablissement.trim()) {
                        setNomEtablissement(placeLabel);
                    }
                    setShowGPSModal(false);
                }}
            />
        </SafeNativeView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 20,
        paddingBottom: 18,
        paddingHorizontal: 16,
        gap: 12,
    },
    backBtn: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
    headerSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
    scrollView: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: 32 },
    infoBanner: {
        flexDirection: 'row', gap: 10, backgroundColor: '#EFF6FF',
        borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 12,
        padding: 14, marginBottom: 20, alignItems: 'flex-start',
    },
    infoBannerText: { flex: 1, fontSize: 13, color: '#1E40AF', lineHeight: 19 },
    label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 16 },
    input: {
        backgroundColor: '#fff', borderWidth: 1, borderColor: '#D1D5DB',
        borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
        fontSize: 15, color: '#111827',
    },
    textArea: { minHeight: 80, textAlignVertical: 'top' },
    row: { flexDirection: 'row', gap: 12 },
    halfField: { flex: 1 },
    gpsButton: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        backgroundColor: '#fff', borderWidth: 1, borderColor: '#D1D5DB',
        borderRadius: 10, padding: 14, borderStyle: 'dashed',
    },
    gpsButtonActive: { borderColor: '#059669', borderStyle: 'solid', backgroundColor: '#ECFDF5' },
    gpsButtonText: { flex: 1, fontSize: 14, color: '#6B7280' },
    gpsButtonTextActive: { color: '#059669', fontWeight: '600' },
    niveauxGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    niveauChip: {
        paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
        backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#D1D5DB',
    },
    niveauChipActive: { backgroundColor: '#059669', borderColor: '#059669' },
    niveauChipText: { fontSize: 13, fontWeight: '600', color: '#4B5563' },
    niveauChipTextActive: { color: '#fff' },
    attachActions: { flexDirection: 'row', gap: 10 },
    attachBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 6, backgroundColor: '#059669', borderRadius: 10, paddingVertical: 14,
    },
    attachBtnGallery: { backgroundColor: '#2563EB' },
    attachBtnFile: { backgroundColor: '#7C3AED' },
    attachBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
    filesPreview: { marginTop: 12, gap: 8 },
    filesCount: { fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 4 },
    fileRow: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        backgroundColor: '#fff', borderRadius: 10, padding: 10,
        borderWidth: 1, borderColor: '#E5E7EB',
    },
    fileThumbnail: { width: 48, height: 48, borderRadius: 8, backgroundColor: '#F3F4F6' },
    fileIconContainer: {
        width: 48, height: 48, borderRadius: 8, backgroundColor: '#F3F4F6',
        alignItems: 'center', justifyContent: 'center',
    },
    fileName: { flex: 1, fontSize: 13, color: '#374151' },
    submitButton: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 10, backgroundColor: '#059669', borderRadius: 12, paddingVertical: 16,
        marginTop: 24, shadowColor: '#059669', shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
    },
    submitButtonDisabled: { opacity: 0.6 },
    submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    successContainer: {
        flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32,
    },
    successIcon: { marginBottom: 20 },
    successTitle: { fontSize: 24, fontWeight: '700', color: '#059669', marginBottom: 12 },
    successText: { fontSize: 15, color: '#4B5563', textAlign: 'center', lineHeight: 22, marginBottom: 32 },
    successButton: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: '#059669', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 24,
    },
    successButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
    backButtonBottom: { marginTop: 16, paddingVertical: 12 },
    backButtonBottomText: { color: '#6B7280', fontSize: 14, fontWeight: '500' },
});

export default EtablissementScolaireScreen;
