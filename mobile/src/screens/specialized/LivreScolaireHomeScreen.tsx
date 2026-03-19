// ✅ Écran Bourse du Livre MODERNE - Refonte complète avec UX intuitive et rassurante
// Fonctionnalités : Affichage livres proches, recherche, ajout simplifié (photo → IA → prix)

import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import PaymentMethodPrompt from '../../components/PaymentMethodPrompt';
import SafeIcon from '../../components/SafeIcon';
import { SafeNativeView } from '../../components/SafeNativeView';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { useLocation } from '../../contexts/LocationContext';
import { usePaymentMethodCheck } from '../../hooks/usePaymentMethodCheck';
import { BookImageAnalysis, LivreScolaire, livreScolaireService, SearchLivresFilters } from '../../services/livreScolaireService';
import { modernColors } from '../../theme/modernTheme';
import { hapticPress } from '../../utils/hapticFeedback';

const LivreScolaireHomeScreen: React.FC = () => {
    const navigation = useNavigation();
    const { t } = useLanguageSafe();
    const { location } = useLocation();

    // États de recherche
    const [searchQuery, setSearchQuery] = useState('');
    const [livres, setLivres] = useState<LivreScolaire[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Vérification moyen de paiement
    const paymentCheck = usePaymentMethodCheck();
    const [showPaymentPrompt, setShowPaymentPrompt] = useState(false);

    // États pour ajout simplifié
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [imageBase64, setImageBase64] = useState<string | null>(null);
    const [analyzingImage, setAnalyzingImage] = useState(false);
    const [bookInfo, setBookInfo] = useState<BookImageAnalysis | null>(null);
    const [price, setPrice] = useState('');
    const [saving, setSaving] = useState(false);

    // Charger les livres proches à l'ouverture
    useEffect(() => {
        loadNearbyBooks();
    }, []);

    const loadNearbyBooks = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const filters: SearchLivresFilters = {
                limit: 20,
                offset: 0,
            };

            // Ajouter GPS si disponible
            if (location?.coords) {
                filters.gps_lat = location.coords.latitude;
                filters.gps_lon = location.coords.longitude;
                filters.rayon_km = 20; // 20 km de rayon
            }

            const response = await livreScolaireService.searchLivres(filters);

            const r = response.data as any;
            if (response.success && r?.livres) {
                const livresData = r.livres.map((item: any) => ({
                    ...item.livre,
                    distance_km: item.distance_km,
                }));
                setLivres(livresData);
            } else {
                setError(t('livreScolaireHome.aucunLivreTrouveAProximite'));
                setLivres([]);
            }
        } catch (err: any) {
            console.error('[LivreScolaireHomeScreen] Erreur chargement:', err);
            setError(err.message || 'Erreur lors du chargement');
            setLivres([]);
        } finally {
            setLoading(false);
        }
    }, [location]);

    const handleSearch = useCallback(async () => {
        if (!searchQuery.trim()) {
            loadNearbyBooks();
            return;
        }

        hapticPress();
        setLoading(true);
        setError(null);

        try {
            const filters: SearchLivresFilters = {
                limit: 50,
                offset: 0,
            };

            // Recherche par titre, auteur, matière
            // Le backend devrait gérer la recherche textuelle
            if (location?.coords) {
                filters.gps_lat = location.coords.latitude;
                filters.gps_lon = location.coords.longitude;
                filters.rayon_km = 50;
            }

            const response = await livreScolaireService.searchLivres(filters);

            const r = response.data as any;
            if (response.success && r?.livres) {
                // Filtrer côté client par query (en attendant que le backend le fasse)
                const filtered = r.livres
                    .map((item: any) => ({
                        ...item.livre,
                        distance_km: item.distance_km,
                    }))
                    .filter((livre: LivreScolaire) =>
                        livre.titre.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        livre.auteur?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        livre.matiere.toLowerCase().includes(searchQuery.toLowerCase())
                    );
                setLivres(filtered);
            }
        } catch (err: any) {
            console.error('[LivreScolaireHomeScreen] Erreur recherche:', err);
            setError(err.message || t('livreScolaireHome.erreurLorsDeLaRecherche'));
        } finally {
            setLoading(false);
        }
    }, [searchQuery, location]);

    const handlePickImage = async () => {
        hapticPress();
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert(t('livreScolaire.permissionRequired'), t('livreScolaire.allowGalleryAccess'));
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.8,
            base64: true,
        });

        if (!result.canceled && result.assets[0]) {
            const asset = result.assets[0];
            setSelectedImage(asset.uri);
            if (asset.base64) {
                const base64Image = `data:image/jpeg;base64,${asset.base64}`;
                setImageBase64(base64Image);
                await analyzeImage(base64Image);
            }
        }
    };

    const analyzeImage = async (imageBase64: string) => {
        setAnalyzingImage(true);
        setBookInfo(null);

        try {
            const response = await livreScolaireService.analyzeBookImage(
                imageBase64,
                location?.coords?.latitude,
                location?.coords?.longitude
            );

            const r = response.data as any;
            if (response.success && r?.book_info) {
                setBookInfo(r.book_info);
                setShowAddModal(true);
            } else {
                Alert.alert(t('message.error'), t('livreScolaire.cannotAnalyzeImage'));
            }
        } catch (err: any) {
            console.error('[LivreScolaireHomeScreen] Erreur analyse:', err);
            Alert.alert(t('message.error'), err.message || t('livreScolaire.analysisError'));
        } finally {
            setAnalyzingImage(false);
        }
    };

    const handleSaveBook = async () => {
        if (!bookInfo || !price.trim()) {
            Alert.alert(t('message.error'), t('livreScolaire.enterPrice'));
            return;
        }

        // ✅ Vérifier moyen de paiement avant de mettre en vente
        const needsPayment = await paymentCheck.checkAndPrompt();
        if (needsPayment) {
            setShowPaymentPrompt(true);
            return;
        }

        hapticPress();
        setSaving(true);

        try {
            const livreData = {
                titre: bookInfo.titre,
                auteur: bookInfo.auteur || undefined,
                editeur: bookInfo.editeur || undefined,
                isbn: bookInfo.isbn || undefined,
                classe_actuelle: bookInfo.classe_actuelle || t('livreScolaireHome.nonSpecifiee'),
                classe_souhaitee: bookInfo.classe_souhaitee || t('livreScolaireHome.nonSpecifiee'),
                matiere: bookInfo.matiere || t('livreScolaireHome.nonSpecifiee'),
                niveau: bookInfo.niveau || undefined,
                etat_livre: bookInfo.etat_livre,
                description_etat: bookInfo.description_etat || undefined,
                images_urls: imageBase64 ? [imageBase64] : undefined,
                gps: location?.coords ? `${location.coords.latitude},${location.coords.longitude}` : undefined,
                ville: undefined, // À compléter si nécessaire
                quartier: undefined,
            };

            const response = await livreScolaireService.createLivre(livreData);

            if (response.success) {
                Alert.alert(t('message.success'), t('livreScolaire.bookAdded'), [
                    {
                        text: 'OK',
                        onPress: () => {
                            setShowAddModal(false);
                            setSelectedImage(null);
                            setImageBase64(null);
                            setBookInfo(null);
                            setPrice('');
                            loadNearbyBooks();
                        },
                    },
                ]);
            } else {
                Alert.alert(t('message.error'), t('livreScolaire.cannotAddBook'));
            }
        } catch (err: any) {
            console.error('[LivreScolaireHomeScreen] Erreur sauvegarde:', err);
            Alert.alert(t('message.error'), err.message || t('livreScolaire.saveError'));
        } finally {
            setSaving(false);
        }
    };

    const formatDistance = (distance?: number) => {
        if (!distance) return '';
        if (distance < 1) return `${Math.round(distance * 1000)}m`;
        return `${distance.toFixed(1)} km`;
    };

    return (
        <SafeNativeView style={styles.container}>
            {/* Header sticky avec recherche */}
            <View style={styles.headerContainer}>
                <LinearGradient
                    colors={['#F59E0B', '#FBBF24']}
                    style={styles.headerGradient}
                >
                    <View style={styles.headerTop}>
                        <TouchableOpacity
                            onPress={() => {
                                hapticPress();
                                navigation.goBack();
                            }}
                            style={styles.backButton}
                        >
                            <SafeIcon name="arrow-left" size={24} color="#FFFFFF" />
                        </TouchableOpacity>
                        <View style={styles.headerTitleContainer}>
                            <Text style={styles.headerTitle}>{t('livreScolaireHome.bourseDuLivre')}</Text>
                            <Text style={styles.headerSubtitle}>
                                {livres.length} livre{livres.length > 1 ? 's' : ''} disponible{livres.length > 1 ? 's' : ''}
                            </Text>
                        </View>
                        <TouchableOpacity
                            onPress={() => {
                                hapticPress();
                                handlePickImage();
                            }}
                            style={styles.addButton}
                        >
                            <SafeIcon name="plus" size={24} color="#FFFFFF" type="lucide" />
                        </TouchableOpacity>
                    </View>

                    {/* Barre de recherche */}
                    <View style={styles.searchContainer}>
                        <View style={styles.searchBar}>
                            <SafeIcon name="search" size={20} color="#9CA3AF" type="lucide" />
                            <TextInput
                                style={styles.searchInput}
                                placeholder={t('livreScolaireHome.rechercherUnLivreTitreAuteur')}
                                placeholderTextColor="#9CA3AF"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                onSubmitEditing={handleSearch}
                                returnKeyType="search"
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity
                                    onPress={() => {
                                        setSearchQuery('');
                                        handleSearch();
                                    }}
                                    style={styles.clearButton}
                                >
                                    <SafeIcon name="x" size={18} color="#9CA3AF" type="lucide" />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    {/* V2 Quick Actions */}
                    <View style={styles.v2ActionsRow}>
                        <TouchableOpacity
                            style={styles.v2ActionBtn}
                            onPress={() => { hapticPress(); (navigation as any).navigate('BookUploadV2'); }}
                        >
                            <SafeIcon name="camera" size={18} color="#FFFFFF" type="lucide" />
                            <Text style={styles.v2ActionText}>{t('livreScolaireHome.envoyerLivres')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.v2ActionBtn}
                            onPress={() => { hapticPress(); (navigation as any).navigate('BookPackages'); }}
                        >
                            <SafeIcon name="package" size={18} color="#FFFFFF" type="lucide" />
                            <Text style={styles.v2ActionText}>{t('livreScolaireHome.mesPaquets')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.v2ActionBtn}
                            onPress={() => { hapticPress(); (navigation as any).navigate('MesLivres'); }}
                        >
                            <SafeIcon name="book" size={18} color="#FFFFFF" type="lucide" />
                            <Text style={styles.v2ActionText}>{t('livreScolaireHome.mesLivres')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.v2ActionBtn}
                            onPress={() => { hapticPress(); (navigation as any).navigate('MesBesoinsLivres'); }}
                        >
                            <SafeIcon name="clipboard-list" size={18} color="#FFFFFF" type="lucide" />
                            <Text style={styles.v2ActionText}>{t('mesBesoinsLivres.mesBesoins', 'Mes Besoins')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.v2ActionBtn, { backgroundColor: 'rgba(5,150,105,0.3)' }]}
                            onPress={() => { hapticPress(); (navigation as any).navigate('NewBooks'); }}
                        >
                            <SafeIcon name="shopping-bag" size={18} color="#FFFFFF" type="lucide" />
                            <Text style={styles.v2ActionText}>{t('livresNeufs.neufsCourt')}</Text>
                        </TouchableOpacity>
                    </View>
                </LinearGradient>
            </View>

            {/* Liste des livres */}
            {loading && livres.length === 0 ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={modernColors.primary} />
                    <Text style={styles.loadingText}>{t('livreScolaireHome.rechercheDeLivresAProximite')}</Text>
                </View>
            ) : error && livres.length === 0 ? (
                <View style={styles.centerContainer}>
                    <SafeIcon name="book" size={64} color="#9CA3AF" />
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity
                        style={styles.retryButton}
                        onPress={loadNearbyBooks}
                    >
                        <Text style={styles.retryButtonText}>{t('livreScolaireHome.reessayer')}</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={livres}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={({ item }) => (
                        <BookCard
                            livre={item}
                            onPress={() => navigation.navigate('LivreScolaireDetails' as never, { livreId: item.id } as never)}
                            formatDistance={formatDistance}
                        />
                    )}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={loadNearbyBooks}
                            colors={[modernColors.primary]}
                        />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <SafeIcon name="book" size={64} color="#9CA3AF" />
                            <Text style={styles.emptyText}>{t('livreScolaireHome.aucunLivreTrouve')}</Text>
                            <Text style={styles.emptySubtext}>
                                {t('livreScolaireHome.conseilModifierCriteres', 'Essayez de modifier vos critères de recherche')}
                            </Text>
                        </View>
                    }
                />
            )}

            {/* Modal d'ajout simplifié */}
            {showAddModal && (
                <AddBookModal
                    visible={showAddModal}
                    onClose={() => {
                        setShowAddModal(false);
                        setSelectedImage(null);
                        setImageBase64(null);
                        setBookInfo(null);
                        setPrice('');
                    }}
                    selectedImage={selectedImage}
                    bookInfo={bookInfo}
                    price={price}
                    onPriceChange={setPrice}
                    onSave={handleSaveBook}
                    saving={saving}
                    analyzing={analyzingImage}
                />
            )}

            {/* Modal pour configurer les moyens de paiement (vente livre) */}
            <PaymentMethodPrompt
                visible={showPaymentPrompt}
                onClose={() => setShowPaymentPrompt(false)}
                onSaved={() => {
                    paymentCheck.refresh();
                    // Relancer la sauvegarde après configuration du moyen de paiement
                    handleSaveBook();
                }}
                context="book_sell"
            />
        </SafeNativeView>
    );
};

