// @ts-nocheck
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import * as VideoThumbnails from 'expo-video-thumbnails';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { NativeButton, NativeCard, NativeInput } from '../components/NativeDesign';
import SafeIcon from '../components/SafeIcon';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { apiGet, apiPost } from '../services/api';
import { modernColors } from '../theme/modernTheme';

const { width } = Dimensions.get('window');

interface PubliciteData {
    titre: string;
    description: string;
    produitsIndexes: string[]; // IDs des produits
    videos: string[]; // Base64 des vidéos
    thumbnails: string[]; // Miniatures des vidéos
    duree: number; // Durée en jours
    budget: number; // Budget total
    zone_geographique: string; // Zone d'impact
}

// ✅ Taux de conversion des devises (base FCFA = 1)
const EXCHANGE_RATES: { [key: string]: number } = {
    'FCFA': 1,
    'XOF': 1,
    'USD': 600,
    'EUR': 650,
    'GBP': 750,
    'CNY': 85,
    'INR': 7.5,
    'XAF': 1,
};

const PRICE_PER_DAY_FCFA = 500; // 500 FCFA par jour

const CreatePubliciteScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();
    const { t, language } = useLanguage();

    // ✅ Mode: 'create', 'edit', ou 'relance'
    const publiciteId = (route.params as any)?.publiciteId;
    const relanceId = (route.params as any)?.relanceId;
    const mode = publiciteId ? 'edit' : relanceId ? 'relance' : 'create';

    const [loading, setLoading] = useState(false);
    const [mesServices, setMesServices] = useState<any[]>([]);
    const [produitsList, setProduitsList] = useState<any[]>([]);
    const [selectedProduits, setSelectedProduits] = useState<string[]>([]);
    const [videos, setVideos] = useState<any[]>([]);
    const [titre, setTitre] = useState('');
    const [description, setDescription] = useState('');
    const [duree, setDuree] = useState('7'); // 7 jours par défaut
    const [zoneGeographique, setZoneGeographique] = useState('local'); // local, regional, international
    const [coutEstime, setCoutEstime] = useState(0);
    const [userCurrency, setUserCurrency] = useState('FCFA');

    // Charger les services et produits de l'utilisateur
    useEffect(() => {
        loadMesServicesEtProduits();
        loadUserCurrency();

        // Si mode modification ou relance, charger les données de la publicité
        if (mode === 'edit' && publiciteId) {
            loadPubliciteData(publiciteId);
        } else if (mode === 'relance' && relanceId) {
            loadPubliciteData(relanceId);
        }
    }, []);

    const loadUserCurrency = async () => {
        try {
            // Récupérer la devise de l'utilisateur depuis son profil
            const response = await apiGet('/api/users/profile');
            if (response.success && response.data?.devise_preferee) {
                setUserCurrency(response.data.devise_preferee);
            }
        } catch (error) {
            console.log('[CreatePublicite] Devise par défaut: FCFA');
        }
    };

    // ✅ Charger les données d'une publicité existante (pour modification ou relance)
    const loadPubliciteData = async (pubId: string) => {
        try {
            setLoading(true);
            const response = await apiGet(`/api/publicites/${pubId}`);

            if (response.success && response.data) {
                const pub = response.data;
                setTitre(pub.titre || '');
                setDescription(pub.description || '');
                setDuree(pub.duree_jours?.toString() || '7');
                setZoneGeographique(pub.zone_geographique || 'local');
                setSelectedProduits(pub.produits_indexes || []);

                // Pour les vidéos, on ne peut pas les recharger depuis base64,
                // l'utilisateur devra les ajouter à nouveau si nécessaire
            }
            setLoading(false);
        } catch (error) {
            console.error('[CreatePublicite] Erreur chargement publicité:', error);
            setLoading(false);
        }
    };

    const loadMesServicesEtProduits = async () => {
        try {
            setLoading(true);
            const response = await apiGet('/api/prestataire/services');

            if (response.success && response.data) {
                setMesServices(response.data);

                // Extraire tous les produits
                const allProducts: any[] = [];
                response.data.forEach((service: any) => {
                    if (service.data?.produits && Array.isArray(service.data.produits)) {
                        service.data.produits.forEach((product: any, index: number) => {
                            allProducts.push({
                                ...product,
                                id: `${service.id}_${index}`,
                                serviceId: service.id,
                                serviceTitre: service.data?.titre_service?.valeur || service.titre || 'Service',
                                productIndex: index
                            });
                        });
                    }
                });
                setProduitsList(allProducts);
            }
            setLoading(false);
        } catch (error) {
            console.error('[CreatePublicite] Erreur chargement:', error);
            setLoading(false);
        }
    };

    // ✅ Calculer le coût estimé avec conversion de devise et coût vidéos
    useEffect(() => {
        const nbJours = parseInt(duree) || 7;
        const nbVideos = videos.length;

        // Calcul en FCFA
        // Base: 500 FCFA/jour + 2000 FCFA par vidéo
        const coutBase = nbJours * PRICE_PER_DAY_FCFA;
        const coutVideos = nbVideos * 2000;
        const totalFCFA = coutBase + coutVideos;

        // Conversion dans la devise de l'utilisateur
        const exchangeRate = EXCHANGE_RATES[userCurrency] || 1;
        const totalInUserCurrency = Math.round(totalFCFA / exchangeRate);

        setCoutEstime(totalInUserCurrency);
    }, [duree, userCurrency, videos]);

    // Sélection de vidéos
    const handleSelectVideo = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Videos,
                allowsEditing: false,
                quality: 0.8,
                videoMaxDuration: 30, // 30 secondes max
            });

            if (!result.canceled && result.assets[0]) {
                const video = result.assets[0];

                // Générer la miniature
                try {
                    const { uri: thumbnailUri } = await VideoThumbnails.getThumbnailAsync(video.uri, {
                        time: 1000,
                    });

                    // Convertir en base64
                    const FileSystem = require('expo-file-system');
                    const videoBase64 = await FileSystem.readAsStringAsync(video.uri, {
                        encoding: FileSystem.EncodingType.Base64,
                    });
                    const thumbnailBase64 = await FileSystem.readAsStringAsync(thumbnailUri, {
                        encoding: FileSystem.EncodingType.Base64,
                    });

                    setVideos([...videos, {
                        uri: video.uri,
                        base64: videoBase64,
                        thumbnail: thumbnailBase64,
                        duration: video.duration || 0
                    }]);
                } catch (thumbError) {
                    console.error('Erreur génération miniature:', thumbError);
                    Alert.alert(t('message.error'), 'Impossible de générer la miniature de la vidéo');
                }
            }
        } catch (error) {
            console.error('Erreur sélection vidéo:', error);
            Alert.alert(t('message.error'), 'Impossible de sélectionner la vidéo');
        }
    };

    // ✅ Soumettre la publicité avec gestion recharge
    const handleCreatePublicite = async () => {
        // Validation
        if (selectedProduits.length === 0) {
            Alert.alert(t('message.error'), 'Veuillez sélectionner au moins un produit');
            return;
        }

        if (!titre.trim()) {
            Alert.alert(t('message.error'), 'Veuillez entrer un titre pour la publicité');
            return;
        }

        // Vérifier le solde
        try {
            setLoading(true);

            const balanceResponse = await apiGet('/api/users/balance');
            if (!balanceResponse.success) {
                Alert.alert(t('message.error'), 'Impossible de vérifier votre solde');
                setLoading(false);
                return;
            }

            const solde = balanceResponse.data?.tokens_balance || 0;

            // Convertir le coût en FCFA pour la comparaison avec le solde (qui est en FCFA)
            const exchangeRate = EXCHANGE_RATES[userCurrency] || 1;
            const coutEnFCFA = Math.round(coutEstime * exchangeRate);

            if (solde < coutEnFCFA) {
                Alert.alert(
                    `💸 ${t('publicite.balance_insufficient')}`,
                    `${t('publicite.total_cost')} : ${coutEstime.toLocaleString()} ${userCurrency}\n` +
                    `Votre solde : ${Math.round(solde / exchangeRate).toLocaleString()} ${userCurrency}\n\n` +
                    `${t('publicite.recharge_account')}`,
                    [
                        { text: t('button.cancel'), style: 'cancel', onPress: () => setLoading(false) },
                        {
                            text: '💳 Recharger',
                            onPress: () => {
                                setLoading(false);
                                (navigation as any).navigate('RechargeTokens');
                            }
                        }
                    ]
                );
                return;
            }

            // Confirmation
            Alert.alert(
                `💰 ${t('button.confirm')}`,
                `Créer cette publicité ?\n\n` +
                `${t('publicite.products')} : ${selectedProduits.length}\n` +
                `${t('publicite.videos')} : ${videos.length}\n` +
                `${t('publicite.duration')} : ${duree} jours\n` +
                `${t('publicite.zone')} : ${getZoneLabel(zoneGeographique)}\n\n` +
                `${t('publicite.total_cost')} : ${coutEstime.toLocaleString()} ${userCurrency}\n` +
                `Solde après : ${Math.round((solde - coutEnFCFA) / exchangeRate).toLocaleString()} ${userCurrency}`,
                [
                    { text: t('button.cancel'), style: 'cancel', onPress: () => setLoading(false) },
                    {
                        text: t('button.confirm'),
                        onPress: async () => {
                            try {
                                const publiciteData = {
                                    user_id: parseInt(user?.id || '0'),
                                    titre,
                                    description,
                                    produits_indexes: selectedProduits,
                                    videos: videos.map(v => v.base64),
                                    thumbnails: videos.map(v => v.thumbnail),
                                    duree_jours: parseInt(duree),
                                    cout: coutEnFCFA, // Toujours en FCFA côté backend
                                    zone_geographique: zoneGeographique,
                                    devise_utilisateur: userCurrency
                                };

                                // ✅ Appel API selon le mode
                                const response = mode === 'edit' && publiciteId
                                    ? await apiPost(`/api/publicites/${publiciteId}/update`, publiciteData)
                                    : await apiPost('/api/publicites/create', publiciteData);

                                if (response.success) {
                                    Alert.alert(
                                        `✅ ${t('publicite.create_success')}`,
                                        `${t('publicite.total_cost')} : ${coutEstime.toLocaleString()} ${userCurrency}\n` +
                                        `${t('publicite.duration')} : ${duree} jours`,
                                        [
                                            {
                                                text: 'OK',
                                                onPress: () => navigation.goBack()
                                            }
                                        ]
                                    );
                                } else {
                                    Alert.alert(t('message.error'), response.error || 'Impossible de créer la publicité');
                                }

                                setLoading(false);
                            } catch (error) {
                                console.error('[CreatePublicite] Erreur création:', error);
                                Alert.alert(t('message.error'), 'Une erreur est survenue');
                                setLoading(false);
                            }
                        }
                    }
                ]
            );
        } catch (error) {
            console.error('[CreatePublicite] Erreur:', error);
            setLoading(false);
        }
    };

    const toggleProduitSelection = (produitId: string) => {
        if (selectedProduits.includes(produitId)) {
            setSelectedProduits(selectedProduits.filter(id => id !== produitId));
        } else {
            setSelectedProduits([...selectedProduits, produitId]);
        }
    };

    const removeVideo = (index: number) => {
        setVideos(videos.filter((_, i) => i !== index));
    };

    const getZoneLabel = (zone: string): string => {
        const labels: { [key: string]: string } = {
            'local': t('publicite.zone.local'),
            'regional': t('publicite.zone.regional'),
            'international': t('publicite.zone.international')
        };
        return labels[zone] || zone;
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <LinearGradient colors={modernColors.primaryGradient} style={styles.header}>
                <View style={styles.headerContent}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <SafeIcon name="arrow-left" size={24} color="#fff" />
                    </TouchableOpacity>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.headerTitle}>
                            {mode === 'edit' ? 'Modifier une Publicité' :
                                mode === 'relance' ? 'Relancer une Publicité' :
                                    t('publicite.create')}
                        </Text>
                        <Text style={styles.headerSubtitle}>Boostez vos produits</Text>
                    </View>
                </View>
            </LinearGradient>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Info facturation */}
                <NativeCard style={styles.infoCard}>
                    <View style={styles.infoHeader}>
                        <SafeIcon name="info" size={20} color={modernColors.primary} />
                        <Text style={styles.infoTitle}>{t('publicite.pricing')}</Text>
                    </View>
                    <Text style={styles.infoText}>• {t('publicite.price_per_day')}</Text>
                    <Text style={styles.infoText}>• +2 000 FCFA par vidéo</Text>
                    <Text style={styles.infoText}>• Conversion automatique en {userCurrency}</Text>
                    <Text style={styles.infoText}>• Facturation journalière</Text>
                </NativeCard>

                {/* Titre et description */}
                <NativeCard style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>📝 Informations générales</Text>

                    <View style={styles.fieldContainer}>
                        <Text style={styles.fieldLabel}>{t('publicite.title')} <Text style={styles.required}>*</Text></Text>
                        <NativeInput
                            placeholder="Ex: Promotion Immobilier - 20% de remise"
                            value={titre}
                            onChangeText={setTitre}
                            style={styles.input}
                        />
                    </View>

                    <View style={styles.fieldContainer}>
                        <Text style={styles.fieldLabel}>{t('publicite.description')}</Text>
                        <NativeInput
                            placeholder="Décrivez votre offre promotionnelle..."
                            value={description}
                            onChangeText={setDescription}
                            style={styles.input}
                            multiline
                            numberOfLines={3}
                        />
                    </View>

                    <View style={styles.fieldContainer}>
                        <Text style={styles.fieldLabel}>{t('publicite.duration')} <Text style={styles.required}>*</Text></Text>
                        <View style={styles.dureeButtons}>
                            {['7', '14', '30', '60', '90'].map((d) => (
                                <TouchableOpacity
                                    key={d}
                                    style={[styles.dureeButton, duree === d && styles.dureeButtonActive]}
                                    onPress={() => setDuree(d)}
                                >
                                    <Text style={[styles.dureeText, duree === d && styles.dureeTextActive]}>
                                        {d} jours
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* ✅ Sélection zone géographique */}
                    <View style={styles.fieldContainer}>
                        <Text style={styles.fieldLabel}>{t('publicite.zone')} <Text style={styles.required}>*</Text></Text>
                        <Text style={styles.fieldHint}>{t('publicite.zone.select')}</Text>
                        <View style={styles.zoneButtons}>
                            {['local', 'regional', 'international'].map((zone) => (
                                <TouchableOpacity
                                    key={zone}
                                    style={[styles.zoneButton, zoneGeographique === zone && styles.zoneButtonActive]}
                                    onPress={() => setZoneGeographique(zone)}
                                >
                                    <SafeIcon
                                        name={zone === 'local' ? 'map-pin' : zone === 'regional' ? 'globe' : 'globe'}
                                        size={20}
                                        color={zoneGeographique === zone ? '#fff' : modernColors.primary}
                                    />
                                    <Text style={[styles.zoneText, zoneGeographique === zone && styles.zoneTextActive]}>
                                        {getZoneLabel(zone)}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </NativeCard>

                {/* Sélection des produits */}
                <NativeCard style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>📦 {t('publicite.products')} ({selectedProduits.length})</Text>

                    {loading ? (
                        <ActivityIndicator size="small" color={modernColors.primary} />
                    ) : produitsList.length === 0 ? (
                        <View style={styles.emptyState}>
                            <SafeIcon name="package" size={48} color="#D1D5DB" />
                            <Text style={styles.emptyText}>Aucun produit disponible</Text>
                            <Text style={styles.emptySubtext}>Créez d'abord un service avec des produits</Text>
                        </View>
                    ) : (
                        <ScrollView style={styles.productsList} nestedScrollEnabled>
                            {produitsList.map((produit) => {
                                const isSelected = selectedProduits.includes(produit.id);
                                return (
                                    <TouchableOpacity
                                        key={produit.id}
                                        style={[styles.productItem, isSelected && styles.productItemSelected]}
                                        onPress={() => toggleProduitSelection(produit.id)}
                                    >
                                        <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                                            {isSelected && (
                                                <SafeIcon name="check" size={16} color="#fff" />
                                            )}
                                        </View>
                                        <View style={styles.productInfo}>
                                            <Text style={styles.productName}>{produit.nom || 'Produit'}</Text>
                                            <Text style={styles.productService}>Service: {produit.serviceTitre}</Text>
                                            {produit.prix && (
                                                <Text style={styles.productPrice}>
                                                    {produit.prix} {produit.devise || 'FCFA'}
                                                </Text>
                                            )}
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    )}
                </NativeCard>

                {/* Vidéos promotionnelles */}
                <NativeCard style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>🎬 {t('publicite.videos')} ({videos.length})</Text>
                    <Text style={styles.sectionHint}>Maximum 30 secondes par vidéo</Text>

                    <TouchableOpacity style={styles.addVideoButton} onPress={handleSelectVideo}>
                        <SafeIcon name="video" size={20} color={modernColors.primary} />
                        <Text style={styles.addVideoText}>Ajouter une vidéo</Text>
                    </TouchableOpacity>

                    {videos.length > 0 && (
                        <View style={styles.videosGrid}>
                            {videos.map((video, index) => (
                                <View key={index} style={styles.videoCard}>
                                    <Image
                                        source={{ uri: `data:image/jpeg;base64,${video.thumbnail}` }}
                                        style={styles.videoThumbnail}
                                    />
                                    <TouchableOpacity
                                        style={styles.removeVideoButton}
                                        onPress={() => removeVideo(index)}
                                    >
                                        <SafeIcon name="x" size={16} color="#fff" />
                                    </TouchableOpacity>
                                    <View style={styles.videoDuration}>
                                        <SafeIcon name="play" size={12} color="#fff" />
                                        <Text style={styles.videoDurationText}>
                                            {Math.round((video.duration || 0) / 1000)}s
                                        </Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}
                </NativeCard>

                {/* Résumé et coût */}
                <NativeCard style={[styles.sectionCard, styles.summaryCard]}>
                    <Text style={styles.sectionTitle}>💰 {t('publicite.summary')}</Text>

                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>{t('publicite.products_selected')}</Text>
                        <Text style={styles.summaryValue}>{selectedProduits.length}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>{t('publicite.videos_added')}</Text>
                        <Text style={styles.summaryValue}>{videos.length}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>{t('publicite.duration')}</Text>
                        <Text style={styles.summaryValue}>{duree} jours</Text>
                    </View>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>{t('publicite.zone')}</Text>
                        <Text style={styles.summaryValue}>{getZoneLabel(zoneGeographique)}</Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.summaryRow}>
                        <Text style={styles.totalLabel}>{t('publicite.total_cost')}</Text>
                        <Text style={styles.totalValue}>{coutEstime.toLocaleString()} {userCurrency}</Text>
                    </View>
                </NativeCard>

                {/* Bouton de création/modification */}
                <NativeButton
                    title={loading ? t('message.loading') :
                        mode === 'edit' ? '💾 Enregistrer les modifications' :
                            mode === 'relance' ? '🔄 Relancer la publicité' :
                                `🚀 ${t('publicite.create')}`}
                    onPress={handleCreatePublicite}
                    disabled={loading || selectedProduits.length === 0 || !titre.trim()}
                    variant="primary"
                    size="large"
                    style={styles.createButton}
                />

                <View style={{ height: 100 }} />
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: modernColors.background,
    },
    header: {
        paddingTop: 60,
        paddingBottom: 24,
        paddingHorizontal: 20,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTextContainer: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#fff',
    },
    headerSubtitle: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.9)',
    },
    content: {
        flex: 1,
        padding: 16,
    },
    infoCard: {
        padding: 16,
        marginBottom: 16,
        backgroundColor: '#EFF6FF',
        borderColor: '#DBEAFE',
    },
    infoHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    infoTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.primary,
    },
    infoText: {
        fontSize: 13,
        color: '#60A5FA',
        marginBottom: 4,
    },
    sectionCard: {
        padding: 16,
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.text,
        marginBottom: 16,
    },
    sectionHint: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginBottom: 12,
    },
    fieldContainer: {
        marginBottom: 16,
    },
    fieldLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 8,
    },
    fieldHint: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginBottom: 8,
    },
    required: {
        color: '#EF4444',
    },
    input: {
        width: '100%',
    },
    dureeButtons: {
        flexDirection: 'row',
        gap: 8,
        flexWrap: 'wrap',
    },
    dureeButton: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: modernColors.border,
        backgroundColor: modernColors.surface,
    },
    dureeButtonActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    dureeText: {
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.text,
    },
    dureeTextActive: {
        color: '#fff',
    },
    zoneButtons: {
        flexDirection: 'column',
        gap: 10,
    },
    zoneButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: modernColors.border,
        backgroundColor: modernColors.surface,
    },
    zoneButtonActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    zoneText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    zoneTextActive: {
        color: '#fff',
    },
    productsList: {
        maxHeight: 300,
    },
    productItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 8,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: modernColors.border,
        backgroundColor: modernColors.surface,
    },
    productItemSelected: {
        borderColor: modernColors.primary,
        backgroundColor: '#EFF6FF',
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: modernColors.border,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    checkboxChecked: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    productInfo: {
        flex: 1,
    },
    productName: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    productService: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginTop: 2,
    },
    productPrice: {
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.primary,
        marginTop: 4,
    },
    emptyState: {
        alignItems: 'center',
        padding: 32,
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.textSecondary,
        marginTop: 8,
    },
    emptySubtext: {
        fontSize: 13,
        color: modernColors.textTertiary,
        marginTop: 4,
    },
    addVideoButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 16,
        borderRadius: 8,
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: modernColors.border,
        backgroundColor: modernColors.surface,
    },
    addVideoText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
    },
    videosGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginTop: 16,
    },
    videoCard: {
        width: (width - 64) / 2,
        height: 120,
        borderRadius: 8,
        overflow: 'hidden',
        position: 'relative',
    },
    videoThumbnail: {
        width: '100%',
        height: '100%',
    },
    removeVideoButton: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    videoDuration: {
        position: 'absolute',
        bottom: 8,
        right: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
    },
    videoDurationText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#fff',
    },
    summaryCard: {
        backgroundColor: '#F0FDF4',
        borderColor: '#BBF7D0',
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    summaryLabel: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    summaryValue: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    divider: {
        height: 1,
        backgroundColor: modernColors.border,
        marginVertical: 12,
    },
    totalLabel: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.text,
    },
    totalValue: {
        fontSize: 20,
        fontWeight: '700',
        color: modernColors.success,
    },
    createButton: {
        marginTop: 8,
        marginBottom: 16,
    },
});

export default CreatePubliciteScreen;
