// ✅ V2: Écran d'upload de livres scolaires - Recto/Verso guidé avec analyse IA progressive
// Flux: GPS obligatoire → Session → Boucle (Photo Recto → Photo Verso → Analyse IA) → Terminer → Récap

import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    FlatList,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import ModernGPSModal from '../../components/ModernGPSModal';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton } from '../../components/SafeNativeDesign';
import { useToaster } from '../../components/ToasterProvider';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation } from '../../contexts/LocationContext';
import {
    AnalyzedBook,
    bourseLivreV2Api,
    UploadSession,
} from '../../services/bourseLivreV2Api';
import { modernColors } from '../../theme/modernTheme';
import { hapticPress } from '../../utils/hapticFeedback';
import { useLanguageSafe } from '../../contexts/LanguageContext';

type UploadStep = 'gps' | 'recto' | 'verso' | 'analyzing' | 'result' | 'list';

interface BookEntry {
    id: number;
    titre: string;
    etat_classification: string;
    valeur_calculee: number;
    is_rejected: boolean;
    classe_actuelle?: string;
    classe_souhaitee?: string;
    niveau?: string;
    matiere?: string;
    image_recto_uri: string;
    image_verso_uri: string;
    confidence: number;
}

const ETAT_COLORS: Record<string, string> = {
    bon: '#22c55e',
    acceptable: '#f59e0b',
    rejete: '#ef4444',
};

const ETAT_LABELS: Record<string, string> = {
    bon: t('bookUploadV2Screen.bonEtat'),
    acceptable: 'Acceptable',
    rejete: t('bookUploadV2Screen.rejete'),
};