// Composant Card pour un livre
interface BookCardProps {
    livre: LivreScolaire;
    onPress: () => void;
    formatDistance: (distance?: number) => string;
}

const BookCard: React.FC<BookCardProps> = ({ livre, onPress, formatDistance }) => {
    return (
        <TouchableOpacity style={styles.bookCard} onPress={onPress} activeOpacity={0.7}>
            {livre.images_urls && livre.images_urls.length > 0 ? (
                <Image
                    source={{ uri: livre.images_urls[0] }}
                    style={styles.bookImage}
                    resizeMode="cover"
                />
            ) : (
                <View style={styles.bookImagePlaceholder}>
                    <SafeIcon name="book" size={32} color="#9CA3AF" />
                </View>
            )}
            <View style={styles.bookInfo}>
                <Text style={styles.bookTitle} numberOfLines={2}>
                    {livre.titre}
                </Text>
                {livre.auteur && (
                    <Text style={styles.bookAuthor} numberOfLines={1}>
                        {livre.auteur}
                    </Text>
                )}
                <View style={styles.bookMeta}>
                    <View style={styles.bookMetaItem}>
                        <SafeIcon name="graduation-cap" size={14} color="#6B7280" type="lucide" />
                        <Text style={styles.bookMetaText}>
                            {livre.classe_actuelle} → {livre.classe_souhaitee}
                        </Text>
                    </View>
                    <View style={styles.bookMetaItem}>
                        <SafeIcon name="book-open" size={14} color="#6B7280" type="lucide" />
                        <Text style={styles.bookMetaText}>{livre.matiere}</Text>
                    </View>
                </View>
                <View style={styles.bookFooter}>
                    <View style={styles.bookLocation}>
                        {livre.ville && (
                            <Text style={styles.bookLocationText} numberOfLines={1}>
                                {livre.quartier && `${livre.quartier}, `}
                                {livre.ville}
                            </Text>
                        )}
                        {livre.distance_km && (
                            <Text style={styles.bookDistance}>
                                {formatDistance(livre.distance_km)}
                            </Text>
                        )}
                    </View>
                    <View style={styles.bookStateBadge}>
                        <Text style={styles.bookStateText}>{livre.etat_livre}</Text>
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );
};

// Modal d'ajout simplifié
interface AddBookModalProps {
    visible: boolean;
    onClose: () => void;
    selectedImage: string | null;
    bookInfo: BookImageAnalysis | null;
    price: string;
    onPriceChange: (price: string) => void;
    onSave: () => void;
    saving: boolean;
    analyzing: boolean;
}

const AddBookModal: React.FC<AddBookModalProps> = ({
    visible,
    onClose,
    selectedImage,
    bookInfo,
    price,
    onPriceChange,
    onSave,
    saving,
    analyzing,
}) => {
    const { t } = useLanguageSafe();
    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>{t('livreScolaireHome.ajouterUnLivre')}</Text>
                        <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
                            <SafeIcon name="x" size={24} color="#111827" type="lucide" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
                        {analyzing ? (
                            <View style={styles.analyzingContainer}>
                                <ActivityIndicator size="large" color="#F59E0B" />
                                <Text style={styles.analyzingText}>
                                    {t('livreScolaireHome.analyseEnCours', "Analyse de l'image en cours...")}
                                </Text>
                                <Text style={styles.analyzingSubtext}>
                                    {t('livreScolaireHome.iaExtraitCaracteristiques', "L'IA extrait les caractéristiques de votre livre")}
                                </Text>
                            </View>
                        ) : bookInfo ? (
                            <>
                                {selectedImage && (
                                    <Image
                                        source={{ uri: selectedImage }}
                                        style={styles.previewImage}
                                        resizeMode="contain"
                                    />
                                )}
                                <View style={styles.bookInfoContainer}>
                                    <Text style={styles.bookInfoTitle}>{t('livreScolaireHome.informationsDetectees')}</Text>
                                    <View style={styles.bookInfoRow}>
                                        <Text style={styles.bookInfoLabel}>{t('livreScolaireHome.titre', 'Titre')}:</Text>
                                        <Text style={styles.bookInfoValue}>{bookInfo.titre}</Text>
                                    </View>
                                    {bookInfo.auteur && (
                                        <View style={styles.bookInfoRow}>
                                            <Text style={styles.bookInfoLabel}>{t('livreScolaireHome.auteur', 'Auteur')}:</Text>
                                            <Text style={styles.bookInfoValue}>{bookInfo.auteur}</Text>
                                        </View>
                                    )}
                                    {bookInfo.matiere && (
                                        <View style={styles.bookInfoRow}>
                                            <Text style={styles.bookInfoLabel}>{t('livreScolaireHome.matiere')}</Text>
                                            <Text style={styles.bookInfoValue}>{bookInfo.matiere}</Text>
                                        </View>
                                    )}
                                    {bookInfo.classe_actuelle && (
                                        <View style={styles.bookInfoRow}>
                                            <Text style={styles.bookInfoLabel}>{t('livreScolaireHome.classe', 'Classe')}:</Text>
                                            <Text style={styles.bookInfoValue}>
                                                {bookInfo.classe_actuelle} → {bookInfo.classe_souhaitee || '?'}
                                            </Text>
                                        </View>
                                    )}
                                    <View style={styles.bookInfoRow}>
                                        <Text style={styles.bookInfoLabel}>{t('livreScolaireHome.etat')}</Text>
                                        <Text style={styles.bookInfoValue}>{bookInfo.etat_livre}</Text>
                                    </View>
                                    {bookInfo.confidence < 0.7 && (
                                        <View style={styles.warningBox}>
                                            <SafeIcon name="alert-triangle" size={16} color="#F59E0B" type="lucide" />
                                            <Text style={styles.warningText}>
                                                {t('livreScolaireHome.verificationNecessaire', 'Certaines informations peuvent nécessiter une vérification')}
                                            </Text>
                                        </View>
                                    )}
                                </View>

                                <View style={styles.priceContainer}>
                                    <Text style={styles.priceLabel}>{t('livreScolaireHome.prixDeVenteFcfa')}</Text>
                                    <TextInput
                                        style={styles.priceInput}
                                        placeholder="Ex: 5000"
                                        value={price}
                                        onChangeText={onPriceChange}
                                        keyboardType="numeric"
                                    />
                                    <Text style={styles.priceHint}>
                                        {t('livreScolaireHome.indiquezPrix', 'Indiquez le prix auquel vous souhaitez vendre ce livre')}
                                    </Text>
                                </View>
                            </>
                        ) : (
                            <View style={styles.errorContainer}>
                                <SafeIcon name="alert-circle" size={48} color="#EF4444" />
                                <Text style={styles.errorText}>
                                    {t('livreScolaireHome.impossibleAnalyser', "Impossible d'analyser l'image")}
                                </Text>
                            </View>
                        )}
                    </ScrollView>

                    {bookInfo && !analyzing && (
                        <View style={styles.modalFooter}>
                            <TouchableOpacity
                                style={styles.cancelButton}
                                onPress={onClose}
                            >
                                <Text style={styles.cancelButtonText}>{t('livreScolaireHomeScreen.annuler')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.saveButton, !price.trim() && styles.saveButtonDisabled]}
                                onPress={onSave}
                                disabled={!price.trim() || saving}
                            >
                                {saving ? (
                                    <ActivityIndicator color="#FFFFFF" />
                                ) : (
                                    <Text style={styles.saveButtonText}>{t('livreScolaireHome.publier', 'Publier')}</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}
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
    headerContainer: {
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 4,
        zIndex: 10,
    },
    headerGradient: {
        paddingTop: 20,
        paddingBottom: 16,
        paddingHorizontal: 16,
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    backButton: {
        marginRight: 12,
    },
    headerTitleContainer: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    headerSubtitle: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.9)',
        marginTop: 2,
    },
    addButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    v2ActionsRow: {
        flexDirection: 'row',
        marginTop: 12,
        gap: 8,
    },
    v2ActionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        borderRadius: 10,
        paddingVertical: 10,
        paddingHorizontal: 8,
    },
    v2ActionText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '700',
    },
    searchContainer: {
        marginTop: 8,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 12,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#111827',
    },
    clearButton: {
        padding: 4,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#6B7280',
    },
    errorText: {
        marginTop: 16,
        fontSize: 18,
        fontWeight: '600',
        color: '#EF4444',
        textAlign: 'center',
    },
    retryButton: {
        marginTop: 16,
        paddingVertical: 12,
        paddingHorizontal: 24,
        backgroundColor: '#F59E0B',
        borderRadius: 8,
    },
    retryButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    listContent: {
        padding: 16,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
        minHeight: 400,
    },
    emptyText: {
        marginTop: 16,
        fontSize: 18,
        fontWeight: '600',
        color: '#6B7280',
    },
    emptySubtext: {
        marginTop: 8,
        fontSize: 14,
        color: '#9CA3AF',
        textAlign: 'center',
    },
    // Book Card styles
    bookCard: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
        gap: 12,
    },
    bookImage: {
        width: 100,
        height: 140,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
    },
    bookImagePlaceholder: {
        width: 100,
        height: 140,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    bookInfo: {
        flex: 1,
    },
    bookTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    bookAuthor: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 8,
    },
    bookMeta: {
        gap: 6,
        marginBottom: 12,
    },
    bookMetaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    bookMetaText: {
        fontSize: 12,
        color: '#6B7280',
    },
    bookFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 'auto',
    },
    bookLocation: {
        flex: 1,
    },
    bookLocationText: {
        fontSize: 12,
        color: '#6B7280',
        marginBottom: 2,
    },
    bookDistance: {
        fontSize: 11,
        color: '#9CA3AF',
    },
    bookStateBadge: {
        backgroundColor: '#D1FAE5',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    bookStateText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#065F46',
    },
    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '90%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
    },
    modalCloseButton: {
        padding: 4,
    },
    modalScroll: {
        flex: 1,
    },
    modalScrollContent: {
        padding: 20,
    },
    analyzingContainer: {
        padding: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    analyzingText: {
        marginTop: 16,
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
    },
    analyzingSubtext: {
        marginTop: 8,
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
    },
    previewImage: {
        width: '100%',
        height: 300,
        borderRadius: 12,
        marginBottom: 20,
        backgroundColor: '#F3F4F6',
    },
    bookInfoContainer: {
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
    },
    bookInfoTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 12,
    },
    bookInfoRow: {
        flexDirection: 'row',
        marginBottom: 8,
    },
    bookInfoLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
        width: 100,
    },
    bookInfoValue: {
        flex: 1,
        fontSize: 14,
        color: '#111827',
    },
    warningBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEF3C7',
        borderRadius: 8,
        padding: 12,
        marginTop: 12,
        gap: 8,
    },
    warningText: {
        flex: 1,
        fontSize: 12,
        color: '#92400E',
    },
    priceContainer: {
        marginTop: 8,
    },
    priceLabel: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 8,
    },
    priceInput: {
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 16,
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
        borderWidth: 2,
        borderColor: '#E5E7EB',
    },
    priceHint: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 8,
    },
    errorContainer: {
        padding: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalFooter: {
        flexDirection: 'row',
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        gap: 12,
    },
    cancelButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#6B7280',
    },
    saveButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 8,
        backgroundColor: '#F59E0B',
        justifyContent: 'center',
        alignItems: 'center',
    },
    saveButtonDisabled: {
        opacity: 0.5,
    },
    saveButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
});

export default LivreScolaireHomeScreen;