const BookUploadV2Screen: React.FC = () => {
    const navigation = useNavigation() as any;
    const { user } = useAuth();
    const { location } = useLocation();
    const toaster = useToaster();
    const { t } = useLanguageSafe();

    // States
    const [step, setStep] = useState<UploadStep>('gps');
    const [session, setSession] = useState<UploadSession | null>(null);
    const [gpsCoords, setGpsCoords] = useState<string | null>(null);
    const [gpsAddress, setGpsAddress] = useState<string | null>(null);
    const [showGPSModal, setShowGPSModal] = useState(false);

    // Current book being photographed
    const [rectoUri, setRectoUri] = useState<string | null>(null);
    const [rectoBase64, setRectoBase64] = useState<string | null>(null);
    const [versoUri, setVersoUri] = useState<string | null>(null);
    const [versoBase64, setVersoBase64] = useState<string | null>(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [currentResult, setCurrentResult] = useState<AnalyzedBook | null>(null);

    // All books in session
    const [books, setBooks] = useState<BookEntry[]>([]);
    const [totalValue, setTotalValue] = useState(0);

    // Animation
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (analyzing) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 1.2, duration: 600, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
                ])
            ).start();
        } else {
            pulseAnim.setValue(1);
        }
    }, [analyzing]);

    // Auto-fill GPS from device location
    useEffect(() => {
        if (location?.coords && !gpsCoords) {
            const coords = `${location.coords.latitude},${location.coords.longitude}`;
            setGpsCoords(coords);
        }
    }, [location]);

    // ============================
    // GPS STEP
    // ============================

    const handleGPSConfirm = useCallback(async (coordinates: string, address?: string) => {
        setGpsCoords(coordinates);
        setGpsAddress(address || null);
        setShowGPSModal(false);

        try {
            const sess = await bourseLivreV2Api.createSession(
                coordinates,
                address || undefined,
                'troc'
            );
            setSession(sess);
            setStep('recto');
            toaster.show(t('bookUploadV2Screen.sessionCreeePrenezLaPhotoRecto'), 'success');
        } catch (error: any) {
            console.error('[BookUploadV2] Erreur création session:', error);
            Alert.alert('Erreur', 'Impossible de créer la session. Réessayez.');
        }
    }, [toaster]);

    // ============================
    // CAMERA
    // ============================

    const takePhoto = useCallback(async (side: 'recto' | 'verso') => {
        hapticPress();
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission requise', "Veuillez autoriser l'accès à la caméra pour photographier vos livres.");
            return;
        }

        try {
            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                quality: 0.8,
                base64: true,
            });

            if (!result.canceled && result.assets[0]) {
                const asset = result.assets[0];
                const base64 = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : null;

                if (side === 'recto') {
                    setRectoUri(asset.uri);
                    setRectoBase64(base64);
                    setStep('verso');
                    toaster.show(t('bookUploadV2Screen.rectoCaptureRetournezLeLivreEt'), 'info');
                } else {
                    setVersoUri(asset.uri);
                    setVersoBase64(base64);
                    // Auto-launch analysis
                    analyzeBook(rectoBase64!, base64!);
                }
            }
        } catch (error: any) {
            console.error(`[BookUploadV2] Erreur photo ${side}:`, error);
            Alert.alert('Erreur', 'Impossible de prendre la photo. Réessayez.');
        }
    }, [rectoBase64, session, toaster]);

    // ============================
    // ANALYSIS
    // ============================

    const analyzeBook = useCallback(async (recto: string, verso: string) => {
        if (!session) return;

        setStep('analyzing');
        setAnalyzing(true);

        try {
            const result = await bourseLivreV2Api.analyzeRectoVerso(
                recto,
                verso,
                session.id,
                location?.coords?.latitude,
                location?.coords?.longitude
            );

            setCurrentResult(result);
            setAnalyzing(false);
            setStep('result');

            // Add to list
            const entry: BookEntry = {
                id: result.livre?.id || Date.now(),
                titre: result.analysis?.titre || result.livre?.titre || t('bookUploadV2.livreScolaire'),
                etat_classification: result.etat_classification,
                valeur_calculee: result.valeur_calculee,
                is_rejected: result.is_rejected,
                classe_actuelle: result.analysis?.classe_actuelle || result.livre?.classe_actuelle,
                classe_souhaitee: result.analysis?.classe_souhaitee || result.livre?.classe_souhaitee,
                niveau: result.analysis?.niveau || result.livre?.niveau,
                matiere: result.analysis?.matiere || result.livre?.matiere,
                image_recto_uri: rectoUri!,
                image_verso_uri: versoUri || '',
                confidence: result.analysis?.confidence || 0,
            };

            setBooks(prev => [...prev, entry]);
            if (!result.is_rejected) {
                setTotalValue(prev => prev + result.valeur_calculee);
            }

            if (result.is_rejected) {
                toaster.show('Ce livre est rejeté (trop dégradé). Valeur: 0 XAF', 'error');
            } else {
                toaster.show(
                    t('bookUploadV2Screen.analyseEtatValeurXaf', { entry_titre: entry.titre, ETAT_LABELS[result_etat_classification]: ETAT_LABELS[result.etat_classification], Math_round(result_valeur_calculee): Math.round(result.valeur_calculee) }),
                    'success'
                );
            }
        } catch (error: any) {
            console.error('[BookUploadV2] Erreur analyse:', error);
            setAnalyzing(false);
            setStep('recto');
            Alert.alert('Erreur analyse', "L'IA n'a pas pu analyser ce livre. Réessayez avec des photos plus nettes.");
        }
    }, [session, location, rectoUri, versoUri, toaster]);

    // ============================
    // NEXT / FINISH
    // ============================

    const handleNextBook = useCallback(() => {
        setRectoUri(null);
        setRectoBase64(null);
        setVersoUri(null);
        setVersoBase64(null);
        setCurrentResult(null);
        setStep('recto');
    }, []);

    const handleFinish = useCallback(() => {
        if (books.length === 0) {
            Alert.alert('Aucun livre', 'Photographiez au moins un livre avant de terminer.');
            return;
        }
        setStep('list');
    }, [books]);

    const handleGoToRecap = useCallback(() => {
        if (!session) return;
        navigation.navigate('BookRecapV2', {
            sessionId: session.id,
            books,
            totalValue,
            gpsCoords,
            gpsAddress,
        });
    }, [session, books, totalValue, gpsCoords, gpsAddress, navigation]);

    // ============================
    // RENDERS
    // ============================

    const renderGPSStep = () => (
        <View style={styles.centerContainer}>
            <SafeIcon name="map-pin" size={64} color={modernColors.primary} />
            <Text style={styles.stepTitle}>{t('bookUploadV2.localisationObligatoire')}</Text>
            <Text style={styles.stepSubtitle}>
                Indiquez où le coursier peut récupérer vos livres
            </Text>

            {gpsCoords ? (
                <View style={styles.gpsConfirmed}>
                    <SafeIcon name="check-circle" size={24} color="#22c55e" />
                    <Text style={styles.gpsText}>Position: {gpsCoords.substring(0, 20)}...</Text>
                    {gpsAddress && <Text style={styles.gpsAddress}>{gpsAddress}</Text>}
                </View>
            ) : null}

            <NativeButton
                title={gpsCoords ? t('bookUploadV2Screen.modifierLaPosition') : 'Choisir ma position'}
                onPress={() => setShowGPSModal(true)}
                style={styles.gpsButton}
            />

            {gpsCoords && (
                <NativeButton
                    title="Commencer les photos"
                    onPress={() => handleGPSConfirm(gpsCoords, gpsAddress || undefined)}
                    style={[styles.gpsButton, { backgroundColor: modernColors.primary }]}
                />
            )}

            <ModernGPSModal
                visible={showGPSModal}
                onClose={() => setShowGPSModal(false)}
                onSelect={(coords: string) => {
                    setGpsCoords(coords);
                    setShowGPSModal(false);
                }}
            />
        </View>
    );

    const renderCameraStep = (side: 'recto' | 'verso') => (
        <View style={styles.centerContainer}>
            <View style={styles.cameraGuide}>
                <SafeIcon
                    name={side === 'recto' ? 'book-open' : 'rotate-ccw'}
                    size={80}
                    color={modernColors.primary}
                />
                <Text style={styles.cameraTitle}>
                    {side === 'recto' ? 'Photo RECTO' : 'Photo VERSO'}
                </Text>
                <Text style={styles.cameraSubtitle}>
                    {side === 'recto'
                        ? 'Photographiez la couverture avant du livre'
                        : t('bookUploadV2Screen.retournezLeLivreEtPhotographiezLe')}
                </Text>
            </View>

            {/* Preview if photo taken */}
            {side === 'recto' && rectoUri && (
                <Image source={{ uri: rectoUri }} style={styles.previewImage} />
            )}
            {side === 'verso' && versoUri && (
                <Image source={{ uri: versoUri }} style={styles.previewImage} />
            )}

            <NativeButton
                title={`Prendre la photo ${side.toUpperCase()}`}
                onPress={() => takePhoto(side)}
                style={[styles.cameraButton, { backgroundColor: modernColors.primary }]}
            />

            {/* Counter */}
            <View style={styles.counterBar}>
                <Text style={styles.counterText}>
                    {books.length} livre{books.length > 1 ? 's' : ''} analysé{books.length > 1 ? 's' : ''}
                </Text>
                {books.length > 0 && (
                    <TouchableOpacity onPress={handleFinish} style={styles.finishMiniBtn}>
                        <Text style={styles.finishMiniBtnText}>Terminer</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );

    const renderAnalyzingStep = () => (
        <View style={styles.centerContainer}>
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <SafeIcon name="cpu" size={80} color={modernColors.primary} />
            </Animated.View>
            <Text style={styles.analyzingTitle}>Analyse IA en cours...</Text>
            <Text style={styles.analyzingSubtitle}>
                Extraction du titre, auteur, prix, état du livre{'\n'}
                depuis les photos recto et verso
            </Text>
            <ActivityIndicator size="large" color={modernColors.primary} style={{ marginTop: 20 }} />

            <View style={styles.analyzingImages}>
                {rectoUri && <Image source={{ uri: rectoUri }} style={styles.analyzingThumb} />}
                {versoUri && <Image source={{ uri: versoUri }} style={styles.analyzingThumb} />}
            </View>
        </View>
    );

    const renderResultStep = () => {
        if (!currentResult) return null;
        const { analysis, valeur_calculee, etat_classification, is_rejected } = currentResult;
        const color = ETAT_COLORS[etat_classification] || '#f59e0b';

        return (
            <View style={styles.resultContainer}>
                <View style={[styles.resultBadge, { backgroundColor: color }]}>
                    <SafeIcon
                        name={is_rejected ? 'x-circle' : 'check-circle'}
                        size={32}
                        color="#fff"
                    />
                    <Text style={styles.resultBadgeText}>
                        {is_rejected ? t('bookUploadV2Screen.rejete') : ETAT_LABELS[etat_classification]?.toUpperCase()}
                    </Text>
                </View>

                <Text style={styles.resultTitle}>{analysis?.titre || t('bookUploadV2.livreScolaire')}</Text>

                <View style={styles.resultDetails}>
                    {analysis?.auteur && (
                        <DetailRow icon="user" label="Auteur" value={analysis.auteur} />
                    )}
                    {analysis?.matiere && (
                        <DetailRow icon="book" label={t('bookUploadV2.matiere')} value={analysis.matiere} />
                    )}
                    {analysis?.niveau && (
                        <DetailRow icon="layers" label="Niveau scolaire" value={analysis.niveau} />
                    )}
                    {analysis?.classe_actuelle && (
                        <DetailRow icon="hash" label="Classe du livre" value={analysis.classe_actuelle} />
                    )}
                    {analysis?.classe_souhaitee && (
                        <DetailRow icon="arrow-up-circle" label={t('bookUploadV2.classeVisee')} value={analysis.classe_souhaitee} highlight />
                    )}
                    {analysis?.prix_detecte != null && (
                        <DetailRow
                            icon="tag"
                            label={t('bookUploadV2.prixDetecte')}
                            value={`${analysis.prix_detecte} ${analysis.devise_detectee || 'XAF'}`}
                        />
                    )}
                    <DetailRow
                        icon="dollar-sign"
                        label={t('bookUploadV2.valeurCalculee')}
                        value={is_rejected ? '0 XAF' : `${Math.round(valeur_calculee)} XAF`}
                        highlight={!is_rejected}
                    />
                    {analysis?.est_au_programme && (
                        <DetailRow icon="award" label="Programme" value="Au programme scolaire officiel" highlight />
                    )}
                </View>

                <Text style={styles.confidenceText}>
                    Confiance IA: {Math.round((analysis?.confidence || 0) * 100)}%
                </Text>

                <View style={styles.resultActions}>
                    <NativeButton
                        title="Livre suivant"
                        onPress={handleNextBook}
                        style={[styles.actionBtn, { backgroundColor: modernColors.primary }]}
                    />
                    <NativeButton
                        title={`Terminer (${books.length} livre${books.length > 1 ? 's' : ''})`}
                        onPress={handleFinish}
                        style={[styles.actionBtn, { backgroundColor: '#6b7280' }]}
                    />
                </View>
            </View>
        );
    };

    const renderListStep = () => (
        <View style={styles.listContainer}>
            <Text style={styles.listTitle}>
                {books.length} livre{books.length > 1 ? 's' : ''} analysé{books.length > 1 ? 's' : ''}
            </Text>
            <Text style={styles.listSubtitle}>
                Valeur totale: {Math.round(totalValue)} XAF
            </Text>

            <FlatList
                data={books}
                keyExtractor={(item) => String(item.id)}
                renderItem={({ item }) => (
                    <View style={[styles.bookItem, item.is_rejected && styles.bookItemRejected]}>
                        <Image source={{ uri: item.image_recto_uri }} style={styles.bookThumb} />
                        <View style={styles.bookInfo}>
                            <Text style={styles.bookTitle} numberOfLines={1}>{item.titre}</Text>
                            <Text style={styles.bookMeta}>
                                {item.niveau ? `${item.niveau} — ` : ''}{item.classe_actuelle} • {item.matiere}
                            </Text>
                            {item.classe_souhaitee ? (
                                <Text style={styles.bookClasseVisee}>→ Classe visée : {item.classe_souhaitee}</Text>
                            ) : null}
                            <View style={styles.bookValueRow}>
                                <View style={[styles.etatDot, { backgroundColor: ETAT_COLORS[item.etat_classification] }]} />
                                <Text style={styles.etatText}>{ETAT_LABELS[item.etat_classification]}</Text>
                                <Text style={styles.bookValue}>
                                    {item.is_rejected ? '0' : Math.round(item.valeur_calculee)} XAF
                                </Text>
                            </View>
                        </View>
                    </View>
                )}
                style={styles.bookList}
            />

            <View style={styles.listActions}>
                <NativeButton
                    title={t('bookUploadV2.ajouterUnLivre')}
                    onPress={handleNextBook}
                    style={[styles.actionBtn, { backgroundColor: '#6b7280' }]}
                />
                <NativeButton
                    title={t('bookUploadV2.continuerVersLeRecap')}
                    onPress={handleGoToRecap}
                    style={[styles.actionBtn, { backgroundColor: modernColors.primary }]}
                />
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            {/* Progress bar */}
            <View style={styles.progressBar}>
                {['GPS', 'Photos', 'Analyse', 'Récap'].map((label, i) => {
                    const stepIdx = step === 'gps' ? 0 : step === 'recto' || step === 'verso' ? 1 : step === 'analyzing' || step === 'result' ? 2 : 3;
                    const active = i <= stepIdx;
                    return (
                        <View key={label} style={styles.progressStep}>
                            <View style={[styles.progressDot, active && styles.progressDotActive]} />
                            <Text style={[styles.progressLabel, active && styles.progressLabelActive]}>{label}</Text>
                        </View>
                    );
                })}
            </View>

            {step === 'gps' && renderGPSStep()}
            {step === 'recto' && renderCameraStep('recto')}
            {step === 'verso' && renderCameraStep('verso')}
            {step === 'analyzing' && renderAnalyzingStep()}
            {step === 'result' && renderResultStep()}
            {step === 'list' && renderListStep()}
        </View>
    );
};

const DetailRow: React.FC<{ icon: string; label: string; value: string; highlight?: boolean }> = ({
    icon, label, value, highlight
}) => (
    <View style={styles.detailRow}>
        <SafeIcon name={icon} size={16} color={highlight ? modernColors.primary : '#6b7280'} />
        <Text style={styles.detailLabel}>{label}:</Text>
        <Text style={[styles.detailValue, highlight && { color: modernColors.primary, fontWeight: '700' }]}>
            {value}
        </Text>
    </View>
);

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    progressBar: {
        flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 12,
        paddingHorizontal: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
    },
    progressStep: { alignItems: 'center' },
    progressDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#d1d5db' },
    progressDotActive: { backgroundColor: modernColors.primary },
    progressLabel: { fontSize: 11, color: '#9ca3af', marginTop: 4 },
    progressLabelActive: { color: modernColors.primary, fontWeight: '600' },

    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
    stepTitle: { fontSize: 22, fontWeight: '700', color: '#1f2937', marginTop: 16, textAlign: 'center' },
    stepSubtitle: { fontSize: 14, color: '#6b7280', marginTop: 8, textAlign: 'center', lineHeight: 20 },

    gpsConfirmed: { flexDirection: 'row', alignItems: 'center', marginTop: 16, padding: 12, backgroundColor: '#f0fdf4', borderRadius: 8, flexWrap: 'wrap' },
    gpsText: { fontSize: 14, color: '#166534', marginLeft: 8 },
    gpsAddress: { fontSize: 12, color: '#4ade80', marginLeft: 32, marginTop: 4, width: '100%' },
    gpsButton: { marginTop: 16, minWidth: 200 },

    cameraGuide: { alignItems: 'center', marginBottom: 24 },
    cameraTitle: { fontSize: 24, fontWeight: '700', color: '#1f2937', marginTop: 12 },
    cameraSubtitle: { fontSize: 14, color: '#6b7280', marginTop: 8, textAlign: 'center', lineHeight: 20 },
    previewImage: { width: 200, height: 260, borderRadius: 12, marginBottom: 16, borderWidth: 2, borderColor: modernColors.primary },
    cameraButton: { marginTop: 16, minWidth: 250, paddingVertical: 14 },

    counterBar: {
        position: 'absolute', bottom: 20, left: 16, right: 16,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        backgroundColor: '#fff', borderRadius: 12, padding: 12,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
    },
    counterText: { fontSize: 14, fontWeight: '600', color: '#374151' },
    finishMiniBtn: { backgroundColor: modernColors.primary, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
    finishMiniBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },

    analyzingTitle: { fontSize: 22, fontWeight: '700', color: '#1f2937', marginTop: 24 },
    analyzingSubtitle: { fontSize: 14, color: '#6b7280', marginTop: 8, textAlign: 'center', lineHeight: 20 },
    analyzingImages: { flexDirection: 'row', marginTop: 24, gap: 12 },
    analyzingThumb: { width: 100, height: 130, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb' },

    resultContainer: { flex: 1, padding: 20 },
    resultBadge: {
        flexDirection: 'row', alignItems: 'center', alignSelf: 'center',
        paddingHorizontal: 20, paddingVertical: 10, borderRadius: 24, marginBottom: 16,
    },
    resultBadgeText: { color: '#fff', fontWeight: '700', fontSize: 16, marginLeft: 8 },
    resultTitle: { fontSize: 20, fontWeight: '700', color: '#1f2937', textAlign: 'center', marginBottom: 16 },
    resultDetails: { backgroundColor: '#fff', borderRadius: 12, padding: 16, gap: 10 },
    confidenceText: { textAlign: 'center', fontSize: 12, color: '#9ca3af', marginTop: 12 },
    resultActions: { flexDirection: 'row', gap: 12, marginTop: 24, justifyContent: 'center' },
    actionBtn: { flex: 1, paddingVertical: 14 },

    detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    detailLabel: { fontSize: 13, color: '#6b7280', width: 90 },
    detailValue: { fontSize: 14, color: '#1f2937', fontWeight: '500', flex: 1 },

    listContainer: { flex: 1, padding: 16 },
    listTitle: { fontSize: 22, fontWeight: '700', color: '#1f2937' },
    listSubtitle: { fontSize: 16, color: modernColors.primary, fontWeight: '600', marginTop: 4, marginBottom: 16 },
    bookList: { flex: 1 },
    bookItem: {
        flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, padding: 12,
        marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
    },
    bookItemRejected: { opacity: 0.5, borderWidth: 1, borderColor: '#fca5a5' },
    bookThumb: { width: 50, height: 65, borderRadius: 6, marginRight: 12 },
    bookInfo: { flex: 1, justifyContent: 'center' },
    bookTitle: { fontSize: 14, fontWeight: '600', color: '#1f2937' },
    bookMeta: { fontSize: 12, color: '#6b7280', marginTop: 2 },
    bookClasseVisee: { fontSize: 11, color: '#3b82f6', fontWeight: '600', marginTop: 1 },
    bookValueRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6 },
    etatDot: { width: 8, height: 8, borderRadius: 4 },
    etatText: { fontSize: 12, color: '#6b7280' },
    bookValue: { fontSize: 13, fontWeight: '700', color: '#1f2937', marginLeft: 'auto' },
    listActions: { flexDirection: 'row', gap: 12, marginTop: 12, paddingBottom: 20 },
});

export default BookUploadV2Screen;
