

import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { Alert, Dimensions, Image, Linking, Platform, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getCategoryConfig, getCategoryStyle, getCategoryTerminology } from '../config/categoryConfig';
import { useLocationDisplay } from '../hooks/useLocationDisplay'; // ✅ NOUVEAU: Import pour localisation intelligente
import { formatPrestationPlanning, getPharmacyStatus, hasEmergencyAvailable, isPharmacyOpenNow } from '../utils/healthServiceHelpers';
import { getDepartureWarning, isTicketStillValid } from '../utils/ticketValidation';
import HotelLocationDisplay from './HotelLocationDisplay';
import OptimizedImage from './OptimizedImage'; // ✅ OPTIMISATION 3: Image optimisée
import SafeIcon from './SafeIcon';

const { width } = Dimensions.get('window');

interface ProductCardProps {
    product: any;
    service: any;
    prestataire?: any;
    userLocation?: { latitude: number; longitude: number } | null; // ✅ NOUVEAU: Localisation utilisateur
    onPress?: () => void;
    onChatPress?: () => void;
    onGalleryPress?: () => void;
    onBookSeat?: () => void; // Pour réservation de place (ticket_voyage)
}

const ProductCard: React.FC<ProductCardProps> = ({
    product,
    service,
    prestataire,
    userLocation = null, // ✅ NOUVEAU: Localisation utilisateur par défaut
    onPress,
    onChatPress,
    onGalleryPress,
    onBookSeat
}) => {
    const [showAllImages, setShowAllImages] = useState(false);
    const [selectedVariantIndex, setSelectedVariantIndex] = useState(0); // ✅ NOUVEAU: State global pour variantes
    const [mediaImages, setMediaImages] = useState<string[]>([]); // ✅ NOUVEAU: Images depuis table media
    const [mediaVideos, setMediaVideos] = useState<string[]>([]); // ✅ NOUVEAU: Vidéos depuis table media
    const [loadingMedia, setLoadingMedia] = useState(false);
    const [useMediaAPI, setUseMediaAPI] = useState(false); // ✅ Flag pour savoir si on utilise l'API

    // Récupérer la configuration intelligente de la catégorie
    const categoryConfig = getCategoryConfig(product.type || 'default');
    const categoryStyle = getCategoryStyle(product.type || 'default');
    const terminology = getCategoryTerminology(product.type || 'default');

    // ✅ NOUVEAU: Charger les médias depuis la table media si product_index disponible
    React.useEffect(() => {
        const loadMediaFromAPI = async () => {
            // Vérifier si on a product_index (nécessaire pour API)
            const productIndex = product._productIndex ?? product.productIndex;
            if (productIndex === undefined || !service?.id) {
                return; // Pas de product_index, utiliser JSON
            }

            try {
                setLoadingMedia(true);
                const { apiGet } = await import('../services/api');
                
                // Essayer de charger depuis l'API
                const response = await apiGet(`/api/media/product/${service.id}/${productIndex}/images`);
                
                if (response.success && response.images && response.images.length > 0) {
                    console.log(`[ProductCard] ✅ ${response.images.length} images chargées depuis API media`);
                    setMediaImages(response.images);
                    setUseMediaAPI(true);
                }
                
                // Charger vidéos aussi
                const videosResp = await apiGet(`/api/media/product/${service.id}/${productIndex}/videos`);
                if (videosResp.success && videosResp.videos && videosResp.videos.length > 0) {
                    console.log(`[ProductCard] ✅ ${videosResp.videos.length} vidéos chargées depuis API media`);
                    setMediaVideos(videosResp.videos);
                }
            } catch (error) {
                console.log('[ProductCard] Fallback vers product.images (JSON)', error);
                setUseMediaAPI(false);
            } finally {
                setLoadingMedia(false);
            }
        };

        loadMediaFromAPI();
    }, [product._productIndex, product.productIndex, service?.id]);

    // ✅ NOUVEAU: Gestion intelligente des variantes pour l'image principale
    const hasVariants = product.variants && product.variants.length > 0;
    const currentVariant = hasVariants ? product.variants[selectedVariantIndex] : null;
    const variantImage = currentVariant?.image;

    // ✅ NOUVEAU: Gestion des variantes de chaussures (Pointure × Couleur)
    const hasChaussureVariants = product.variantesChaussures && product.variantesChaussures.length > 0;
    const currentChaussureVariant = hasChaussureVariants ? product.variantesChaussures[selectedVariantIndex] : null;
    const chaussureVariantImage = currentChaussureVariant?.images?.[0];

    // ✅ NOUVEAU: Gestion des variantes de vêtements (Taille × Couleur)
    const hasVetementVariants = product.variantesVetements && product.variantesVetements.length > 0;
    const currentVetementVariant = hasVetementVariants ? product.variantesVetements[selectedVariantIndex] : null;
    const vetementVariantImage = currentVetementVariant?.images?.[0];

    // ✅ AMÉLIORATION: Utiliser médias depuis API si disponibles, sinon fallback vers JSON
    const images = useMediaAPI && mediaImages.length > 0 
        ? mediaImages 
        : (product.images || product.imagesRealisations || []);
    
    const videos = useMediaAPI && mediaVideos.length > 0 
        ? mediaVideos 
        : (product.videos || product.videosRealisations || []);
    
    const mainImage = vetementVariantImage || chaussureVariantImage || variantImage || images[0] || null; // ✅ Priorité aux variantes vêtements, chaussures, puis variantes génériques
    const hasVideo = videos.length > 0;

    // GPS prioritaire : produit > service gps_fixe > service gps
    const productGPS = product.gps || product.gpsFixe;
    const serviceGPS = service.data?.gps_fixe?.valeur || service.data?.gps_fixe || service.gps;
    const displayGPS = productGPS || serviceGPS;

    // ✅ NOUVEAU: Hook pour localisation intelligente avec drapeau du pays
    const { locationData, loading: locationLoading } = useLocationDisplay(service, prestataire);

    // ✅ NOUVEAU: Formater le prix avec gestion intelligente des variantes
    const formatPrice = () => {
        const devise = product.devise || 'FCFA';

        // Si le produit a des variantes, afficher la fourchette de prix
        if (hasVariants && product.variants.length > 1) {
            const prices = product.variants
                .map(v => parseFloat(v.prix))
                .filter(p => !isNaN(p) && p > 0)
                .sort((a, b) => a - b);

            if (prices.length > 0) {
                const minPrice = prices[0];
                const maxPrice = prices[prices.length - 1];

                if (minPrice === maxPrice) {
                    return `${minPrice.toLocaleString()} ${devise}`;
                }
                return `${minPrice.toLocaleString()} - ${maxPrice.toLocaleString()} ${devise}`;
            }
        }

        // Sinon, prix classique
        if (!product.prix) return null;
        return `${parseFloat(product.prix).toLocaleString()} ${devise}`;
    };

    // Obtenir l'icône et la couleur par type
    const getTypeStyle = () => {
        const styles = {
            immobilier_batiment: { icon: 'home', color: '#3B82F6', bg: '#EFF6FF', label: 'Immobilier' },
            immobilier_location_courte: { icon: 'calendar', color: '#F59E0B', bg: '#FEF3C7', label: 'Location Vacances' },
            immobilier_terrain: { icon: 'map', color: '#10B981', bg: '#D1FAE5', label: 'Terrain' },
            hotellerie: { icon: 'building', color: '#EC4899', bg: '#FCE7F3', label: 'Hôtel' },
            automobile: { icon: 'car', color: '#F59E0B', bg: '#FEF3C7', label: 'Auto' },
            mecanicien: { icon: 'tool', color: '#0EA5E9', bg: '#E0F2FE', label: 'Garage' },
            ticket_voyage: { icon: 'bus', color: '#8B5CF6', bg: '#F3E8FF', label: 'Voyage' },
            transport_intra_urbain: { icon: 'navigation', color: '#F59E0B', bg: '#FEF3C7', label: 'Course' },
            covoiturage: { icon: 'users', color: '#EC4899', bg: '#FCE7F3', label: 'Covoiturage' },
            vetement: { icon: 'shopping-bag', color: '#EF4444', bg: '#FEE2E2', label: 'Vêtement' },
            chaussure: { icon: 'shoe-prints', color: '#F97316', bg: '#FFEDD5', label: 'Chaussure' },
            electromenager: { icon: 'zap', color: '#14B8A6', bg: '#CCFBF1', label: 'Électro' },
            image_son: { icon: 'tv', color: '#9C27B0', bg: '#F3E5F5', label: 'Image/Son' },
            telephone: { icon: 'smartphone', color: '#FF9800', bg: '#FFF3E0', label: 'Téléphone' },
            reparateur_telephone: { icon: 'tool', color: '#10B981', bg: '#D1FAE5', label: 'Réparateur' },
            reparateur_telephone_tablette: { icon: 'tool', color: '#10B981', bg: '#D1FAE5', label: 'Réparateur' },
            reparation_telephone: { icon: 'tool', color: '#10B981', bg: '#D1FAE5', label: 'Réparateur' },
            ordinateur: { icon: 'monitor', color: '#00BCD4', bg: '#E0F7FA', label: 'Ordinateur' },
            mobilier: { icon: 'box', color: '#F97316', bg: '#FFEDD5', label: 'Mobilier' },
            decoration: { icon: 'image', color: '#E91E63', bg: '#FCE4EC', label: 'Déco' },
            ustensiles_cuisine: { icon: 'coffee', color: '#FF5722', bg: '#FFEBEE', label: 'Ustensiles' },
            pieces_auto: { icon: 'wrench', color: '#EF4444', bg: '#FEE2E2', label: 'Pièce Auto' },
            pieces_industrielles: { icon: 'settings', color: '#455A64', bg: '#ECEFF1', label: 'Pièce Indus.' },
            aliments: { icon: 'pizza', color: '#84CC16', bg: '#ECFCCB', label: 'Aliment' },
            assurance: { icon: 'shield', color: '#14B8A6', bg: '#CCFBF1', label: 'Assurance' },
            livres_fournitures: { icon: 'book', color: '#6366F1', bg: '#E0E7FF', label: 'Livre' },
            quincaillerie: { icon: 'tool', color: '#64748B', bg: '#F1F5F9', label: 'Quincaillerie' },
            pharmacie: { icon: 'activity', color: '#059669', bg: '#D1FAE5', label: 'Pharmacie' },
            hopital_clinique: { icon: 'heart', color: '#DC2626', bg: '#FEE2E2', label: 'Hôpital' },
            prestation_service: { icon: 'briefcase', color: '#8B5CF6', bg: '#F3E8FF', label: 'Service' },
            menuisier_aluminium: { icon: 'square', color: '#607D8B', bg: '#CFD8DC', label: 'Menuisier Alu' },
            menuiserie_aluminium: { icon: 'square', color: '#607D8B', bg: '#CFD8DC', label: 'Menuisier Alu' },
            menuiserie: { icon: 'hammer', color: '#EA580C', bg: '#FFF5F2', label: 'Menuiserie' },
            ebenisterie: { icon: 'scissors', color: '#F97316', bg: '#FFEDD5', label: 'Ébénisterie' },
            menuisier: { icon: 'hammer', color: '#EA580C', bg: '#FFF5F2', label: 'Menuisier' },
            forgeron: { icon: 'hammer', color: '#78909C', bg: '#CFD8DC', label: 'Forgeron' },
            ferronnerie: { icon: 'hammer', color: '#78909C', bg: '#CFD8DC', label: 'Forgeron' },
            demenagement: { icon: 'truck', color: '#F97316', bg: '#FEF3C7', label: 'Déménagement' },
            cosmetique_parfum: { icon: 'sparkle', color: '#EC4899', bg: '#FCE7F3', label: 'Cosmétique' },
            bijoux: { icon: 'gem', color: '#F59E0B', bg: '#FEF3C7', label: 'Bijoux' },
            coiffure_beaute: { icon: 'scissors', color: '#E91E63', bg: '#FCE4EC', label: 'Coiffure' },
            couturier: { icon: 'scissors', color: '#EC4899', bg: '#FCE7F3', label: 'Couturier' },
            nettoyage_entretien: { icon: 'home-outline', color: '#10B981', bg: '#D1FAE5', label: 'Nettoyage' },
            nettoyage: { icon: 'home-outline', color: '#10B981', bg: '#D1FAE5', label: 'Nettoyage' },
            autre: { icon: 'package', color: '#6B7280', bg: '#F3F4F6', label: 'Produit' }
        };
        return styles[product.type] || styles.autre;
    };

    const typeStyle = getTypeStyle();

    // Rendu spécialisé par type de produit
    const renderProductDetails = () => {
        switch (product.type) {
            case 'immobilier_batiment':
            case 'immobilier_location_courte': {
                // Badges de statut avec couleurs
                const getStatutColor = (statut: string) => {
                    if (statut === 'À vendre') return { bg: '#DBEAFE', text: '#1E40AF', border: '#3B82F6' };
                    if (statut === 'À louer' || statut?.includes('long terme')) return { bg: '#D1FAE5', text: '#065F46', border: '#10B981' };
                    if (statut === 'Location courte durée' || statut?.includes('courte')) return { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B' };
                    if (statut === 'Colocation') return { bg: '#F3E8FF', text: '#6B21A8', border: '#A855F7' };
                    return { bg: '#F3F4F6', text: '#374151', border: '#9CA3AF' };
                };

                const getStandingColor = (standing: string) => {
                    if (standing === 'Luxe') return { bg: '#FDF4FF', text: '#86198F', border: '#C026D3' };
                    if (standing === 'Haut standing') return { bg: '#EDE9FE', text: '#5B21B6', border: '#8B5CF6' };
                    if (standing === 'Standard') return { bg: '#E0F2FE', text: '#075985', border: '#0EA5E9' };
                    if (standing === 'Économique') return { bg: '#E0E7FF', text: '#3730A3', border: '#6366F1' };
                    return { bg: '#F3F4F6', text: '#374151', border: '#9CA3AF' };
                };

                const getEtatColor = (etat: string) => {
                    if (etat === 'Neuf') return { bg: '#D1FAE5', text: '#065F46', border: '#10B981' };
                    if (etat === 'Excellent état') return { bg: '#DBEAFE', text: '#1E40AF', border: '#3B82F6' };
                    if (etat === 'Bon état') return { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B' };
                    if (etat === 'À rénover') return { bg: '#FEE2E2', text: '#991B1B', border: '#EF4444' };
                    return { bg: '#F3F4F6', text: '#374151', border: '#9CA3AF' };
                };

                const statutColor = product.statutImmobilier ? getStatutColor(product.statutImmobilier) : null;
                const standingColor = product.standing ? getStandingColor(product.standing) : null;
                const etatColor = product.etatGeneral ? getEtatColor(product.etatGeneral) : null;

                return (
                    <View style={{ gap: 12 }}>
                        {/* Badges principaux */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {product.statutImmobilier && statutColor && (
                                <View style={[styles.immoStatutChip, { backgroundColor: statutColor.bg, borderColor: statutColor.border }]}>
                                    <Text style={[styles.immoStatutText, { color: statutColor.text }]}>
                                        {product.statutImmobilier}
                                    </Text>
                                </View>
                            )}
                            {product.standing && standingColor && (
                                <View style={[styles.immoStandingChip, { backgroundColor: standingColor.bg, borderColor: standingColor.border }]}>
                                    <Text style={[styles.immoStandingText, { color: standingColor.text }]}>
                                        {product.standing}
                                    </Text>
                                </View>
                            )}
                            {product.etatGeneral && etatColor && (
                                <View style={[styles.immoEtatChip, { backgroundColor: etatColor.bg, borderColor: etatColor.border }]}>
                                    <Text style={[styles.immoEtatText, { color: etatColor.text }]}>
                                        {product.etatGeneral}
                                    </Text>
                                </View>
                            )}
                            {product.disponibleImmediatement && (
                                <View style={styles.immoDispoChip}>
                                    <SafeIcon name="zap" size={12} color="#059669" />
                                    <Text style={styles.immoDispoText}>Disponible</Text>
                                </View>
                            )}
                        </View>

                        {/* Identité du bien */}
                        <View style={styles.immoIdentity}>
                            <Text style={styles.immoTypeText}>
                                🏠 {product.typeImmobilier || 'Bien immobilier'}
                                {product.anneeConstruction && ` • ${product.anneeConstruction}`}
                            </Text>
                        </View>

                        {/* Caractéristiques principales */}
                        <View style={styles.immoMainInfo}>
                            {product.superficie && (
                                <View style={styles.immoInfoItem}>
                                    <SafeIcon name="maximize-2" size={16} color="#6B7280" />
                                    <Text style={styles.immoInfoLabel}>{product.superficie} m²</Text>
                                </View>
                            )}
                            {product.nbChambres && (
                                <View style={styles.immoInfoItem}>
                                    <SafeIcon name="bed" size={16} color="#6B7280" />
                                    <Text style={styles.immoInfoLabel}>{product.nbChambres} ch.</Text>
                                </View>
                            )}
                            {product.nbSallesBain && (
                                <View style={styles.immoInfoItem}>
                                    <SafeIcon name="droplet" size={16} color="#6B7280" />
                                    <Text style={styles.immoInfoLabel}>{product.nbSallesBain} sdb</Text>
                                </View>
                            )}
                            {product.etage && (
                                <View style={styles.immoInfoItem}>
                                    <SafeIcon name="layers" size={16} color="#6B7280" />
                                    <Text style={styles.immoInfoLabel}>Étage {product.etage}</Text>
                                </View>
                            )}
                            {product.nbEtages && (
                                <View style={styles.immoInfoItem}>
                                    <SafeIcon name="building" size={16} color="#6B7280" />
                                    <Text style={styles.immoInfoLabel}>{product.nbEtages}</Text>
                                </View>
                            )}
                        </View>

                        {/* Ameublement */}
                        {product.ameublement && (
                            <View style={styles.immoAmeublementChip}>
                                <Text style={styles.immoAmeublementText}>🛋️ {product.ameublement}</Text>
                            </View>
                        )}

                        {/* Équipements */}
                        {(product.parking || product.ascenseur || product.jardin || product.piscine || product.securite || product.internet || product.climatisation || (product.equipementsImmo && product.equipementsImmo.length > 0)) && (
                            <View style={styles.immoEquipementsContainer}>
                                {product.parking && (
                                    <View style={styles.immoEquipTag}>
                                        <SafeIcon name="square-parking" size={12} color="#6366F1" />
                                        <Text style={styles.immoEquipText}>Parking{product.nbParkings ? ` (${product.nbParkings})` : ''}</Text>
                                    </View>
                                )}
                                {product.ascenseur && (
                                    <View style={styles.immoEquipTag}>
                                        <SafeIcon name="arrow-up-down" size={12} color="#6366F1" />
                                        <Text style={styles.immoEquipText}>Ascenseur</Text>
                                    </View>
                                )}
                                {product.jardin && (
                                    <View style={styles.immoEquipTag}>
                                        <SafeIcon name="tree-pine" size={12} color="#10B981" />
                                        <Text style={styles.immoEquipText}>Jardin</Text>
                                    </View>
                                )}
                                {product.piscine && (
                                    <View style={styles.immoEquipTag}>
                                        <Text style={{ fontSize: 12 }}>🏊</Text>
                                        <Text style={styles.immoEquipText}>Piscine</Text>
                                    </View>
                                )}
                                {product.securite && (
                                    <View style={styles.immoEquipTag}>
                                        <SafeIcon name="shield-check" size={12} color="#EF4444" />
                                        <Text style={styles.immoEquipText}>Sécurité 24h</Text>
                                    </View>
                                )}
                                {product.internet && (
                                    <View style={styles.immoEquipTag}>
                                        <SafeIcon name="wifi" size={12} color="#6366F1" />
                                        <Text style={styles.immoEquipText}>Internet</Text>
                                    </View>
                                )}
                                {product.climatisation && (
                                    <View style={styles.immoEquipTag}>
                                        <SafeIcon name="wind" size={12} color="#0EA5E9" />
                                        <Text style={styles.immoEquipText}>Clim.</Text>
                                    </View>
                                )}
                                {product.equipementsImmo && product.equipementsImmo.slice(0, 3).map((equip, idx) => (
                                    <View key={idx} style={styles.immoEquipTag}>
                                        <Text style={styles.immoEquipText}>{equip}</Text>
                                    </View>
                                ))}
                            </View>
                        )}

                        {/* Informations spécifiques LOCATION COURTE DURÉE */}
                        {(product.statutImmobilier === 'Location courte durée' || product.statutImmobilier?.includes('courte')) && (
                            <View style={styles.immoLocationCourte}>
                                {product.prixParNuit && (
                                    <View style={styles.immoPrixNuit}>
                                        <Text style={styles.immoPrixNuitText}>
                                            💰 {product.prixParNuit} XAF / nuit
                                        </Text>
                                    </View>
                                )}
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                    {(product.capacites || product.capacitePersonnes) && (
                                        <View style={styles.immoLocationCourteTag}>
                                            <SafeIcon name="users" size={12} color="#059669" />
                                            <Text style={styles.immoLocationCourteText}>{product.capacites || product.capacitePersonnes}</Text>
                                        </View>
                                    )}
                                    {product.dureeMinimum && (
                                        <View style={styles.immoLocationCourteTag}>
                                            <SafeIcon name="clock" size={12} color="#059669" />
                                            <Text style={styles.immoLocationCourteText}>Min: {product.dureeMinimum}</Text>
                                        </View>
                                    )}
                                    {product.dureeMaximum && (
                                        <View style={styles.immoLocationCourteTag}>
                                            <SafeIcon name="calendar" size={12} color="#059669" />
                                            <Text style={styles.immoLocationCourteText}>Max: {product.dureeMaximum}</Text>
                                        </View>
                                    )}
                                    {product.nettoyageInclus && (
                                        <View style={styles.immoTrueBadge}>
                                            <SafeIcon name="check-circle" size={12} color="#059669" />
                                            <Text style={styles.immoTrueText}>Ménage inclus</Text>
                                        </View>
                                    )}
                                    {product.lingeInclus && (
                                        <View style={styles.immoTrueBadge}>
                                            <SafeIcon name="check-circle" size={12} color="#059669" />
                                            <Text style={styles.immoTrueText}>Linge fourni</Text>
                                        </View>
                                    )}
                                    {product.reservationInstantanee && (
                                        <View style={styles.immoTrueBadge}>
                                            <SafeIcon name="zap" size={12} color="#F59E0B" />
                                            <Text style={[styles.immoTrueText, { color: '#F59E0B' }]}>Réservation instantanée</Text>
                                        </View>
                                    )}
                                </View>

                                {/* Politique d'annulation */}
                                {product.politiqueAnnulation && (
                                    <View style={{ marginTop: 8 }}>
                                        <Text style={[styles.immoExtraText, { fontSize: 11 }]}>
                                            📋 {product.politiqueAnnulation}
                                        </Text>
                                    </View>
                                )}

                                {/* Règles de la maison */}
                                {product.regles && product.regles.length > 0 && (
                                    <View style={{ marginTop: 8 }}>
                                        <Text style={[styles.immoExtraText, { fontSize: 11, fontWeight: '600', marginBottom: 4 }]}>
                                            📜 Règles:
                                        </Text>
                                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                                            {product.regles.slice(0, 4).map((regle, idx) => (
                                                <View key={idx} style={styles.immoEquipTag}>
                                                    <Text style={[styles.immoEquipText, { fontSize: 10 }]}>{regle}</Text>
                                                </View>
                                            ))}
                                            {product.regles.length > 4 && (
                                                <Text style={[styles.immoExtraText, { fontSize: 10, color: '#6B7280' }]}>
                                                    +{product.regles.length - 4}
                                                </Text>
                                            )}
                                        </View>
                                    </View>
                                )}

                                {/* Type d'hôte et langues */}
                                {(product.type_hote || (product.langues_hote && product.langues_hote.length > 0)) && (
                                    <View style={{ marginTop: 8 }}>
                                        {product.type_hote && (
                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                                                <SafeIcon name="user-check" size={12} color="#6366F1" />
                                                <Text style={[styles.immoExtraText, { fontSize: 11, marginLeft: 4 }]}>
                                                    {product.type_hote}
                                                </Text>
                                            </View>
                                        )}
                                        {product.langues_hote && product.langues_hote.length > 0 && (
                                            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                                                <SafeIcon name="languages" size={12} color="#10B981" />
                                                <Text style={[styles.immoExtraText, { fontSize: 11, marginLeft: 4 }]}>
                                                    {product.langues_hote.slice(0, 3).join(', ')}
                                                    {product.langues_hote.length > 3 && ` +${product.langues_hote.length - 3}`}
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                )}

                                {/* Disponibilité */}
                                {product.disponibilites && product.disponibilites.length > 0 && (
                                    <View style={{ marginTop: 8 }}>
                                        <Text style={[styles.immoExtraText, { fontSize: 11, fontWeight: '600', marginBottom: 4 }]}>
                                            📅 Disponibilité:
                                        </Text>
                                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                                            {product.disponibilites.map((dispo, idx) => (
                                                <View key={idx} style={[styles.immoEquipTag, { backgroundColor: '#EFF6FF', borderColor: '#3B82F6' }]}>
                                                    <Text style={[styles.immoEquipText, { fontSize: 10, color: '#1E40AF' }]}>{dispo}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    </View>
                                )}

                                {/* Services supplémentaires */}
                                {product.servicesLocationCourte && product.servicesLocationCourte.length > 0 && (
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                                        {product.servicesLocationCourte.slice(0, 3).map((service, idx) => (
                                            <View key={idx} style={styles.immoEquipTag}>
                                                <Text style={[styles.immoEquipText, { fontSize: 10 }]}>✨ {service}</Text>
                                            </View>
                                        ))}
                                        {product.servicesLocationCourte.length > 3 && (
                                            <Text style={[styles.immoExtraText, { fontSize: 10, color: '#6B7280' }]}>
                                                +{product.servicesLocationCourte.length - 3} services
                                            </Text>
                                        )}
                                    </View>
                                )}

                                {/* Proximités importantes */}
                                {product.proximites && product.proximites.length > 0 && (
                                    <View style={{ marginTop: 8 }}>
                                        <Text style={[styles.immoExtraText, { fontSize: 11, fontWeight: '600', marginBottom: 4 }]}>
                                            📍 Proximités:
                                        </Text>
                                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                                            {product.proximites.slice(0, 5).map((prox, idx) => (
                                                <View key={idx} style={styles.immoEquipTag}>
                                                    <Text style={[styles.immoEquipText, { fontSize: 10 }]}>{prox}</Text>
                                                </View>
                                            ))}
                                            {product.proximites.length > 5 && (
                                                <Text style={[styles.immoExtraText, { fontSize: 10, color: '#6B7280' }]}>
                                                    +{product.proximites.length - 5}
                                                </Text>
                                            )}
                                        </View>
                                    </View>
                                )}

                                {/* Modes de paiement */}
                                {product.paiements && product.paiements.length > 0 && (
                                    <View style={{ marginTop: 8 }}>
                                        <Text style={[styles.immoExtraText, { fontSize: 11, fontWeight: '600', marginBottom: 4 }]}>
                                            💳 Paiements acceptés:
                                        </Text>
                                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                                            {product.paiements.slice(0, 4).map((paiement, idx) => (
                                                <View key={idx} style={[styles.immoEquipTag, { backgroundColor: '#ECFCCB', borderColor: '#84CC16' }]}>
                                                    <Text style={[styles.immoEquipText, { fontSize: 10, color: '#365314' }]}>{paiement}</Text>
                                                </View>
                                            ))}
                                            {product.paiements.length > 4 && (
                                                <Text style={[styles.immoExtraText, { fontSize: 10, color: '#6B7280' }]}>
                                                    +{product.paiements.length - 4} autres
                                                </Text>
                                            )}
                                        </View>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* Informations spécifiques location/vente LONG TERME */}
                        {(product.statutImmobilier !== 'Location courte durée' && !product.statutImmobilier?.includes('courte')) &&
                            (product.chargesMensuelles || product.caution || product.titreFoncier || product.prixNegociable) && (
                                <View style={styles.immoExtraInfo}>
                                    {product.chargesMensuelles && (
                                        <Text style={styles.immoExtraText}>💰 Charges: {product.chargesMensuelles} XAF/mois</Text>
                                    )}
                                    {product.caution && (
                                        <Text style={styles.immoExtraText}>🔒 Caution: {product.caution} mois</Text>
                                    )}
                                    {product.bailMinimum && (
                                        <Text style={styles.immoExtraText}>📅 Bail: {product.bailMinimum}</Text>
                                    )}
                                    {product.titreFoncier && (
                                        <View style={styles.immoTrueBadge}>
                                            <SafeIcon name="file-check" size={12} color="#059669" />
                                            <Text style={styles.immoTrueText}>Titre foncier</Text>
                                        </View>
                                    )}
                                    {product.prixNegociable && (
                                        <View style={styles.immoTrueBadge}>
                                            <SafeIcon name="trending-down" size={12} color="#059669" />
                                            <Text style={styles.immoTrueText}>Prix négociable</Text>
                                        </View>
                                    )}
                                </View>
                            )}

                        {/* Localisation */}
                        {(product.quartier || product.ville) && (
                            <View style={styles.immoLocation}>
                                <SafeIcon name="map-pin" size={14} color="#6B7280" />
                                <Text style={styles.immoLocationText}>
                                    {product.quartier && product.ville ? `${product.quartier}, ${product.ville}` : product.quartier || product.ville}
                                </Text>
                            </View>
                        )}

                        {/* ✅ NOUVEAU: Accès routier */}
                        {product.acces_route && (
                            <View style={styles.immoAccesChip}>
                                <SafeIcon name="car" size={12} color="#059669" />
                                <Text style={styles.immoAccesText}>{product.acces_route}</Text>
                            </View>
                        )}

                        {/* ✅ NOUVEAU: Proximités (3 premières) */}
                        {product.proximites && product.proximites.length > 0 && (
                            <View style={styles.immoProximites}>
                                <Text style={styles.immoProximitesLabel}>📍 À proximité:</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                                    {product.proximites.slice(0, 3).map((prox, idx) => (
                                        <View key={idx} style={styles.immoProxTag}>
                                            <Text style={styles.immoProxText}>{prox}</Text>
                                        </View>
                                    ))}
                                    {product.proximites.length > 3 && (
                                        <View style={styles.immoProxTag}>
                                            <Text style={styles.immoProxText}>+{product.proximites.length - 3}</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* ✅ NOUVEAU: Conditions location (pour les locations) */}
                        {(product.statutImmobilier === 'À louer' || product.statutImmobilier === 'À louer (bail)' || product.statutImmobilier === 'À louer meublé' || product.statutImmobilier === 'Colocation') &&
                            product.conditions_location && product.conditions_location.length > 0 && (
                                <View style={styles.immoConditions}>
                                    <Text style={styles.immoConditionsLabel}>📋 Conditions:</Text>
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                                        {product.conditions_location.slice(0, 3).map((cond, idx) => (
                                            <View key={idx} style={styles.immoCondTag}>
                                                <Text style={styles.immoCondText}>{cond}</Text>
                                            </View>
                                        ))}
                                        {product.conditions_location.length > 3 && (
                                            <View style={styles.immoCondTag}>
                                                <Text style={styles.immoCondText}>+{product.conditions_location.length - 3}</Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            )}
                    </View>
                );
            }

            case 'immobilier_terrain': {
                const getViabilisationColor = (viab: string) => {
                    if (viab === 'Viabilisé') return { bg: '#D1FAE5', text: '#065F46', border: '#10B981' };
                    if (viab === 'Partiellement viabilisé') return { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B' };
                    if (viab === 'Non viabilisé') return { bg: '#FEE2E2', text: '#991B1B', border: '#EF4444' };
                    return { bg: '#F3F4F6', text: '#374151', border: '#9CA3AF' };
                };

                const viabilisationColor = product.viabilisation ? getViabilisationColor(product.viabilisation) : null;
                const prixM2 = product.prixMetreCarre ? parseFloat(product.prixMetreCarre) : (product.prix && product.superficie ? parseFloat(product.prix) / parseFloat(product.superficie) : null);

                return (
                    <View style={{ gap: 12 }}>
                        {/* Badges principaux */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {product.statutImmobilier && (
                                <View style={[styles.terrainStatutChip, { backgroundColor: product.statutImmobilier === 'À vendre' ? '#DBEAFE' : '#D1FAE5', borderColor: product.statutImmobilier === 'À vendre' ? '#3B82F6' : '#10B981' }]}>
                                    <Text style={[styles.terrainStatutText, { color: product.statutImmobilier === 'À vendre' ? '#1E40AF' : '#065F46' }]}>
                                        {product.statutImmobilier}
                                    </Text>
                                </View>
                            )}
                            {product.viabilisation && viabilisationColor && (
                                <View style={[styles.terrainViabChip, { backgroundColor: viabilisationColor.bg, borderColor: viabilisationColor.border }]}>
                                    <Text style={[styles.terrainViabText, { color: viabilisationColor.text }]}>
                                        {product.viabilisation}
                                    </Text>
                                </View>
                            )}
                            {product.titreFoncier && (
                                <View style={styles.terrainTitreChip}>
                                    <SafeIcon name="file-check" size={12} color="#059669" />
                                    <Text style={styles.terrainTitreText}>Titre foncier</Text>
                                </View>
                            )}
                        </View>

                        {/* Type de terrain */}
                        <View style={styles.terrainIdentity}>
                            <Text style={styles.terrainTypeText}>
                                🏞️ {product.typeTerrain || 'Terrain'} {product.zonage ? `• ${product.zonage}` : ''}
                            </Text>
                        </View>

                        {/* Dimensions principales */}
                        <View style={styles.terrainDimensionsCard}>
                            {product.superficie && (
                                <View style={styles.terrainDimItem}>
                                    <SafeIcon name="maximize-2" size={18} color="#10B981" />
                                    <View>
                                        <Text style={styles.terrainDimValue}>{product.superficie} m²</Text>
                                        <Text style={styles.terrainDimLabel}>Superficie</Text>
                                    </View>
                                </View>
                            )}
                            {prixM2 && (
                                <View style={styles.terrainDimItem}>
                                    <SafeIcon name="trending-up" size={18} color="#10B981" />
                                    <View>
                                        <Text style={styles.terrainDimValue}>{prixM2.toLocaleString()} XAF/m²</Text>
                                        <Text style={styles.terrainDimLabel}>Prix au m²</Text>
                                    </View>
                                </View>
                            )}
                            {(product.largeurFacade && product.profondeur) && (
                                <View style={styles.terrainDimItem}>
                                    <SafeIcon name="square" size={18} color="#10B981" />
                                    <View>
                                        <Text style={styles.terrainDimValue}>{product.largeurFacade}m x {product.profondeur}m</Text>
                                        <Text style={styles.terrainDimLabel}>Dimensions</Text>
                                    </View>
                                </View>
                            )}
                        </View>

                        {/* Caractéristiques */}
                        <View style={styles.terrainCaracContainer}>
                            {product.topographie && (
                                <View style={styles.terrainCaracTag}>
                                    <Text style={styles.terrainCaracText}>⛰️ {product.topographie}</Text>
                                </View>
                            )}
                            {product.formeTerrain && (
                                <View style={styles.terrainCaracTag}>
                                    <Text style={styles.terrainCaracText}>📐 {product.formeTerrain}</Text>
                                </View>
                            )}
                            {product.accesTerrain && (
                                <View style={styles.terrainCaracTag}>
                                    <Text style={styles.terrainCaracText}>🚗 {product.accesTerrain}</Text>
                                </View>
                            )}
                            {product.vegetation && (
                                <View style={styles.terrainCaracTag}>
                                    <Text style={styles.terrainCaracText}>🌳 {product.vegetation}</Text>
                                </View>
                            )}
                            {product.usageActuel && (
                                <View style={styles.terrainCaracTag}>
                                    <Text style={styles.terrainCaracText}>📍 {product.usageActuel}</Text>
                                </View>
                            )}
                        </View>

                        {/* Réseaux disponibles */}
                        {product.reseauxTerrain && product.reseauxTerrain.length > 0 && (
                            <View style={styles.terrainReseauxContainer}>
                                <Text style={styles.terrainReseauxTitle}>⚡ Réseaux disponibles:</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                                    {product.reseauxTerrain.map((reseau, idx) => (
                                        <View key={idx} style={styles.terrainReseauTag}>
                                            <Text style={styles.terrainReseauText}>{reseau}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}

                        {/* Documents fonciers */}
                        {product.documentsFonciers && product.documentsFonciers.length > 0 && (
                            <View style={styles.terrainReseauxContainer}>
                                <Text style={styles.terrainReseauxTitle}>📄 Documents fonciers:</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                                    {product.documentsFonciers.map((doc, idx) => (
                                        <View key={idx} style={styles.terrainReseauTag}>
                                            <Text style={styles.terrainReseauText}>{doc}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}

                        {/* Nature du sol */}
                        {product.natureSol && (
                            <View style={styles.terrainCaracTag}>
                                <Text style={styles.terrainCaracText}>🏔️ Sol: {product.natureSol}</Text>
                            </View>
                        )}

                        {/* Potentiel d'usage */}
                        {product.potentielUsage && product.potentielUsage.length > 0 && (
                            <View style={styles.terrainReseauxContainer}>
                                <Text style={styles.terrainReseauxTitle}>💡 Potentiel d'usage:</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                                    {product.potentielUsage.map((usage, idx) => (
                                        <View key={idx} style={styles.terrainReseauTag}>
                                            <Text style={styles.terrainReseauText}>{usage}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}

                        {/* Proximités */}
                        {product.proximitesTerrain && product.proximitesTerrain.length > 0 && (
                            <View style={styles.terrainReseauxContainer}>
                                <Text style={styles.terrainReseauxTitle}>📍 Proximités:</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                                    {product.proximitesTerrain.slice(0, 5).map((prox, idx) => (
                                        <View key={idx} style={styles.terrainReseauTag}>
                                            <Text style={styles.terrainReseauText}>{prox}</Text>
                                        </View>
                                    ))}
                                    {product.proximitesTerrain.length > 5 && (
                                        <View style={styles.terrainReseauTag}>
                                            <Text style={styles.terrainReseauText}>+{product.proximitesTerrain.length - 5}</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* Contraintes */}
                        {product.contraintesTerrain && product.contraintesTerrain.length > 0 && product.contraintesTerrain.some(c => c !== 'Aucune contrainte') && (
                            <View style={styles.terrainReseauxContainer}>
                                <Text style={[styles.terrainReseauxTitle, { color: '#DC2626' }]}>⚠️ Contraintes:</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                                    {product.contraintesTerrain.filter(c => c !== 'Aucune contrainte').map((contrainte, idx) => (
                                        <View key={idx} style={[styles.terrainReseauTag, { backgroundColor: '#FEE2E2', borderColor: '#EF4444' }]}>
                                            <Text style={[styles.terrainReseauText, { color: '#991B1B' }]}>{contrainte}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}

                        {/* Badges juridiques détaillés */}
                        <View style={styles.terrainJuridiqueContainer}>
                            {/* État du bornage détaillé */}
                            {product.etatBornage && (
                                <View style={styles.terrainJuridiqueBadge}>
                                    <SafeIcon name="square-dashed" size={12} color="#059669" />
                                    <Text style={styles.terrainJuridiqueText}>{product.etatBornage}</Text>
                                </View>
                            )}
                            {/* Constructibilité détaillée */}
                            {product.niveauConstructibilite && (
                                <View style={styles.terrainJuridiqueBadge}>
                                    <SafeIcon name="hammer" size={12} color="#059669" />
                                    <Text style={styles.terrainJuridiqueText}>{product.niveauConstructibilite}</Text>
                                </View>
                            )}
                            {/* Type de clôture */}
                            {product.typeCloture && (
                                <View style={styles.terrainJuridiqueBadge}>
                                    <SafeIcon name="fence" size={12} color="#059669" />
                                    <Text style={styles.terrainJuridiqueText}>{product.typeCloture}</Text>
                                </View>
                            )}
                            {/* Fallback sur les anciennes valeurs booléennes */}
                            {!product.etatBornage && product.bornage && (
                                <View style={styles.terrainJuridiqueBadge}>
                                    <SafeIcon name="square-dashed" size={12} color="#059669" />
                                    <Text style={styles.terrainJuridiqueText}>Borné</Text>
                                </View>
                            )}
                            {!product.niveauConstructibilite && product.constructibilite && (
                                <View style={styles.terrainJuridiqueBadge}>
                                    <SafeIcon name="hammer" size={12} color="#059669" />
                                    <Text style={styles.terrainJuridiqueText}>Constructible</Text>
                                </View>
                            )}
                            {!product.typeCloture && product.cloture && (
                                <View style={styles.terrainJuridiqueBadge}>
                                    <SafeIcon name="fence" size={12} color="#059669" />
                                    <Text style={styles.terrainJuridiqueText}>Clôturé</Text>
                                </View>
                            )}
                        </View>

                        {/* Orientation */}
                        {product.orientationTerrain && (
                            <View style={styles.terrainCaracTag}>
                                <Text style={styles.terrainCaracText}>🧭 Orientation: {product.orientationTerrain}</Text>
                            </View>
                        )}

                        {/* Localisation */}
                        {(product.quartier || product.ville) && (
                            <View style={styles.terrainLocation}>
                                <SafeIcon name="map-pin" size={14} color="#6B7280" />
                                <Text style={styles.terrainLocationText}>
                                    {product.quartier && product.ville ? `${product.quartier}, ${product.ville}` : product.quartier || product.ville}
                                </Text>
                            </View>
                        )}
                    </View>
                );
            }

            case 'automobile': {
                const km = parseFloat(product.kilometrage || '0');
                const kmLevel = km < 50000 ? 'low' : km < 150000 ? 'medium' : 'high';
                const anneeInt = parseInt(product.annee || '0');
                const isRecent = anneeInt >= new Date().getFullYear() - 5;

                return (
                    <View style={styles.detailsSection}>
                        {/* Type de véhicule */}
                        {product.typeVehicule && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="truck" size={14} color="#EF4444" />
                                <Text style={styles.detailText}>{product.typeVehicule}</Text>
                            </View>
                        )}

                        {/* Badge État avec couleur */}
                        {product.etatVehicule && (
                            <View style={[
                                styles.detailChip,
                                product.etatVehicule === 'Neuf' ? styles.neufChip :
                                    product.etatVehicule === 'Accidenté' ? styles.accidenteChip :
                                        styles.occasionChip
                            ]}>
                                <Text style={[
                                    styles.detailText,
                                    product.etatVehicule === 'Neuf' ? styles.neufText :
                                        product.etatVehicule === 'Accidenté' ? styles.accidenteText :
                                            styles.occasionText
                                ]}>
                                    {product.etatVehicule === 'Neuf' ? '✨' : product.etatVehicule === 'Accidenté' ? '⚠️' : '🔧'} {product.etatVehicule}
                                </Text>
                            </View>
                        )}

                        {/* Badge véhicule récent */}
                        {isRecent && product.etatVehicule !== 'Accidenté' && (
                            <View style={[styles.detailChip, styles.recentChip]}>
                                <SafeIcon name="star" size={14} color="#10B981" />
                                <Text style={[styles.detailText, styles.recentText]}>Récent ({product.annee})</Text>
                            </View>
                        )}

                        {/* Première main */}
                        {product.premiereMain && (
                            <View style={[styles.detailChip, styles.premierMainChip]}>
                                <Text style={[styles.detailText, styles.premierMainText]}>⭐ 1ère main</Text>
                            </View>
                        )}

                        {/* Marque et Modèle */}
                        <View style={styles.vehicleIdentity}>
                            <Text style={styles.vehicleIdentityText}>
                                🏷️ {product.marqueAutomobile || product.marque} {product.modeleAutomobile || product.modele}
                                {product.typeCarrosserie && ` (${product.typeCarrosserie})`}
                            </Text>
                        </View>

                        {/* Informations techniques */}
                        <View style={styles.technicalInfoContainer}>
                            {product.annee && !isRecent && (
                                <View style={styles.detailChip}>
                                    <SafeIcon name="calendar" size={14} color="#6B7280" />
                                    <Text style={styles.detailText}>{product.annee}</Text>
                                </View>
                            )}
                            {product.kilometrage && (
                                <View style={[
                                    styles.detailChip,
                                    kmLevel === 'low' ? styles.kmLowChip :
                                        kmLevel === 'high' ? styles.kmHighChip :
                                            null
                                ]}>
                                    <SafeIcon name="activity" size={14} color={
                                        kmLevel === 'low' ? '#10B981' :
                                            kmLevel === 'high' ? '#EF4444' :
                                                '#6B7280'
                                    } />
                                    <Text style={[
                                        styles.detailText,
                                        kmLevel === 'low' ? styles.kmLowText :
                                            kmLevel === 'high' ? styles.kmHighText :
                                                null
                                    ]}>
                                        {parseInt(product.kilometrage).toLocaleString()} km
                                        {kmLevel === 'low' && ' 🟢'}
                                        {kmLevel === 'high' && ' 🔴'}
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Carburant, Transmission, Couleur */}
                        <View style={styles.technicalGrid}>
                            {product.typeCarburant && (
                                <View style={styles.detailChip}>
                                    <Text style={styles.detailText}>⛽ {product.typeCarburant}</Text>
                                </View>
                            )}
                            {product.transmission && (
                                <View style={styles.detailChip}>
                                    <Text style={styles.detailText}>⚙️ {product.transmission}</Text>
                                </View>
                            )}
                            {product.couleurAutomobile && (
                                <View style={styles.detailChip}>
                                    <Text style={styles.detailText}>🎨 {product.couleurAutomobile}</Text>
                                </View>
                            )}
                        </View>

                        {/* Caractéristiques supplémentaires */}
                        {(product.nbPortes || product.nbPlaces || product.puissance || product.cylindree) && (
                            <View style={styles.technicalGrid}>
                                {product.nbPortes && (
                                    <View style={styles.detailChip}>
                                        <SafeIcon name="layout" size={14} color="#6B7280" />
                                        <Text style={styles.detailText}>{product.nbPortes} portes</Text>
                                    </View>
                                )}
                                {product.nbPlaces && (
                                    <View style={styles.detailChip}>
                                        <SafeIcon name="users" size={14} color="#6B7280" />
                                        <Text style={styles.detailText}>{product.nbPlaces} places</Text>
                                    </View>
                                )}
                                {product.puissance && (
                                    <View style={styles.detailChip}>
                                        <SafeIcon name="zap" size={14} color="#6B7280" />
                                        <Text style={styles.detailText}>{product.puissance} CV</Text>
                                    </View>
                                )}
                                {product.cylindree && (
                                    <View style={styles.detailChip}>
                                        <SafeIcon name="settings" size={14} color="#6B7280" />
                                        <Text style={styles.detailText}>{product.cylindree} cm³</Text>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* Équipements */}
                        {product.equipementsAuto && Array.isArray(product.equipementsAuto) && product.equipementsAuto.length > 0 && (
                            <View style={styles.equipementsContainer}>
                                <Text style={styles.prestationLabel}>Équipements :</Text>
                                <View style={styles.tagsContainer}>
                                    {product.equipementsAuto.slice(0, 6).map((equip: string, idx: number) => (
                                        <View key={idx} style={styles.equipTag}>
                                            <Text style={styles.equipText}>{equip}</Text>
                                        </View>
                                    ))}
                                    {product.equipementsAuto.length > 6 && (
                                        <View style={styles.equipTag}>
                                            <Text style={styles.equipText}>+{product.equipementsAuto.length - 6}</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* Badges de confiance */}
                        <View style={styles.trustBadgesContainer}>
                            {product.contreTechnique && (
                                <View style={[styles.detailChip, styles.successChip]}>
                                    <SafeIcon name="check-circle" size={14} color="#10B981" />
                                    <Text style={[styles.detailText, styles.successText]}>Contrôle technique ✅</Text>
                                </View>
                            )}
                            {product.historiqueEntretien && (
                                <View style={[styles.detailChip, styles.successChip]}>
                                    <SafeIcon name="file-text" size={14} color="#10B981" />
                                    <Text style={[styles.detailText, styles.successText]}>Historique entretien 📋</Text>
                                </View>
                            )}
                            {product.garantie && (
                                <View style={[styles.detailChip, styles.successChip]}>
                                    <SafeIcon name="shield" size={14} color="#10B981" />
                                    <Text style={[styles.detailText, styles.successText]}>Garantie: {product.garantie}</Text>
                                </View>
                            )}
                        </View>
                    </View>
                );
            }

            case 'mecanicien': {
                return (
                    <View style={styles.detailsSection}>
                        {/* Nom du garage */}
                        {product.nomGarage && (
                            <View style={styles.mecanicienIdentity}>
                                <Text style={styles.mecanicienIdentityText}>
                                    🔧 {product.nomGarage}
                                </Text>
                            </View>
                        )}

                        {/* Spécialités principales */}
                        {product.specialitesGarage && product.specialitesGarage.length > 0 && (
                            <View style={styles.mecanicienSpecialites}>
                                <Text style={styles.mecanicienSpecialitesTitle}>Spécialités :</Text>
                                <View style={styles.tagsContainer}>
                                    {product.specialitesGarage.slice(0, 4).map((spec: string, idx: number) => (
                                        <View key={idx} style={styles.mecanicienSpecTag}>
                                            <Text style={styles.mecanicienSpecText}>{spec}</Text>
                                        </View>
                                    ))}
                                    {product.specialitesGarage.length > 4 && (
                                        <View style={styles.mecanicienSpecTag}>
                                            <Text style={styles.mecanicienSpecText}>+{product.specialitesGarage.length - 4}</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* Services proposés */}
                        {product.typeServiceMecanique && product.typeServiceMecanique.length > 0 && (
                            <View style={styles.mecanicienServices}>
                                <Text style={styles.prestationLabel}>Services :</Text>
                                <View style={styles.tagsContainer}>
                                    {product.typeServiceMecanique.slice(0, 5).map((service: string, idx: number) => (
                                        <View key={idx} style={styles.serviceTag}>
                                            <Text style={styles.serviceText}>{service}</Text>
                                        </View>
                                    ))}
                                    {product.typeServiceMecanique.length > 5 && (
                                        <View style={styles.serviceTag}>
                                            <Text style={styles.serviceText}>+{product.typeServiceMecanique.length - 5} services</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* Marques traitées */}
                        {product.marquesVehicules && product.marquesVehicules.length > 0 && (
                            <View style={styles.mecanicienMarques}>
                                <Text style={styles.prestationLabel}>Marques :</Text>
                                <View style={styles.tagsContainer}>
                                    {product.marquesVehicules.slice(0, 6).map((marque: string, idx: number) => (
                                        <View key={idx} style={styles.marqueTag}>
                                            <Text style={styles.marqueText}>{marque}</Text>
                                        </View>
                                    ))}
                                    {product.marquesVehicules.length > 6 && (
                                        <View style={styles.marqueTag}>
                                            <Text style={styles.marqueText}>+{product.marquesVehicules.length - 6}</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* Certifications */}
                        {product.certificationsMeca && product.certificationsMeca.length > 0 && (
                            <View style={styles.mecanicienCertifications}>
                                <Text style={styles.prestationLabel}>Certifications :</Text>
                                <View style={styles.tagsContainer}>
                                    {product.certificationsMeca.slice(0, 3).map((cert: string, idx: number) => (
                                        <View key={idx} style={styles.certificationTag}>
                                            <SafeIcon name="award" size={12} color="#10B981" />
                                            <Text style={styles.certificationText}>{cert}</Text>
                                        </View>
                                    ))}
                                    {product.certificationsMeca.length > 3 && (
                                        <View style={styles.certificationTag}>
                                            <Text style={styles.certificationText}>+{product.certificationsMeca.length - 3}</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* Horaires & Disponibilité */}
                        <View style={styles.mecanicienInfos}>
                            {product.horairesGarage && (
                                <View style={styles.detailChip}>
                                    <SafeIcon name="clock" size={14} color="#6B7280" />
                                    <Text style={styles.detailText}>{product.horairesGarage}</Text>
                                </View>
                            )}
                            {product.delaisIntervention && (
                                <View style={styles.detailChip}>
                                    <SafeIcon name="zap" size={14} color="#F59E0B" />
                                    <Text style={styles.detailText}>{product.delaisIntervention}</Text>
                                </View>
                            )}
                            {product.urgenceMeca && product.urgenceMeca.includes('24h') && (
                                <View style={[styles.detailChip, styles.urgenceChip]}>
                                    <SafeIcon name="alert-circle" size={14} color="#EF4444" />
                                    <Text style={[styles.detailText, styles.urgenceText]}>Dépannage 24h/24</Text>
                                </View>
                            )}
                        </View>

                        {/* Options & Services */}
                        <View style={styles.mecanicienOptions}>
                            {product.devisGratuit && (
                                <View style={[styles.detailChip, styles.successChip]}>
                                    <SafeIcon name="check-circle" size={14} color="#10B981" />
                                    <Text style={[styles.detailText, styles.successText]}>Devis gratuit</Text>
                                </View>
                            )}
                            {product.garantieReparations && (
                                <View style={[styles.detailChip, styles.successChip]}>
                                    <SafeIcon name="shield" size={14} color="#10B981" />
                                    <Text style={[styles.detailText, styles.successText]}>Garantie réparations</Text>
                                </View>
                            )}
                            {product.vehiculeCourtoisie && (
                                <View style={[styles.detailChip, styles.successChip]}>
                                    <SafeIcon name="truck" size={14} color="#10B981" />
                                    <Text style={[styles.detailText, styles.successText]}>Véhicule de courtoisie</Text>
                                </View>
                            )}
                            {product.enlevementVehicule && (
                                <View style={[styles.detailChip, styles.successChip]}>
                                    <SafeIcon name="navigation" size={14} color="#10B981" />
                                    <Text style={[styles.detailText, styles.successText]}>Enlèvement véhicule</Text>
                                </View>
                            )}
                        </View>
                    </View>
                );
            }

            case 'hotellerie':
                return (
                    <View style={styles.detailsGrid}>
                        {product.typeHebergement && (
                            <View style={styles.detailChip}>
                                <Text style={styles.detailText}>🏨 {product.typeHebergement}</Text>
                            </View>
                        )}
                        {product.categorieHotel && (
                            <View style={styles.detailChip}>
                                <Text style={styles.detailText}>⭐ {product.categorieHotel}</Text>
                            </View>
                        )}
                        {product.prixParNuit && (
                            <View style={styles.detailChip}>
                                <Text style={styles.detailText}>💰 {product.prixParNuit} FCFA/nuit</Text>
                            </View>
                        )}
                        {product.nbChambresHotel && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="grid" size={14} color="#6B7280" />
                                <Text style={styles.detailText}>{product.nbChambresHotel} chambres</Text>
                            </View>
                        )}
                        {product.equipementsHotel && product.equipementsHotel.length > 0 && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="check-circle" size={14} color="#10B981" />
                                <Text style={styles.detailText}>{product.equipementsHotel.length} équipements</Text>
                            </View>
                        )}
                        {product.villeHotel && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="map-pin" size={14} color="#6B7280" />
                                <Text style={styles.detailText}>{product.villeHotel}</Text>
                            </View>
                        )}
                    </View>
                );

            case 'ticket_voyage': {
                const getClasseColor = (classe: string) => {
                    if (classe?.includes('VIP') || classe?.includes('Première')) return { bg: '#F3E8FF', text: '#6B21A8', border: '#A855F7' };
                    if (classe?.includes('Business') || classe?.includes('Affaires')) return { bg: '#DBEAFE', text: '#1E40AF', border: '#3B82F6' };
                    if (classe?.includes('Économique')) return { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B' };
                    return { bg: '#F3F4F6', text: '#374151', border: '#9CA3AF' };
                };

                const classeColor = product.classeVoyage ? getClasseColor(product.classeVoyage) : null;
                const directOuEscale = product.escales && Array.isArray(product.escales) && product.escales.length > 0 ? 'Avec escales' : 'Direct';

                return (
                    <View style={{ gap: 12 }}>
                        {/* Badges principaux */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {product.classeVoyage && classeColor && (
                                <View style={[styles.ticketClasseBadge, { backgroundColor: classeColor.bg, borderColor: classeColor.border }]}>
                                    <Text style={[styles.ticketClasseText, { color: classeColor.text }]}>💺 {product.classeVoyage}</Text>
                                </View>
                            )}
                            {product.typeVehiculeTransport && (
                                <View style={styles.ticketTypeBadge}>
                                    <Text style={styles.ticketTypeText}>
                                        {product.typeVehiculeTransport === 'Bus' && '🚌 '}
                                        {product.typeVehiculeTransport === 'Avion' && '✈️ '}
                                        {product.typeVehiculeTransport === 'Train' && '🚂 '}
                                        {product.typeVehiculeTransport === 'Bateau' && '🚢 '}
                                        {product.typeVehiculeTransport}
                                    </Text>
                                </View>
                            )}
                            <View style={[styles.ticketEscaleBadge, { backgroundColor: directOuEscale === 'Direct' ? '#ECFDF5' : '#FEF3C7', borderColor: directOuEscale === 'Direct' ? '#10B981' : '#F59E0B' }]}>
                                <Text style={[styles.ticketEscaleText, { color: directOuEscale === 'Direct' ? '#047857' : '#92400E' }]}>{directOuEscale}</Text>
                            </View>
                        </View>

                        {/* Itinéraire */}
                        {product.depart && product.destination && (
                            <View style={styles.ticketItineraire}>
                                <View style={styles.ticketVille}>
                                    <SafeIcon name="circle" size={12} color="#8B5CF6" />
                                    <Text style={styles.ticketVilleText}>{product.depart}</Text>
                                </View>
                                <View style={styles.ticketFleche}>
                                    <SafeIcon name="arrow-right" size={16} color="#8B5CF6" />
                                    {product.dureeTrajet && (
                                        <Text style={styles.ticketDuree}>{product.dureeTrajet}</Text>
                                    )}
                                </View>
                                <View style={styles.ticketVille}>
                                    <SafeIcon name="map-pin" size={12} color="#8B5CF6" />
                                    <Text style={styles.ticketVilleText}>{product.destination}</Text>
                                </View>
                            </View>
                        )}

                        {/* Horaires */}
                        <View style={styles.ticketHoraires}>
                            {product.dateDepart && (
                                <View style={styles.ticketHoraireItem}>
                                    <SafeIcon name="calendar" size={14} color="#8B5CF6" />
                                    <Text style={styles.ticketHoraireText}>{product.dateDepart}</Text>
                                </View>
                            )}
                            {product.heureDepart && (
                                <View style={styles.ticketHoraireItem}>
                                    <SafeIcon name="clock" size={14} color="#8B5CF6" />
                                    <Text style={styles.ticketHoraireText}>{product.heureDepart}</Text>
                                </View>
                            )}
                            {product.numeroPlace && (
                                <View style={styles.ticketHoraireItem}>
                                    <Text style={styles.ticketPlaceText}>🎫 Place {product.numeroPlace}</Text>
                                </View>
                            )}
                        </View>

                        {/* Services inclus */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {product.repas && (
                                <View style={styles.ticketServiceTag}>
                                    <Text style={styles.ticketServiceText}>🍽️ Repas</Text>
                                </View>
                            )}
                            {product.wifi && (
                                <View style={styles.ticketServiceTag}>
                                    <Text style={styles.ticketServiceText}>📶 Wi-Fi</Text>
                                </View>
                            )}
                            {product.bagage && (
                                <View style={styles.ticketServiceTag}>
                                    <Text style={styles.ticketServiceText}>🧳 {product.bagage}</Text>
                                </View>
                            )}
                            {product.remboursable && (
                                <View style={[styles.ticketServiceTag, { backgroundColor: '#ECFDF5', borderColor: '#10B981' }]}>
                                    <Text style={[styles.ticketServiceText, { color: '#047857' }]}>↩️ Remboursable</Text>
                                </View>
                            )}
                        </View>

                        {/* Compagnie */}
                        {(product.compagnie || product.compagnieTransport) && (
                            <View style={styles.ticketCompagnie}>
                                <Text style={styles.ticketCompagnieText}>Compagnie: {product.compagnie || product.compagnieTransport}</Text>
                            </View>
                        )}
                    </View>
                );
            }

            case 'vetement': {
                const getEtatColorTextile = (etat: string) => {
                    if (etat === 'Neuf avec étiquette') return { bg: '#D1FAE5', text: '#065F46', border: '#10B981' };
                    if (etat === 'Neuf sans étiquette') return { bg: '#DBEAFE', text: '#1E40AF', border: '#3B82F6' };
                    if (etat?.includes('Excellent')) return { bg: '#E0E7FF', text: '#3730A3', border: '#6366F1' };
                    if (etat?.includes('Bon')) return { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B' };
                    if (etat === 'Vintage') return { bg: '#F3E8FF', text: '#6B21A8', border: '#A855F7' };
                    return { bg: '#FED7AA', text: '#9A3412', border: '#F97316' };
                };

                const etatColor = product.etatVetement ? getEtatColorTextile(product.etatVetement) : null;

                // ✅ NOUVEAU: Gestion des variantes de vêtements (Taille × Couleur)
                const hasVetementVariants = product.variantesVetements && product.variantesVetements.length > 0;
                const currentVetementVariant = hasVetementVariants ? product.variantesVetements[selectedVariantIndex] : null;
                const displayTaille = currentVetementVariant?.taille ?? product.taille;
                const displayCouleurVetement = currentVetementVariant?.couleur ?? product.couleurVetement;
                const displayPrixVariante = currentVetementVariant?.prix ?? product.prix;
                const displayStockVetement = currentVetementVariant?.stockDisponible ?? product.stockDisponible;

                return (
                    <View style={{ gap: 12 }}>
                        {/* Badges principaux */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {product.etatVetement && etatColor && (
                                <View style={[styles.textileBadge, { backgroundColor: etatColor.bg, borderColor: etatColor.border }]}>
                                    <Text style={[styles.textileBadgeText, { color: etatColor.text }]}>{product.etatVetement}</Text>
                                </View>
                            )}
                            {product.genreVetement && (
                                <View style={styles.textileGenreBadge}>
                                    <Text style={styles.textileGenreText}>
                                        {product.genreVetement === 'Homme' && '👨 '}
                                        {product.genreVetement === 'Femme' && '👩 '}
                                        {product.genreVetement === 'Enfant' && '👦 '}
                                        {product.genreVetement === 'Bébé' && '👶 '}
                                        {product.genreVetement === 'Unisexe' && '⚧️ '}
                                        {product.genreVetement}
                                    </Text>
                                </View>
                            )}
                            {product.marqueVetement && (
                                <View style={styles.textileMarqueBadge}>
                                    <Text style={styles.textileMarqueText}>🏷️ {product.marqueVetement}</Text>
                                </View>
                            )}
                        </View>

                        {/* Identité */}
                        {(product.typeVetement || product.genreVetement) && (
                            <View style={styles.textileIdentity}>
                                <Text style={styles.textileIdentityText}>
                                    👕 {product.typeVetement || 'Vêtement'} {product.genreVetement ? `• ${product.genreVetement}` : ''}
                                </Text>
                            </View>
                        )}

                        {/* ✅ NOUVEAU: Sélecteur de variantes (Taille × Couleur) */}
                        {hasVetementVariants && product.variantesVetements.length > 1 && (
                            <View style={styles.variantsSelector}>
                                <Text style={styles.variantsSelectorLabel}>👕 Tailles/Couleurs disponibles :</Text>
                                <View style={styles.variantOptions}>
                                    {product.variantesVetements.map((variant, index) => {
                                        const isSelected = selectedVariantIndex === index;
                                        const variantStock = variant.stockDisponible || 0;
                                        const isOutOfStock = variantStock === 0;

                                        return (
                                            <TouchableOpacity
                                                key={variant.id || index}
                                                style={[
                                                    styles.vetementVariantOption,
                                                    isSelected && styles.vetementVariantOptionActive,
                                                    isOutOfStock && styles.vetementVariantOptionOutOfStock
                                                ]}
                                                onPress={() => !isOutOfStock && setSelectedVariantIndex(index)}
                                                disabled={isOutOfStock}
                                            >
                                                {/* Image de la variante - ✅ OPTIMISATION 3 */}
                                                {variant.images && variant.images[0] && (
                                                    <OptimizedImage
                                                        uri={variant.images[0]}
                                                        style={styles.vetementVariantImage}
                                                        showLoadingIndicator={false}
                                                    />
                                                )}

                                                {/* Infos variante */}
                                                <View style={styles.vetementVariantInfo}>
                                                    <Text style={[
                                                        styles.vetementVariantText,
                                                        isSelected && styles.vetementVariantTextActive,
                                                        isOutOfStock && styles.vetementVariantTextDisabled
                                                    ]}>
                                                        {variant.taille} • {variant.couleur}
                                                    </Text>
                                                    <Text style={[
                                                        styles.vetementVariantPrice,
                                                        isSelected && styles.vetementVariantPriceActive,
                                                        isOutOfStock && styles.vetementVariantTextDisabled
                                                    ]}>
                                                        {parseFloat(variant.prix || 0).toLocaleString()} FCFA
                                                    </Text>
                                                    {variantStock > 0 && variantStock <= 5 && (
                                                        <Text style={styles.vetementVariantStockLow}>
                                                            Stock: {variantStock}
                                                        </Text>
                                                    )}
                                                    {isOutOfStock && (
                                                        <Text style={styles.vetementVariantOutOfStockText}>
                                                            Épuisé
                                                        </Text>
                                                    )}
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>
                        )}

                        {/* Specs */}
                        <View style={styles.textileSpecs}>
                            {displayTaille && (
                                <View style={styles.textileSpecItem}>
                                    <SafeIcon name="maximize" size={14} color="#EC4899" />
                                    <Text style={styles.textileSpecLabel}>Taille: </Text>
                                    <Text style={styles.textileSpecText}>{displayTaille}</Text>
                                </View>
                            )}
                            {displayCouleurVetement && (
                                <View style={styles.textileSpecItem}>
                                    <SafeIcon name="droplet" size={14} color="#EC4899" />
                                    <Text style={styles.textileSpecLabel}>Couleur: </Text>
                                    <Text style={styles.textileSpecText}>{displayCouleurVetement}</Text>
                                </View>
                            )}
                            {product.matiereVetement && (
                                <View style={styles.textileSpecItem}>
                                    <SafeIcon name="layers" size={14} color="#EC4899" />
                                    <Text style={styles.textileSpecLabel}>Matière: </Text>
                                    <Text style={styles.textileSpecText}>{product.matiereVetement}</Text>
                                </View>
                            )}
                            {product.styleVetement && (
                                <View style={styles.textileSpecItem}>
                                    <SafeIcon name="star" size={14} color="#EC4899" />
                                    <Text style={styles.textileSpecLabel}>Style: </Text>
                                    <Text style={styles.textileSpecText}>{product.styleVetement}</Text>
                                </View>
                            )}
                            {product.coupeVetement && (
                                <View style={styles.textileSpecItem}>
                                    <SafeIcon name="scissors" size={14} color="#EC4899" />
                                    <Text style={styles.textileSpecLabel}>Coupe: </Text>
                                    <Text style={styles.textileSpecText}>{product.coupeVetement}</Text>
                                </View>
                            )}
                            {displayStockVetement !== undefined && displayStockVetement !== null && (
                                <View style={styles.textileSpecItem}>
                                    <SafeIcon name="package" size={14} color="#EC4899" />
                                    <Text style={styles.textileSpecLabel}>Stock: </Text>
                                    <Text style={[
                                        styles.textileSpecText,
                                        displayStockVetement === 0 && { color: '#DC2626' },
                                        displayStockVetement > 0 && displayStockVetement <= 5 && { color: '#F59E0B' },
                                        displayStockVetement > 5 && { color: '#10B981' }
                                    ]}>
                                        {displayStockVetement === 0 ? 'Épuisé' : `${displayStockVetement} unités`}
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Certifications */}
                        {product.certifieVetement && product.certifieVetement.length > 0 && (
                            <View style={styles.textileCertifications}>
                                {product.certifieVetement.map((cert, idx) => (
                                    <View key={idx} style={styles.textileCertTag}>
                                        <Text style={styles.textileCertText}>
                                            {cert === 'Bio' && '🌿 '}
                                            {cert === 'Équitable' && '🤝 '}
                                            {cert}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>
                );
            }

            case 'chaussure': {
                // Couleurs par état
                const getEtatChaussureColor = (etat: string) => {
                    if (etat?.includes('Neuf avec boîte')) return { bg: '#D1FAE5', text: '#065F46', border: '#10B981' };
                    if (etat?.includes('Neuf sans boîte')) return { bg: '#DBEAFE', text: '#1E40AF', border: '#3B82F6' };
                    if (etat?.includes('Excellent')) return { bg: '#E0E7FF', text: '#3730A3', border: '#6366F1' };
                    if (etat?.includes('Bon')) return { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B' };
                    if (etat?.includes('moyen')) return { bg: '#FED7AA', text: '#9A3412', border: '#F97316' };
                    return { bg: '#F3F4F6', text: '#374151', border: '#9CA3AF' };
                };

                const etatColors = getEtatChaussureColor(product.etatChaussure || '');

                // ✅ NOUVEAU: Gestion des variantes de chaussures (Pointure × Couleur)
                const hasChaussureVariants = product.variantesChaussures && product.variantesChaussures.length > 0;
                const currentChaussureVariant = hasChaussureVariants ? product.variantesChaussures[selectedVariantIndex] : null;
                const displayPointure = currentChaussureVariant?.pointure ?? product.pointure;
                const displayCouleur = currentChaussureVariant?.couleur ?? product.couleurChaussure;
                const displayPrixVariante = currentChaussureVariant?.prix ?? product.prix;
                const displayStock = currentChaussureVariant?.stockDisponible ?? product.stockDisponible;

                return (
                    <View style={{ gap: 12 }}>
                        {/* Badge État */}
                        {product.etatChaussure && (
                            <View style={[styles.chaussureBadge, { backgroundColor: etatColors.bg, borderColor: etatColors.border }]}>
                                <Text style={[styles.chaussureBadgeText, { color: etatColors.text }]}>
                                    {product.etatChaussure}
                                </Text>
                            </View>
                        )}

                        {/* Badge Marque */}
                        {product.marqueChaussure && (
                            <View style={styles.chaussureMarqueBadge}>
                                <Text style={styles.chaussureMarqueText}>🏷️ {product.marqueChaussure}</Text>
                            </View>
                        )}

                        {/* Identité : Type + Genre */}
                        {(product.typeChaussure || product.genreChaussure) && (
                            <View style={styles.chaussureIdentity}>
                                <Text style={styles.chaussureIdentityText}>
                                    {product.typeChaussure || 'Chaussure'} {product.genreChaussure && `• ${product.genreChaussure}`}
                                </Text>
                            </View>
                        )}

                        {/* ✅ NOUVEAU: Sélecteur de variantes (Pointure × Couleur) */}
                        {hasChaussureVariants && product.variantesChaussures.length > 1 && (
                            <View style={styles.variantsSelector}>
                                <Text style={styles.variantsSelectorLabel}>👟 Pointures/Couleurs disponibles :</Text>
                                <View style={styles.variantOptions}>
                                    {product.variantesChaussures.map((variant, index) => {
                                        const isSelected = selectedVariantIndex === index;
                                        const variantStock = variant.stockDisponible || 0;
                                        const isOutOfStock = variantStock === 0;

                                        return (
                                            <TouchableOpacity
                                                key={variant.id || index}
                                                style={[
                                                    styles.chaussureVariantOption,
                                                    isSelected && styles.chaussureVariantOptionActive,
                                                    isOutOfStock && styles.chaussureVariantOptionOutOfStock
                                                ]}
                                                onPress={() => !isOutOfStock && setSelectedVariantIndex(index)}
                                                disabled={isOutOfStock}
                                            >
                                                {/* Image de la variante */}
                                                {variant.images && variant.images[0] && (
                                                    <Image
                                                        source={{ uri: variant.images[0] }}
                                                        style={styles.chaussureVariantImage}
                                                    />
                                                )}

                                                {/* Infos variante */}
                                                <View style={styles.chaussureVariantInfo}>
                                                    <Text style={[
                                                        styles.chaussureVariantText,
                                                        isSelected && styles.chaussureVariantTextActive,
                                                        isOutOfStock && styles.chaussureVariantTextDisabled
                                                    ]}>
                                                        {variant.pointure} • {variant.couleur}
                                                    </Text>
                                                    <Text style={[
                                                        styles.chaussureVariantPrice,
                                                        isSelected && styles.chaussureVariantPriceActive,
                                                        isOutOfStock && styles.chaussureVariantTextDisabled
                                                    ]}>
                                                        {parseFloat(variant.prix || 0).toLocaleString()} FCFA
                                                    </Text>
                                                    {variantStock > 0 && variantStock <= 5 && (
                                                        <Text style={styles.chaussureVariantStockLow}>
                                                            Stock: {variantStock}
                                                        </Text>
                                                    )}
                                                    {isOutOfStock && (
                                                        <Text style={styles.chaussureVariantOutOfStockText}>
                                                            Épuisé
                                                        </Text>
                                                    )}
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>
                        )}

                        {/* Caractéristiques principales */}
                        <View style={styles.chaussureCaracs}>
                            {displayPointure && (
                                <View style={styles.chaussureCaracItem}>
                                    <Text style={styles.chaussureCaracLabel}>Pointure:</Text>
                                    <Text style={styles.chaussureCaracText}>{displayPointure}</Text>
                                </View>
                            )}
                            {displayCouleur && (
                                <View style={styles.chaussureCaracItem}>
                                    <Text style={styles.chaussureCaracLabel}>Couleur:</Text>
                                    <Text style={styles.chaussureCaracText}>{displayCouleur}</Text>
                                </View>
                            )}
                            {product.materiauChaussure && (
                                <View style={styles.chaussureCaracItem}>
                                    <Text style={styles.chaussureCaracLabel}>Matériau:</Text>
                                    <Text style={styles.chaussureCaracText}>{product.materiauChaussure}</Text>
                                </View>
                            )}
                            {displayStock !== undefined && displayStock !== null && (
                                <View style={styles.chaussureCaracItem}>
                                    <Text style={styles.chaussureCaracLabel}>Stock:</Text>
                                    <Text style={[
                                        styles.chaussureCaracText,
                                        displayStock === 0 && { color: '#DC2626' },
                                        displayStock > 0 && displayStock <= 5 && { color: '#F59E0B' },
                                        displayStock > 5 && { color: '#10B981' }
                                    ]}>
                                        {displayStock === 0 ? 'Épuisé' : `${displayStock} unités`}
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Usage */}
                        {product.usageChaussure && (
                            <View style={styles.chaussureUsageBadge}>
                                <Text style={styles.chaussureUsageText}>🎯 {product.usageChaussure}</Text>
                            </View>
                        )}
                    </View>
                );
            }

            case 'restauration': {
                const getGammePrixColor = (gamme: string) => {
                    if (gamme?.includes('Économique')) return { bg: '#D1FAE5', text: '#065F46', border: '#10B981' };
                    if (gamme?.includes('Abordable')) return { bg: '#E0E7FF', text: '#3730A3', border: '#6366F1' };
                    if (gamme?.includes('Moyen')) return { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B' };
                    if (gamme?.includes('Élevé')) return { bg: '#FED7AA', text: '#9A3412', border: '#F97316' };
                    if (gamme?.includes('Premium')) return { bg: '#F3E8FF', text: '#6B21A8', border: '#A855F7' };
                    return { bg: '#F3F4F6', text: '#374151', border: '#9CA3AF' };
                };

                const gammePrixColor = product.gammePrix ? getGammePrixColor(product.gammePrix) : null;

                // ✅ NOUVEAU: Fonction pour afficher les plats par pays
                const renderPlatsParPays = () => {
                    const platsParPays = [
                        { pays: '🇨🇲 Cameroun', plats: product.platsCamerounais },
                        { pays: '🇨🇮 Côte d\'Ivoire', plats: product.platsIvoiriens },
                        { pays: '🇸🇳 Sénégal', plats: product.platsSenegalais },
                        { pays: '🇲🇱 Mali', plats: product.platsMaliens },
                        { pays: '🇬🇦 Gabon', plats: product.platsGabonais },
                        { pays: '🇨🇬 Congo', plats: product.platsCongolais },
                        { pays: '🇧🇫 Burkina Faso', plats: product.platsBurkinabe },
                        { pays: '🌍 Autres pays', plats: product.platsAutresPays },
                        { pays: '🌍 International', plats: product.platsInternationaux },
                    ].filter(item => item.plats && item.plats.length > 0);

                    if (platsParPays.length === 0) return null;

                    return (
                        <View style={styles.restaurantPlatsParPays}>
                            <Text style={styles.restaurantPlatsTitle}>🍽️ Carte & Spécialités</Text>
                            {platsParPays.map((item, idx) => (
                                <View key={idx} style={styles.restaurantPaysSection}>
                                    <Text style={styles.restaurantPaysTitle}>{item.pays}</Text>
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                                        {item.plats.slice(0, 3).map((plat, platIdx) => (
                                            <View key={platIdx} style={styles.restaurantPlatTag}>
                                                <Text style={styles.restaurantPlatText}>{plat}</Text>
                                            </View>
                                        ))}
                                        {item.plats.length > 3 && (
                                            <View style={styles.restaurantPlatTag}>
                                                <Text style={styles.restaurantPlatText}>+{item.plats.length - 3}</Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            ))}
                        </View>
                    );
                };

                return (
                    <View style={{ gap: 12 }}>
                        {/* ===== BADGES PRINCIPAUX ===== */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {product.typeRestaurant && (
                                <View style={styles.restaurantTypeBadge}>
                                    <Text style={styles.restaurantTypeText}>{product.typeRestaurant}</Text>
                                </View>
                            )}
                            {product.typeCuisine && (
                                <View style={styles.restaurantCuisineBadge}>
                                    <Text style={styles.restaurantCuisineText}>🍽️ {product.typeCuisine}</Text>
                                </View>
                            )}
                            {product.gammePrix && gammePrixColor && (
                                <View style={[styles.restaurantPrixBadge, { backgroundColor: gammePrixColor.bg, borderColor: gammePrixColor.border }]}>
                                    <Text style={[styles.restaurantPrixText, { color: gammePrixColor.text }]}>{product.gammePrix}</Text>
                                </View>
                            )}
                        </View>

                        {/* ===== SERVICES PRINCIPAUX ===== */}
                        {product.servicesRestau && Array.isArray(product.servicesRestau) && product.servicesRestau.length > 0 && (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                {product.servicesRestau.slice(0, 4).map((service, idx) => (
                                    <View key={idx} style={styles.restaurantServiceBadge}>
                                        <Text style={styles.restaurantServiceText}>
                                            {service.includes('Livraison') && '🚗 '}
                                            {service.includes('Sur place') && '🍽️ '}
                                            {service.includes('Traiteur') && '🎉 '}
                                            {service.includes('Buffet') && '🍱 '}
                                            {service.includes('Emporter') && '📦 '}
                                            {service}
                                        </Text>
                                    </View>
                                ))}
                                {product.servicesRestau.length > 4 && (
                                    <View style={styles.restaurantServiceBadge}>
                                        <Text style={styles.restaurantServiceText}>+{product.servicesRestau.length - 4}</Text>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* ===== PLATS PAR PAYS (NOUVEAU) ===== */}
                        {renderPlatsParPays()}

                        {/* ===== BOISSONS & DESSERTS ===== */}
                        {(product.boissonsLocales?.length > 0 || product.dessertsLocaux?.length > 0) && (
                            <View style={styles.restaurantBoissonsDesserts}>
                                {product.boissonsLocales && product.boissonsLocales.length > 0 && (
                                    <View style={styles.restaurantBoissonsSection}>
                                        <Text style={styles.restaurantBoissonsTitle}>🍹 Boissons</Text>
                                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                                            {product.boissonsLocales.slice(0, 3).map((boisson, idx) => (
                                                <View key={idx} style={styles.restaurantBoissonTag}>
                                                    <Text style={styles.restaurantBoissonText}>{boisson}</Text>
                                                </View>
                                            ))}
                                            {product.boissonsLocales.length > 3 && (
                                                <View style={styles.restaurantBoissonTag}>
                                                    <Text style={styles.restaurantBoissonText}>+{product.boissonsLocales.length - 3}</Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                )}
                                {product.dessertsLocaux && product.dessertsLocaux.length > 0 && (
                                    <View style={styles.restaurantDessertsSection}>
                                        <Text style={styles.restaurantDessertsTitle}>🍰 Desserts</Text>
                                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                                            {product.dessertsLocaux.slice(0, 3).map((dessert, idx) => (
                                                <View key={idx} style={styles.restaurantDessertTag}>
                                                    <Text style={styles.restaurantDessertText}>{dessert}</Text>
                                                </View>
                                            ))}
                                            {product.dessertsLocaux.length > 3 && (
                                                <View style={styles.restaurantDessertTag}>
                                                    <Text style={styles.restaurantDessertText}>+{product.dessertsLocaux.length - 3}</Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* ===== HORAIRES & CAPACITÉ ===== */}
                        <View style={styles.restaurantInfo}>
                            {product.horairesRestaurant && Array.isArray(product.horairesRestaurant) && product.horairesRestaurant.length > 0 && (
                                <View style={styles.restaurantInfoItem}>
                                    <SafeIcon name="clock" size={14} color="#F97316" />
                                    <Text style={styles.restaurantInfoText}>
                                        {product.horairesRestaurant.slice(0, 2).join(', ')}
                                        {product.horairesRestaurant.length > 2 && ` +${product.horairesRestaurant.length - 2}`}
                                    </Text>
                                </View>
                            )}
                            {product.capaciteRestaurant && (
                                <View style={styles.restaurantInfoItem}>
                                    <SafeIcon name="users" size={14} color="#F97316" />
                                    <Text style={styles.restaurantInfoText}>{product.capaciteRestaurant}</Text>
                                </View>
                            )}
                            {product.specialisationChef && (
                                <View style={styles.restaurantInfoItem}>
                                    <SafeIcon name="chef-hat" size={14} color="#F97316" />
                                    <Text style={styles.restaurantInfoText}>{product.specialisationChef}</Text>
                                </View>
                            )}
                        </View>

                        {/* ===== AMBIANCE & ÉQUIPEMENTS ===== */}
                        {product.ambianceRestau && Array.isArray(product.ambianceRestau) && product.ambianceRestau.length > 0 && (
                            <View style={styles.restaurantAmbiance}>
                                <Text style={styles.restaurantAmbianceTitle}>🏪 Ambiance</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                                    {product.ambianceRestau.slice(0, 4).map((ambiance, idx) => (
                                        <View key={idx} style={styles.restaurantAmbianceTag}>
                                            <Text style={styles.restaurantAmbianceText}>
                                                {ambiance.includes('Familial') && '👨‍👩‍👧‍👦 '}
                                                {ambiance.includes('Romantique') && '💑 '}
                                                {ambiance.includes('Climatisé') && '❄️ '}
                                                {ambiance.includes('Wi-Fi') && '📶 '}
                                                {ambiance.includes('Parking') && '🚗 '}
                                                {ambiance.includes('Terrasse') && '🌳 '}
                                                {ambiance}
                                            </Text>
                                        </View>
                                    ))}
                                    {product.ambianceRestau.length > 4 && (
                                        <View style={styles.restaurantAmbianceTag}>
                                            <Text style={styles.restaurantAmbianceText}>+{product.ambianceRestau.length - 4}</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* ===== RÉGIMES ALIMENTAIRES ===== */}
                        {product.regimesSpeciaux && Array.isArray(product.regimesSpeciaux) && product.regimesSpeciaux.length > 0 && (
                            <View style={styles.restaurantRegimes}>
                                <Text style={styles.restaurantRegimesTitle}>🎯 Régimes spéciaux</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                                    {product.regimesSpeciaux.map((regime, idx) => (
                                        <View key={idx} style={styles.restaurantRegimeTag}>
                                            <Text style={styles.restaurantRegimeText}>
                                                {regime.includes('Halal') && '☪️ '}
                                                {regime.includes('Vegan') && '🌿 '}
                                                {regime.includes('Végétarien') && '🌱 '}
                                                {regime.includes('Sans gluten') && '🌾 '}
                                                {regime.includes('Sans lactose') && '🥛 '}
                                                {regime.includes('Bio') && '🥗 '}
                                                {regime}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}

                        {/* ===== CERTIFICATIONS & PROMOTIONS ===== */}
                        {(product.certificationsRestau?.length > 0 || product.promotionsRestau?.length > 0) && (
                            <View style={styles.restaurantCertificationsPromotions}>
                                {product.certificationsRestau && product.certificationsRestau.length > 0 && (
                                    <View style={styles.restaurantCertificationsSection}>
                                        <Text style={styles.restaurantCertificationsTitle}>🎖️ Certifications</Text>
                                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                                            {product.certificationsRestau.slice(0, 3).map((cert, idx) => (
                                                <View key={idx} style={styles.restaurantCertificationTag}>
                                                    <Text style={styles.restaurantCertificationText}>
                                                        {cert.includes('Halal') && '☪️ '}
                                                        {cert.includes('Hygiène') && '✅ '}
                                                        {cert.includes('Bio') && '🌱 '}
                                                        {cert.includes('Recommandé') && '🏆 '}
                                                        {cert}
                                                    </Text>
                                                </View>
                                            ))}
                                            {product.certificationsRestau.length > 3 && (
                                                <View style={styles.restaurantCertificationTag}>
                                                    <Text style={styles.restaurantCertificationText}>+{product.certificationsRestau.length - 3}</Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                )}
                                {product.promotionsRestau && product.promotionsRestau.length > 0 && (
                                    <View style={styles.restaurantPromotionsSection}>
                                        <Text style={styles.restaurantPromotionsTitle}>🎁 Promotions</Text>
                                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                                            {product.promotionsRestau.slice(0, 3).map((promo, idx) => (
                                                <View key={idx} style={styles.restaurantPromotionTag}>
                                                    <Text style={styles.restaurantPromotionText}>
                                                        {promo.includes('Promotion') && '🎉 '}
                                                        {promo.includes('Menu') && '📅 '}
                                                        {promo.includes('Livraison') && '📦 '}
                                                        {promo.includes('Famille') && '👨‍👩‍👧‍👦 '}
                                                        {promo}
                                                    </Text>
                                                </View>
                                            ))}
                                            {product.promotionsRestau.length > 3 && (
                                                <View style={styles.restaurantPromotionTag}>
                                                    <Text style={styles.restaurantPromotionText}>+{product.promotionsRestau.length - 3}</Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* ===== ZONES DE LIVRAISON ===== */}
                        {(product.zonesLivraisonDouala?.length > 0 || product.zonesLivraisonYaounde?.length > 0) && (
                            <View style={styles.restaurantZonesLivraison}>
                                <Text style={styles.restaurantZonesTitle}>📍 Zones de livraison</Text>
                                {product.zonesLivraisonDouala && product.zonesLivraisonDouala.length > 0 && (
                                    <View style={styles.restaurantZoneSection}>
                                        <Text style={styles.restaurantZoneCity}>Douala</Text>
                                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                                            {product.zonesLivraisonDouala.slice(0, 4).map((zone, idx) => (
                                                <View key={idx} style={styles.restaurantZoneTag}>
                                                    <Text style={styles.restaurantZoneText}>{zone}</Text>
                                                </View>
                                            ))}
                                            {product.zonesLivraisonDouala.length > 4 && (
                                                <View style={styles.restaurantZoneTag}>
                                                    <Text style={styles.restaurantZoneText}>+{product.zonesLivraisonDouala.length - 4}</Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                )}
                                {product.zonesLivraisonYaounde && product.zonesLivraisonYaounde.length > 0 && (
                                    <View style={styles.restaurantZoneSection}>
                                        <Text style={styles.restaurantZoneCity}>Yaoundé</Text>
                                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                                            {product.zonesLivraisonYaounde.slice(0, 4).map((zone, idx) => (
                                                <View key={idx} style={styles.restaurantZoneTag}>
                                                    <Text style={styles.restaurantZoneText}>{zone}</Text>
                                                </View>
                                            ))}
                                            {product.zonesLivraisonYaounde.length > 4 && (
                                                <View style={styles.restaurantZoneTag}>
                                                    <Text style={styles.restaurantZoneText}>+{product.zonesLivraisonYaounde.length - 4}</Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* ===== TYPE DE CLIENTÈLE ===== */}
                        {product.typeClientele && Array.isArray(product.typeClientele) && product.typeClientele.length > 0 && (
                            <View style={styles.restaurantClientele}>
                                <Text style={styles.restaurantClienteleTitle}>👥 Clientèle cible</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                                    {product.typeClientele.map((clientele, idx) => (
                                        <View key={idx} style={styles.restaurantClienteleTag}>
                                            <Text style={styles.restaurantClienteleText}>
                                                {clientele.includes('Familles') && '👨‍👩‍👧‍👦 '}
                                                {clientele.includes('Étudiants') && '🎓 '}
                                                {clientele.includes('Professionnels') && '💼 '}
                                                {clientele.includes('Expatriés') && '🌍 '}
                                                {clientele.includes('Touristes') && '🧳 '}
                                                {clientele}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}
                    </View>
                );
            }

            case 'musique_instruments': {
                const getEtatColorMusique = (etat: string) => {
                    if (etat?.includes('Neuf')) return { bg: '#D1FAE5', text: '#065F46', border: '#10B981' };
                    if (etat?.includes('Excellent')) return { bg: '#E0E7FF', text: '#3730A3', border: '#6366F1' };
                    if (etat?.includes('Bon')) return { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B' };
                    if (etat?.includes('réviser') || etat?.includes('réparer')) return { bg: '#FEE2E2', text: '#991B1B', border: '#EF4444' };
                    if (etat?.includes('Vintage') || etat?.includes('Collection')) return { bg: '#FCE7F3', text: '#831843', border: '#EC4899' };
                    return { bg: '#F3F4F6', text: '#374151', border: '#9CA3AF' };
                };

                // Icône dynamique selon catégorie
                const getCategoryIcon = () => {
                    if (product.categorieInstrument?.includes('traditionnel africain')) return '🥁';
                    if (product.categorieInstrument?.includes('Sonorisation')) return '🔊';
                    if (product.categorieInstrument?.includes('DJ')) return '🎧';
                    if (product.categorieInstrument?.includes('Studio')) return '🎙️';
                    if (product.categorieInstrument?.includes('Accessoire')) return '🎸';
                    return '🎵';
                };

                const etatColor = product.etatInstrument ? getEtatColorMusique(product.etatInstrument) : null;

                return (
                    <View style={{ gap: 12 }}>
                        {/* ✅ Badges principaux */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {/* Catégorie */}
                            {product.categorieInstrument && (
                                <View style={{ backgroundColor: '#FDF4FF', borderWidth: 1, borderColor: '#C026D3', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
                                    <Text style={{ fontSize: 11, color: '#86198F', fontWeight: '600' }}>
                                        {getCategoryIcon()} {product.categorieInstrument}
                                    </Text>
                                </View>
                            )}

                            {/* État */}
                            {product.etatInstrument && etatColor && (
                                <View style={[styles.musiqueBadge, { backgroundColor: etatColor.bg, borderColor: etatColor.border }]}>
                                    <Text style={[styles.musiqueBadgeText, { color: etatColor.text }]}>{product.etatInstrument}</Text>
                                </View>
                            )}

                            {/* Marque */}
                            {product.marqueInstrument && (
                                <View style={styles.musiqueMarqueBadge}>
                                    <Text style={styles.musiqueMarqueText}>🏷️ {product.marqueInstrument}</Text>
                                </View>
                            )}

                            {/* Niveau */}
                            {product.niveauInstrument && (
                                <View style={{ backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#3B82F6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
                                    <Text style={{ fontSize: 11, color: '#1E40AF', fontWeight: '500' }}>
                                        {product.niveauInstrument}
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* ✅ Identité */}
                        {(product.typeInstrument || product.modeleInstrument) && (
                            <View style={styles.musiqueIdentity}>
                                <Text style={styles.musiqueIdentityText}>
                                    {getCategoryIcon()} {product.typeInstrument || 'Instrument'} {product.modeleInstrument ? `• ${product.modeleInstrument}` : ''}
                                </Text>
                            </View>
                        )}

                        {/* ✅ Caractéristiques techniques */}
                        <View style={styles.musiqueCaracs}>
                            {product.nombreCordes && (
                                <View style={styles.musiqueCaracItem}>
                                    <SafeIcon name="activity" size={14} color="#9C27B0" />
                                    <Text style={styles.musiqueCaracLabel}>{product.nombreCordes} cordes</Text>
                                </View>
                            )}
                            {product.tailleInstrument && (
                                <View style={styles.musiqueCaracItem}>
                                    <SafeIcon name="maximize-2" size={14} color="#9C27B0" />
                                    <Text style={styles.musiqueCaracLabel}>{product.tailleInstrument}</Text>
                                </View>
                            )}
                            {product.materiauInstrument && (
                                <View style={styles.musiqueCaracItem}>
                                    <SafeIcon name="layers" size={14} color="#9C27B0" />
                                    <Text style={styles.musiqueCaracLabel}>{product.materiauInstrument}</Text>
                                </View>
                            )}
                            {product.couleurInstrument && (
                                <View style={styles.musiqueCaracItem}>
                                    <SafeIcon name="droplet" size={14} color="#9C27B0" />
                                    <Text style={styles.musiqueCaracLabel}>{product.couleurInstrument}</Text>
                                </View>
                            )}
                            {product.puissanceAmpli && (
                                <View style={styles.musiqueCaracItem}>
                                    <SafeIcon name="zap" size={14} color="#9C27B0" />
                                    <Text style={styles.musiqueCaracLabel}>{product.puissanceAmpli}W</Text>
                                </View>
                            )}
                            {product.anneeInstrument && (
                                <View style={styles.musiqueCaracItem}>
                                    <SafeIcon name="calendar" size={14} color="#9C27B0" />
                                    <Text style={styles.musiqueCaracLabel}>Année {product.anneeInstrument}</Text>
                                </View>
                            )}
                        </View>

                        {/* ✅ Utilisation & Genre musical */}
                        {(product.utilisationInstrument || product.genreMusical) && (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                {product.utilisationInstrument && (
                                    <View style={{ backgroundColor: '#F0FDFA', borderWidth: 1, borderColor: '#14B8A6', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}>
                                        <Text style={{ fontSize: 10, color: '#0F766E', fontStyle: 'italic' }}>
                                            🎯 {product.utilisationInstrument}
                                        </Text>
                                    </View>
                                )}
                                {product.genreMusical && (
                                    <View style={{ backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#F59E0B', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}>
                                        <Text style={{ fontSize: 10, color: '#92400E', fontStyle: 'italic' }}>
                                            {product.genreMusical?.includes('Afrobeat') ||
                                                product.genreMusical?.includes('Makossa') ||
                                                product.genreMusical?.includes('Bikutsi') ||
                                                product.genreMusical?.includes('Coupé-décalé') ? '🌍' : '🎵'} {product.genreMusical}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* ✅ Alimentation & Connectiques (équipement électronique) */}
                        {(product.alimentationInstrument || (product.connectiquesInstrument && product.connectiquesInstrument.length > 0)) && (
                            <View style={{ gap: 4 }}>
                                {product.alimentationInstrument && (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <SafeIcon name="battery-charging" size={13} color="#6B7280" />
                                        <Text style={{ fontSize: 11, color: '#6B7280' }}>
                                            {product.alimentationInstrument}
                                        </Text>
                                    </View>
                                )}
                                {product.connectiquesInstrument && Array.isArray(product.connectiquesInstrument) && product.connectiquesInstrument.length > 0 && (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <SafeIcon name="link" size={13} color="#6B7280" />
                                        <Text style={{ fontSize: 11, color: '#6B7280' }}>
                                            {product.connectiquesInstrument.join(', ')}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* ✅ Badges de confiance */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {product.garantieInstrument && (
                                <View style={styles.musiqueConfianceTag}>
                                    <SafeIcon name="shield-check" size={12} color="#047857" />
                                    <Text style={styles.musiqueConfianceText}>Garantie {product.garantieInstrument}</Text>
                                </View>
                            )}
                            {product.facture && (
                                <View style={styles.musiqueConfianceTag}>
                                    <SafeIcon name="file-text" size={12} color="#047857" />
                                    <Text style={styles.musiqueConfianceText}>Facture</Text>
                                </View>
                            )}
                            {product.revisionRecente && (
                                <View style={styles.musiqueConfianceTag}>
                                    <SafeIcon name="check-circle" size={12} color="#047857" />
                                    <Text style={styles.musiqueConfianceText}>Révisé récemment</Text>
                                </View>
                            )}
                        </View>

                        {/* ✅ Accessoires */}
                        {product.accessoiresInclus && Array.isArray(product.accessoiresInclus) && product.accessoiresInclus.length > 0 && (
                            <View style={styles.musiqueAccessoires}>
                                <Text style={styles.musiqueAccessoiresTitle}>Accessoires inclus :</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                                    {product.accessoiresInclus.map((acc, idx) => (
                                        <View key={idx} style={styles.musiqueAccessoireTag}>
                                            <Text style={styles.musiqueAccessoireText}>{acc}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}

                        {/* ✅ Origine (footer discret) */}
                        {product.origineInstrument && (
                            <View style={{ borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 8, marginTop: 4 }}>
                                <Text style={{ fontSize: 10, color: '#9CA3AF', textAlign: 'center' }}>
                                    {product.origineInstrument?.includes('Sénégal') ||
                                        product.origineInstrument?.includes('Mali') ||
                                        product.origineInstrument?.includes('Guinée') ||
                                        product.origineInstrument?.includes('Cameroun') ||
                                        product.origineInstrument?.includes('Afrique') ||
                                        product.origineInstrument?.includes('Artisan') ? '🌍' : '🌎'} Fabriqué en {product.origineInstrument}
                                </Text>
                            </View>
                        )}
                    </View>
                );
            }

            case 'emploi': {
                const getTypeContratColor = (type: string) => {
                    if (type === 'CDI') return { bg: '#D1FAE5', text: '#065F46', border: '#10B981' };
                    if (type === 'CDD') return { bg: '#DBEAFE', text: '#1E40AF', border: '#3B82F6' };
                    if (type === 'Stage') return { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B' };
                    if (type === 'Freelance') return { bg: '#F3E8FF', text: '#6B21A8', border: '#A855F7' };
                    return { bg: '#F3F4F6', text: '#374151', border: '#9CA3AF' };
                };

                const contratColor = product.typeContrat ? getTypeContratColor(product.typeContrat) : null;
                const isTeletravail = product.typeEmploi?.includes('Télétravail') || product.typeEmploi?.includes('Hybride');

                return (
                    <View style={{ gap: 12 }}>
                        {/* Badges principaux */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {product.typeContrat && contratColor && (
                                <View style={[styles.emploiBadge, { backgroundColor: contratColor.bg, borderColor: contratColor.border }]}>
                                    <Text style={[styles.emploiBadgeText, { color: contratColor.text }]}>{product.typeContrat}</Text>
                                </View>
                            )}
                            {product.secteurActivite && (
                                <View style={styles.emploiDomaineBadge}>
                                    <Text style={styles.emploiDomaineText}>📂 {product.secteurActivite}</Text>
                                </View>
                            )}
                            {product.secteurEntreprise && (
                                <View style={[styles.emploiDomaineBadge, { backgroundColor: '#F3F4F6', borderColor: '#D1D5DB' }]}>
                                    <Text style={[styles.emploiDomaineText, { color: '#374151' }]}>🏢 {product.secteurEntreprise}</Text>
                                </View>
                            )}
                            {isTeletravail && (
                                <View style={styles.emploiTeletravailBadge}>
                                    <Text style={styles.emploiTeletravailText}>🏠 Télétravail</Text>
                                </View>
                            )}
                            {product.urgence && (
                                <View style={[styles.emploiBadge, { backgroundColor: '#FEE2E2', borderColor: '#EF4444' }]}>
                                    <Text style={[styles.emploiBadgeText, { color: '#991B1B' }]}>⚠️ Urgent</Text>
                                </View>
                            )}
                        </View>

                        {/* Identité poste */}
                        {product.posteOffre && (
                            <View style={styles.emploiIdentity}>
                                <Text style={styles.emploiPosteText}>💼 {product.posteOffre}</Text>
                                {product.nom && product.nom !== product.posteOffre && (
                                    <Text style={styles.emploiEntrepriseText}>{product.nom}</Text>
                                )}
                            </View>
                        )}

                        {/* Salaire */}
                        {(product.salaireMin || product.salaireMax) && (
                            <View style={styles.emploiSalaire}>
                                <SafeIcon name="dollar-sign" size={14} color="#3B82F6" />
                                <Text style={styles.emploiSalaireText}>
                                    {product.salaireMin && product.salaireMax
                                        ? `${product.salaireMin} - ${product.salaireMax} ${product.deviseOffre || 'XAF'}`
                                        : product.salaireMin
                                            ? `À partir de ${product.salaireMin} ${product.deviseOffre || 'XAF'}`
                                            : `Jusqu'à ${product.salaireMax} ${product.deviseOffre || 'XAF'}`
                                    }
                                </Text>
                            </View>
                        )}

                        {/* Infos clés */}
                        <View style={styles.emploiInfos}>
                            {product.niveauExperience && (
                                <View style={styles.emploiInfoItem}>
                                    <SafeIcon name="briefcase" size={14} color="#3B82F6" />
                                    <Text style={styles.emploiInfoText}>{product.niveauExperience}</Text>
                                </View>
                            )}
                            {product.lieuTravail && (
                                <View style={styles.emploiInfoItem}>
                                    <SafeIcon name="map-pin" size={14} color="#3B82F6" />
                                    <Text style={styles.emploiInfoText}>{product.lieuTravail}</Text>
                                </View>
                            )}
                            {product.typeEmploi && (
                                <View style={styles.emploiInfoItem}>
                                    <SafeIcon name="clock" size={14} color="#3B82F6" />
                                    <Text style={styles.emploiInfoText}>{product.typeEmploi}</Text>
                                </View>
                            )}
                        </View>

                        {/* Compétences requises */}
                        {product.competencesRequises && Array.isArray(product.competencesRequises) && product.competencesRequises.length > 0 && (
                            <View style={styles.emploiCompetences}>
                                <Text style={styles.emploiCompetencesTitle}>Compétences :</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                                    {product.competencesRequises.slice(0, 5).map((comp, idx) => (
                                        <View key={idx} style={styles.emploiCompetenceTag}>
                                            <Text style={styles.emploiCompetenceText}>{comp}</Text>
                                        </View>
                                    ))}
                                    {product.competencesRequises.length > 5 && (
                                        <View style={styles.emploiCompetenceTag}>
                                            <Text style={styles.emploiCompetenceText}>+{product.competencesRequises.length - 5}</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* Métier/Poste recherché */}
                        {product.metierPoste && (
                            <View style={styles.emploiInfoItem}>
                                <SafeIcon name="briefcase" size={14} color="#6366F1" />
                                <Text style={[styles.emploiInfoText, { fontWeight: '600' }]}>Poste: {product.metierPoste}</Text>
                            </View>
                        )}

                        {/* Diplôme requis */}
                        {product.diplomeRequis && (
                            <View style={styles.emploiInfoItem}>
                                <SafeIcon name="graduation-cap" size={14} color="#8B5CF6" />
                                <Text style={styles.emploiInfoText}>{product.diplomeRequis}</Text>
                            </View>
                        )}

                        {/* Langues requises */}
                        {product.languesRequises && Array.isArray(product.languesRequises) && product.languesRequises.length > 0 && (
                            <View style={{ gap: 4 }}>
                                <Text style={{ fontSize: 11, fontWeight: '600', color: '#6B7280', marginBottom: 4 }}>🌍 Langues requises :</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                                    {product.languesRequises.slice(0, 4).map((langue, idx) => (
                                        <View key={idx} style={[styles.emploiCompetenceTag, { backgroundColor: '#E0E7FF', borderWidth: 0 }]}>
                                            <Text style={[styles.emploiCompetenceText, { color: '#3730A3' }]}>{langue}</Text>
                                        </View>
                                    ))}
                                    {product.languesRequises.length > 4 && (
                                        <View style={[styles.emploiCompetenceTag, { backgroundColor: '#E0E7FF', borderWidth: 0 }]}>
                                            <Text style={[styles.emploiCompetenceText, { color: '#3730A3' }]}>+{product.languesRequises.length - 4}</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* Avantages sociaux */}
                        {product.avantagesSociaux && Array.isArray(product.avantagesSociaux) && product.avantagesSociaux.length > 0 && (
                            <View style={{ gap: 4 }}>
                                <Text style={{ fontSize: 11, fontWeight: '600', color: '#6B7280', marginBottom: 4 }}>✨ Avantages :</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                                    {product.avantagesSociaux.slice(0, 3).map((avantage, idx) => (
                                        <View key={idx} style={[styles.emploiCompetenceTag, { backgroundColor: '#D1FAE5', borderWidth: 0 }]}>
                                            <Text style={[styles.emploiCompetenceText, { color: '#065F46' }]}>{avantage}</Text>
                                        </View>
                                    ))}
                                    {product.avantagesSociaux.length > 3 && (
                                        <View style={[styles.emploiCompetenceTag, { backgroundColor: '#D1FAE5', borderWidth: 0 }]}>
                                            <Text style={[styles.emploiCompetenceText, { color: '#065F46' }]}>+{product.avantagesSociaux.length - 3}</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* Date de publication */}
                        {product.datePublication && (
                            <View style={[styles.emploiInfoItem, { justifyContent: 'space-between' }]}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <SafeIcon name="calendar" size={12} color="#9CA3AF" />
                                    <Text style={[styles.emploiInfoText, { color: '#9CA3AF', fontSize: 11 }]}>
                                        Publié {product.datePublication}
                                    </Text>
                                </View>
                            </View>
                        )}
                    </View>
                );
            }

            case 'soutien_scolaire_repetiteur': {
                // ════════════════════════════════════════════════════════════
                // ✅ AFFICHAGE SOUTIEN SCOLAIRE / RÉPÉTITEUR
                // ════════════════════════════════════════════════════════════
                return (
                    <View style={{ gap: 12 }}>
                        {/* Badges principaux */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {/* Type de soutien */}
                            {product.typeSoutien && (
                                <View style={[styles.formationTypeBadge, { backgroundColor: '#D1FAE5', borderColor: '#10B981' }]}>
                                    <Text style={[styles.formationTypeText, { color: '#065F46' }]}>
                                        📚 {product.typeSoutien}
                                    </Text>
                                </View>
                            )}

                            {/* Format */}
                            {product.formatSoutien && (
                                <View style={[styles.formationModeBadge, { backgroundColor: '#DBEAFE', borderColor: '#3B82F6' }]}>
                                    <Text style={[styles.formationModeText, { color: '#1E40AF' }]}>
                                        {product.formatSoutien.includes('domicile') && '🏠 '}
                                        {product.formatSoutien.includes('ligne') && '💻 '}
                                        {product.formatSoutien.includes('Hybride') && '🔄 '}
                                        {product.formatSoutien}
                                    </Text>
                                </View>
                            )}

                            {/* Durée séance */}
                            {product.dureeSeance && (
                                <View style={[styles.formationInfoItem, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B', padding: 6, borderRadius: 6 }]}>
                                    <Text style={{ fontSize: 11, color: '#92400E', fontWeight: '600' }}>
                                        ⏱️ {product.dureeSeance}
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Niveaux scolaires */}
                        {product.niveauxScolaires && Array.isArray(product.niveauxScolaires) && product.niveauxScolaires.length > 0 && (
                            <View style={styles.formationSection}>
                                <Text style={styles.formationSectionTitle}>📚 Niveaux enseignés :</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                                    {product.niveauxScolaires.slice(0, 5).map((niveau, idx) => (
                                        <View key={idx} style={styles.formationTag}>
                                            <Text style={styles.formationTagText}>{niveau}</Text>
                                        </View>
                                    ))}
                                    {product.niveauxScolaires.length > 5 && (
                                        <View style={styles.formationTag}>
                                            <Text style={styles.formationTagText}>+{product.niveauxScolaires.length - 5}</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* Matières enseignées */}
                        {product.matieresEnseignees && Array.isArray(product.matieresEnseignees) && product.matieresEnseignees.length > 0 && (
                            <View style={styles.formationSection}>
                                <Text style={styles.formationSectionTitle}>📖 Matières :</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                                    {product.matieresEnseignees.slice(0, 6).map((matiere, idx) => (
                                        <View key={idx} style={styles.formationMatiereTag}>
                                            <Text style={styles.formationMatiereText}>{matiere}</Text>
                                        </View>
                                    ))}
                                    {product.matieresEnseignees.length > 6 && (
                                        <View style={styles.formationMatiereTag}>
                                            <Text style={styles.formationMatiereText}>+{product.matieresEnseignees.length - 6}</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* Informations principales */}
                        <View style={styles.formationInfos}>
                            {/* Modalité déplacement */}
                            {product.modaliteDeplacement && (
                                <View style={styles.formationInfoItem}>
                                    <SafeIcon name="map-pin" size={14} color="#10B981" />
                                    <Text style={styles.formationInfoLabel}>Déplacement: </Text>
                                    <Text style={styles.formationInfoText}>{product.modaliteDeplacement}</Text>
                                </View>
                            )}

                            {/* Disponibilité */}
                            {product.disponibilite && (
                                <View style={styles.formationInfoItem}>
                                    <SafeIcon name="calendar" size={14} color="#10B981" />
                                    <Text style={styles.formationInfoLabel}>Disponibilité: </Text>
                                    <Text style={styles.formationInfoText}>{product.disponibilite}</Text>
                                </View>
                            )}

                            {/* Mode tarification */}
                            {product.modeTarification && (
                                <View style={styles.formationInfoItem}>
                                    <SafeIcon name="dollar-sign" size={14} color="#10B981" />
                                    <Text style={styles.formationInfoLabel}>Tarification: </Text>
                                    <Text style={styles.formationInfoText}>{product.modeTarification}</Text>
                                </View>
                            )}

                            {/* Expérience */}
                            {product.niveauExperience && (
                                <View style={styles.formationInfoItem}>
                                    <SafeIcon name="award" size={14} color="#10B981" />
                                    <Text style={styles.formationInfoLabel}>Expérience: </Text>
                                    <Text style={styles.formationInfoText}>{product.niveauExperience}</Text>
                                </View>
                            )}
                        </View>
                    </View>
                );
            }

            case 'formation_education': {
                // ════════════════════════════════════════════════════════════
                // ✅ AFFICHAGE ULTRA-ENRICHI FORMATION & ÉDUCATION
                // ════════════════════════════════════════════════════════════

                const getNiveauColor = (niveau: string) => {
                    if (niveau?.includes('Débutant')) return { bg: '#DBEAFE', text: '#1E40AF', border: '#3B82F6' };
                    if (niveau?.includes('Intermédiaire')) return { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B' };
                    if (niveau?.includes('Avancé')) return { bg: '#FED7AA', text: '#9A3412', border: '#F97316' };
                    if (niveau?.includes('Expert') || niveau?.includes('Professionnel')) return { bg: '#F3E8FF', text: '#6B21A8', border: '#A855F7' };
                    return { bg: '#F3F4F6', text: '#374151', border: '#9CA3AF' };
                };

                const niveauColor = product.niveauCompetence ? getNiveauColor(product.niveauCompetence) : null;

                return (
                    <View style={{ gap: 12 }}>
                        {/* Badges principaux */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {/* Type de formation */}
                            {product.typeFormation && (
                                <View style={styles.formationTypeBadge}>
                                    <Text style={styles.formationTypeText}>
                                        {product.typeFormation.includes('Académique') && '🎓 '}
                                        {product.typeFormation.includes('Professionnelle') && '💼 '}
                                        {product.typeFormation.includes('Technique') && '⚙️ '}
                                        {product.typeFormation.includes('Langues') && '🌍 '}
                                        {product.typeFormation.includes('Arts') && '🎨 '}
                                        {product.typeFormation}
                                    </Text>
                                </View>
                            )}

                            {/* Format (Présentiel, En ligne, Hybride) */}
                            {product.formatFormation && (
                                <View style={styles.formationModeBadge}>
                                    <Text style={styles.formationModeText}>
                                        {product.formatFormation.includes('En ligne') && '💻 '}
                                        {product.formatFormation.includes('Présentiel') && '🏫 '}
                                        {product.formatFormation.includes('Hybride') && '🔄 '}
                                        {product.formatFormation.includes('domicile') && '🏠 '}
                                        {product.formatFormation}
                                    </Text>
                                </View>
                            )}

                            {/* Certification */}
                            {product.certificationObtenue && (
                                <View style={styles.formationCertifBadge}>
                                    <Text style={styles.formationCertifText}>
                                        📜 {product.certificationObtenue}
                                    </Text>
                                </View>
                            )}

                            {/* Certification internationale */}
                            {product.certificationInternationale && (
                                <View style={[styles.formationCertifBadge, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }]}>
                                    <Text style={[styles.formationCertifText, { color: '#92400E' }]}>
                                        🌍 Certif. internationale
                                    </Text>
                                </View>
                            )}

                            {/* Niveau de compétence */}
                            {product.niveauCompetence && niveauColor && (
                                <View style={[styles.formationNiveauBadge, { backgroundColor: niveauColor.bg, borderColor: niveauColor.border }]}>
                                    <Text style={[styles.formationNiveauText, { color: niveauColor.text }]}>
                                        {product.niveauCompetence}
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Informations principales */}
                        <View style={styles.formationInfos}>
                            {/* Durée */}
                            {product.dureeFormation && (
                                <View style={styles.formationInfoItem}>
                                    <SafeIcon name="clock" size={14} color="#7C3AED" />
                                    <Text style={styles.formationInfoLabel}>Durée: </Text>
                                    <Text style={styles.formationInfoText}>{product.dureeFormation}</Text>
                                </View>
                            )}

                            {/* Rythme */}
                            {product.rythmeFormation && (
                                <View style={styles.formationInfoItem}>
                                    <SafeIcon name="calendar" size={14} color="#7C3AED" />
                                    <Text style={styles.formationInfoLabel}>Rythme: </Text>
                                    <Text style={styles.formationInfoText}>{product.rythmeFormation}</Text>
                                </View>
                            )}

                            {/* Horaires */}
                            {product.horairesFormation && (
                                <View style={styles.formationInfoItem}>
                                    <SafeIcon name="clock" size={14} color="#7C3AED" />
                                    <Text style={styles.formationInfoLabel}>Horaires: </Text>
                                    <Text style={styles.formationInfoText}>{product.horairesFormation}</Text>
                                </View>
                            )}

                            {/* Profil formateur */}
                            {product.profilFormateur && (
                                <View style={styles.formationInfoItem}>
                                    <SafeIcon name="user" size={14} color="#7C3AED" />
                                    <Text style={styles.formationInfoLabel}>Formateur: </Text>
                                    <Text style={styles.formationInfoText}>{product.profilFormateur}</Text>
                                </View>
                            )}

                            {/* Expérience formateur */}
                            {product.experienceFormateur && (
                                <View style={styles.formationInfoItem}>
                                    <SafeIcon name="award" size={14} color="#7C3AED" />
                                    <Text style={styles.formationInfoLabel}>Expérience: </Text>
                                    <Text style={styles.formationInfoText}>{product.experienceFormateur}</Text>
                                </View>
                            )}

                            {/* Langues d'enseignement */}
                            {product.languesEnseignement && Array.isArray(product.languesEnseignement) && product.languesEnseignement.length > 0 && (
                                <View style={styles.formationInfoItem}>
                                    <SafeIcon name="globe" size={14} color="#7C3AED" />
                                    <Text style={styles.formationInfoLabel}>Langues: </Text>
                                    <Text style={styles.formationInfoText}>{product.languesEnseignement.join(', ')}</Text>
                                </View>
                            )}
                        </View>

                        {/* Niveaux scolaires (pour cours particuliers) */}
                        {product.niveauxScolaires && Array.isArray(product.niveauxScolaires) && product.niveauxScolaires.length > 0 && (
                            <View style={styles.formationSection}>
                                <Text style={styles.formationSectionTitle}>📚 Niveaux enseignés :</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                                    {product.niveauxScolaires.slice(0, 5).map((niveau, idx) => (
                                        <View key={idx} style={styles.formationTag}>
                                            <Text style={styles.formationTagText}>{niveau}</Text>
                                        </View>
                                    ))}
                                    {product.niveauxScolaires.length > 5 && (
                                        <View style={styles.formationTag}>
                                            <Text style={styles.formationTagText}>+{product.niveauxScolaires.length - 5}</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* Matières enseignées */}
                        {product.matieresEnseignees && Array.isArray(product.matieresEnseignees) && product.matieresEnseignees.length > 0 && (
                            <View style={styles.formationSection}>
                                <Text style={styles.formationSectionTitle}>📖 Matières :</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                                    {product.matieresEnseignees.slice(0, 6).map((matiere, idx) => (
                                        <View key={idx} style={styles.formationMatiereTag}>
                                            <Text style={styles.formationMatiereText}>{matiere}</Text>
                                        </View>
                                    ))}
                                    {product.matieresEnseignees.length > 6 && (
                                        <View style={styles.formationMatiereTag}>
                                            <Text style={styles.formationMatiereText}>+{product.matieresEnseignees.length - 6}</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* Préparation Concours */}
                        {product.concoursCibles && Array.isArray(product.concoursCibles) && product.concoursCibles.length > 0 && (
                            <View style={[styles.formationSection, { backgroundColor: '#FEF3C7', borderLeftColor: '#F59E0B', borderLeftWidth: 3, padding: 10, borderRadius: 8 }]}>
                                <Text style={[styles.formationSectionTitle, { color: '#92400E' }]}>🎓 Préparation Concours :</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                                    {product.concoursCibles.slice(0, 4).map((concours, idx) => (
                                        <View key={idx} style={[styles.formationTag, { backgroundColor: '#FFFFFF', borderColor: '#F59E0B' }]}>
                                            <Text style={[styles.formationTagText, { color: '#92400E' }]}>{concours}</Text>
                                        </View>
                                    ))}
                                    {product.concoursCibles.length > 4 && (
                                        <View style={[styles.formationTag, { backgroundColor: '#FFFFFF', borderColor: '#F59E0B' }]}>
                                            <Text style={[styles.formationTagText, { color: '#92400E' }]}>+{product.concoursCibles.length - 4}</Text>
                                        </View>
                                    )}
                                </View>

                                {/* Informations concours enrichies */}
                                <View style={{ marginTop: 8, gap: 6 }}>
                                    {/* Taux de réussite */}
                                    {product.tauxReussiteConcours && (
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <SafeIcon name="trophy" size={14} color="#F59E0B" />
                                            <Text style={{ marginLeft: 4, fontSize: 12, color: '#92400E', fontWeight: '600' }}>
                                                Taux de réussite: {product.tauxReussiteConcours}
                                            </Text>
                                        </View>
                                    )}

                                    {/* Durée de préparation */}
                                    {product.dureePreparationConcours && (
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <SafeIcon name="clock" size={14} color="#F59E0B" />
                                            <Text style={{ marginLeft: 4, fontSize: 12, color: '#92400E', fontWeight: '600' }}>
                                                Durée préparation: {product.dureePreparationConcours}
                                            </Text>
                                        </View>
                                    )}

                                    {/* Niveau de difficulté */}
                                    {product.difficulteConcours && (
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <SafeIcon name="trending-up" size={14} color="#F59E0B" />
                                            <Text style={{ marginLeft: 4, fontSize: 12, color: '#92400E', fontWeight: '600' }}>
                                                Difficulté: {product.difficulteConcours}
                                            </Text>
                                        </View>
                                    )}

                                    {/* Places disponibles */}
                                    {product.placesDisponiblesConcours && (
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <SafeIcon name="users" size={14} color="#F59E0B" />
                                            <Text style={{ marginLeft: 4, fontSize: 12, color: '#92400E', fontWeight: '600' }}>
                                                Places disponibles: {product.placesDisponiblesConcours}
                                            </Text>
                                        </View>
                                    )}
                                </View>

                                {/* ✅ NOUVEAU: Anciens sujets disponibles */}
                                {product.anciensSujetsDisponibles && Array.isArray(product.anciensSujetsDisponibles) && product.anciensSujetsDisponibles.length > 0 && (
                                    <View style={{ marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                                        <Text style={{ fontSize: 11, color: '#92400E', fontWeight: '600', width: '100%' }}>
                                            📚 Anciens sujets disponibles:
                                        </Text>
                                        {product.anciensSujetsDisponibles.slice(0, 3).map((sujet, idx) => (
                                            <View key={idx} style={{
                                                backgroundColor: '#FFFFFF',
                                                borderColor: '#10B981',
                                                borderWidth: 1,
                                                borderRadius: 4,
                                                paddingHorizontal: 6,
                                                paddingVertical: 2
                                            }}>
                                                <Text style={{ fontSize: 10, color: '#10B981', fontWeight: '600' }}>
                                                    {sujet}
                                                </Text>
                                            </View>
                                        ))}
                                        {product.anciensSujetsDisponibles.length > 3 && (
                                            <View style={{
                                                backgroundColor: '#FFFFFF',
                                                borderColor: '#10B981',
                                                borderWidth: 1,
                                                borderRadius: 4,
                                                paddingHorizontal: 6,
                                                paddingVertical: 2
                                            }}>
                                                <Text style={{ fontSize: 10, color: '#10B981', fontWeight: '600' }}>
                                                    +{product.anciensSujetsDisponibles.length - 3}
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                )}

                                {/* ✅ NOUVEAU: Types de documents concours disponibles */}
                                {product.typesDocumentsConcours && Array.isArray(product.typesDocumentsConcours) && product.typesDocumentsConcours.length > 0 && (
                                    <View style={{ marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                                        <Text style={{ fontSize: 11, color: '#92400E', fontWeight: '600', width: '100%' }}>
                                            📋 Types de documents:
                                        </Text>
                                        {product.typesDocumentsConcours.slice(0, 4).map((document, idx) => (
                                            <View key={idx} style={{
                                                backgroundColor: '#FFF',
                                                borderColor: '#6366F1',
                                                borderWidth: 1,
                                                borderRadius: 4,
                                                paddingHorizontal: 6,
                                                paddingVertical: 2
                                            }}>
                                                <Text style={{ fontSize: 10, color: '#6366F1', fontWeight: '600' }}>
                                                    {document}
                                                </Text>
                                            </View>
                                        ))}
                                        {product.typesDocumentsConcours.length > 4 && (
                                            <View style={{
                                                backgroundColor: '#FFF',
                                                borderColor: '#6366F1',
                                                borderWidth: 1,
                                                borderRadius: 4,
                                                paddingHorizontal: 6,
                                                paddingVertical: 2
                                            }}>
                                                <Text style={{ fontSize: 10, color: '#6366F1', fontWeight: '600' }}>
                                                    +{product.typesDocumentsConcours.length - 4}
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                )}
                            </View>
                        )}

                        {/* Public cible */}
                        {product.publicCible && Array.isArray(product.publicCible) && product.publicCible.length > 0 && (
                            <View style={styles.formationInfoItem}>
                                <SafeIcon name="users" size={14} color="#7C3AED" />
                                <Text style={styles.formationInfoLabel}>Public: </Text>
                                <Text style={styles.formationInfoText}>{product.publicCible.slice(0, 3).join(', ')}</Text>
                            </View>
                        )}
                    </View>
                );
            }

            case 'hotellerie': {
                const getCategorieColor = (categorie: string) => {
                    if (categorie?.includes('5') || categorie?.includes('Palace')) return { bg: '#FEF3C7', text: '#92400E', icon: '⭐⭐⭐⭐⭐' };
                    if (categorie?.includes('4')) return { bg: '#DBEAFE', text: '#1E40AF', icon: '⭐⭐⭐⭐' };
                    if (categorie?.includes('3')) return { bg: '#E0E7FF', text: '#3730A3', icon: '⭐⭐⭐' };
                    if (categorie?.includes('2')) return { bg: '#FEF3C7', text: '#92400E', icon: '⭐⭐' };
                    return { bg: '#F3F4F6', text: '#374151', icon: '⭐' };
                };

                const categorieColor = product.categorieHotel ? getCategorieColor(product.categorieHotel) : null;

                return (
                    <View style={{ gap: 12 }}>
                        {/* Badges principaux */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {product.categorieHotel && categorieColor && (
                                <View style={[styles.hotelCatBadge, { backgroundColor: categorieColor.bg }]}>
                                    <Text style={[styles.hotelCatText, { color: categorieColor.text }]}>{categorieColor.icon}</Text>
                                </View>
                            )}
                            {product.typeHebergement && (
                                <View style={styles.hotelTypeBadge}>
                                    <Text style={styles.hotelTypeText}>🏨 {product.typeHebergement}</Text>
                                </View>
                            )}
                            {product.petitDejeuner && (
                                <View style={styles.hotelServiceBadge}>
                                    <Text style={styles.hotelServiceText}>🍳 Petit-déj inclus</Text>
                                </View>
                            )}
                        </View>

                        {/* Prix par nuit */}
                        {product.prixParNuit && (
                            <View style={styles.hotelPrix}>
                                <Text style={styles.hotelPrixText}>
                                    {product.prixParNuit} {product.deviseHotel || 'XAF'} / nuit
                                </Text>
                            </View>
                        )}

                        {/* ✅ NOUVEAU : Variantes de chambres */}
                        {product.variantesChambres && Array.isArray(product.variantesChambres) && product.variantesChambres.length > 0 && (
                            <View style={styles.hotelVariantes}>
                                <View style={styles.hotelVariantesHeader}>
                                    <SafeIcon name="bed" size={16} color="#EC4899" />
                                    <Text style={styles.hotelVariantesTitre}>
                                        Chambres disponibles ({product.variantesChambres.length})
                                    </Text>
                                </View>
                                <View style={styles.hotelVariantesList}>
                                    {product.variantesChambres.slice(0, 3).map((variante, idx) => (
                                        <View key={idx} style={styles.hotelVarianteCard}>
                                            <View style={styles.hotelVarianteHeader}>
                                                <Text style={styles.hotelVarianteType}>
                                                    {variante.typeChambre}
                                                </Text>
                                                <Text style={styles.hotelVariantePrix}>
                                                    {parseFloat(variante.prix || 0).toLocaleString()} {variante.devise || 'XAF'}/nuit
                                                </Text>
                                            </View>
                                            <View style={styles.hotelVarianteDetails}>
                                                {variante.capacite && (
                                                    <Text style={styles.hotelVarianteCapacite}>
                                                        👥 {variante.capacite}
                                                    </Text>
                                                )}
                                                {variante.superficie && (
                                                    <Text style={styles.hotelVarianteSuperficie}>
                                                        📐 {variante.superficie} m²
                                                    </Text>
                                                )}
                                                {variante.nbChambresDisponibles && (
                                                    <Text style={styles.hotelVarianteDisponibles}>
                                                        ✓ {variante.nbChambresDisponibles} dispo
                                                    </Text>
                                                )}
                                            </View>
                                            {variante.equipements && variante.equipements.length > 0 && (
                                                <View style={styles.hotelVarianteEquipements}>
                                                    {variante.equipements.slice(0, 3).map((eq, i) => (
                                                        <Text key={i} style={styles.hotelVarianteEquipTag}>
                                                            {eq}
                                                        </Text>
                                                    ))}
                                                    {variante.equipements.length > 3 && (
                                                        <Text style={styles.hotelVarianteEquipTag}>
                                                            +{variante.equipements.length - 3}
                                                        </Text>
                                                    )}
                                                </View>
                                            )}
                                        </View>
                                    ))}
                                    {product.variantesChambres.length > 3 && (
                                        <Text style={styles.hotelVariantesMore}>
                                            +{product.variantesChambres.length - 3} autre(s) type(s) de chambres
                                        </Text>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* Équipements principaux */}
                        {product.equipementsHotel && Array.isArray(product.equipementsHotel) && product.equipementsHotel.length > 0 && (
                            <View style={styles.hotelEquipements}>
                                {product.equipementsHotel.slice(0, 5).map((eq, idx) => (
                                    <View key={idx} style={styles.hotelEquipementTag}>
                                        <Text style={styles.hotelEquipementText}>
                                            {eq === 'Wi-Fi' && '📶 '}
                                            {eq === 'Piscine' && '🏊 '}
                                            {eq === 'Restaurant' && '🍽️ '}
                                            {eq === 'Spa' && '💆 '}
                                            {eq === 'Parking' && '🅿️ '}
                                            {eq === 'Bar' && '🍹 '}
                                            {eq}
                                        </Text>
                                    </View>
                                ))}
                                {product.equipementsHotel.length > 5 && (
                                    <View style={styles.hotelEquipementTag}>
                                        <Text style={styles.hotelEquipementText}>+{product.equipementsHotel.length - 5}</Text>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* Services */}
                        {product.servicesHotel && Array.isArray(product.servicesHotel) && product.servicesHotel.length > 0 && (
                            <View style={styles.hotelServices}>
                                {product.servicesHotel.map((service, idx) => (
                                    <View key={idx} style={styles.hotelServiceTag}>
                                        <Text style={styles.hotelServiceTagText}>{service}</Text>
                                    </View>
                                ))}
                            </View>
                        )}

                        {/* ✅ NOUVEAU : Localisation intelligente */}
                        <HotelLocationDisplay
                            hotel={product}
                            userLocation={userLocation} // ✅ CORRECTION: Utiliser la vraie localisation
                            compact={false}
                            showDistance={true}
                        />
                    </View>
                );
            }

            case 'electromenager': {
                const getClasseEnergetiqueColor = (classe: string) => {
                    if (classe === 'A+++') return { bg: '#059669', text: '#FFF' };
                    if (classe === 'A++') return { bg: '#10B981', text: '#FFF' };
                    if (classe === 'A+') return { bg: '#34D399', text: '#000' };
                    if (classe === 'A') return { bg: '#F59E0B', text: '#000' };
                    if (classe === 'B') return { bg: '#F97316', text: '#FFF' };
                    if (classe === 'C') return { bg: '#EF4444', text: '#FFF' };
                    if (classe === 'D') return { bg: '#DC2626', text: '#FFF' };
                    return { bg: '#9CA3AF', text: '#FFF' };
                };

                const classeColor = product.consommationEnergetique ? getClasseEnergetiqueColor(product.consommationEnergetique) : null;

                const getEtatColorElectro = (etat: string) => {
                    if (etat === 'Neuf') return { bg: '#D1FAE5', text: '#065F46', border: '#10B981' };
                    if (etat === 'Reconditionné') return { bg: '#DBEAFE', text: '#1E40AF', border: '#3B82F6' };
                    return { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B' };
                };

                const etatColor = product.etatElectro ? getEtatColorElectro(product.etatElectro) : null;
                const annee = product.anneeAchat ? parseInt(product.anneeAchat) : null;
                const isRecent = annee && annee >= 2022;

                return (
                    <View style={{ gap: 12 }}>
                        {/* Badges principaux */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {product.etatElectro && etatColor && (
                                <View style={[styles.electroEtatChip, { backgroundColor: etatColor.bg, borderColor: etatColor.border }]}>
                                    <Text style={[styles.electroEtatText, { color: etatColor.text }]}>{product.etatElectro}</Text>
                                </View>
                            )}
                            {product.consommationEnergetique && classeColor && (
                                <View style={[styles.electroClasseChip, { backgroundColor: classeColor.bg }]}>
                                    <Text style={[styles.electroClasseText, { color: classeColor.text }]}>⚡ {product.consommationEnergetique}</Text>
                                </View>
                            )}
                            {isRecent && (
                                <View style={styles.electroRecentChip}>
                                    <SafeIcon name="sparkles" size={12} color="#0EA5E9" />
                                    <Text style={styles.electroRecentText}>Récent ({annee})</Text>
                                </View>
                            )}
                        </View>

                        {/* Identité */}
                        <View style={styles.electroIdentity}>
                            <Text style={styles.electroMarqueText}>
                                {product.marqueElectro || ''} {product.modeleElectro || ''}
                            </Text>
                            <Text style={styles.electroTypeText}>
                                🔌 {product.typeElectro || 'Appareil'} {product.categorieElectro ? `• ${product.categorieElectro}` : ''}
                            </Text>
                        </View>

                        {/* Caractéristiques techniques */}
                        <View style={styles.electroSpecs}>
                            {product.capacite && (
                                <View style={styles.electroSpecItem}>
                                    <SafeIcon name="box" size={14} color="#14B8A6" />
                                    <Text style={styles.electroSpecText}>{product.capacite} L/Kg</Text>
                                </View>
                            )}
                            {product.couleurElectro && (
                                <View style={styles.electroSpecItem}>
                                    <SafeIcon name="droplet" size={14} color="#14B8A6" />
                                    <Text style={styles.electroSpecText}>{product.couleurElectro}</Text>
                                </View>
                            )}
                            {product.dimensionsElectro && (
                                <View style={styles.electroSpecItem}>
                                    <SafeIcon name="maximize-2" size={14} color="#14B8A6" />
                                    <Text style={styles.electroSpecText}>{product.dimensionsElectro}</Text>
                                </View>
                            )}
                        </View>

                        {/* Fonctionnalités */}
                        {product.fonctionnalites && product.fonctionnalites.length > 0 && (
                            <View style={styles.electroFonctionnalites}>
                                {product.fonctionnalites.slice(0, 4).map((fonc, idx) => (
                                    <View key={idx} style={styles.electroFoncTag}>
                                        <Text style={styles.electroFoncText}>{fonc}</Text>
                                    </View>
                                ))}
                            </View>
                        )}

                        {/* Garantie et Documents */}
                        {(product.garantieElectro || product.garantieConstructeur || product.facture || product.manuel) && (
                            <View style={styles.electroGarantie}>
                                {product.garantieElectro && (
                                    <Text style={styles.electroGarantieText}>🛡️ Garantie: {product.garantieElectro}</Text>
                                )}
                                {product.garantieConstructeur && (
                                    <View style={styles.electroDocBadge}>
                                        <SafeIcon name="shield-check" size={10} color="#059669" />
                                        <Text style={styles.electroDocText}>Garantie constructeur</Text>
                                    </View>
                                )}
                                {product.facture && (
                                    <View style={styles.electroDocBadge}>
                                        <SafeIcon name="file-text" size={10} color="#059669" />
                                        <Text style={styles.electroDocText}>Facture</Text>
                                    </View>
                                )}
                                {product.manuel && (
                                    <View style={styles.electroDocBadge}>
                                        <SafeIcon name="book-open" size={10} color="#059669" />
                                        <Text style={styles.electroDocText}>Manuel</Text>
                                    </View>
                                )}
                            </View>
                        )}
                    </View>
                );
            }

            case 'pharmacie': {
                const pharmacyStatus = getPharmacyStatus(product);
                const isOpen = isPharmacyOpenNow(product);
                const services = product.servicesPharmacie || product.services || [];
                const joursOuverture = product.joursOuverturePharmacie || [];

                return (
                    <View style={styles.detailsSection}>
                        {/* Type de pharmacie */}
                        {product.typePharmacie && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="shield" size={14} color="#059669" />
                                <Text style={styles.detailText}>{product.typePharmacie}</Text>
                            </View>
                        )}

                        {/* Statut ouverture - Badge proéminent */}
                        <View style={[
                            styles.detailChip,
                            styles.statusChip,
                            isOpen ? styles.openChip : styles.closedChip
                        ]}>
                            <Text style={[
                                styles.detailText,
                                isOpen ? styles.openText : styles.closedText
                            ]}>
                                {pharmacyStatus.message}
                            </Text>
                        </View>

                        {/* Heures d'ouverture */}
                        {(product.heuresOuverture || product.heuresFermeture) && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="clock" size={14} color="#6B7280" />
                                <Text style={styles.detailText}>
                                    {product.heuresOuverture || '?'} - {product.heuresFermeture || '?'}
                                </Text>
                            </View>
                        )}

                        {/* Jours d'ouverture */}
                        {joursOuverture && Array.isArray(joursOuverture) && joursOuverture.length > 0 && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="calendar" size={14} color="#059669" />
                                <Text style={styles.detailText}>
                                    {joursOuverture.length === 7
                                        ? 'Tous les jours'
                                        : joursOuverture.map(j => j.substring(0, 3)).join(', ')
                                    }
                                </Text>
                            </View>
                        )}

                        {/* Jours de garde */}
                        {product.joursGarde && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="moon" size={14} color="#3B82F6" />
                                <Text style={styles.detailText}>Garde: {product.joursGarde}</Text>
                            </View>
                        )}

                        {/* Téléphone urgence */}
                        {product.telephoneUrgence && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="phone" size={14} color="#DC2626" />
                                <Text style={styles.detailText}>{product.telephoneUrgence}</Text>
                            </View>
                        )}

                        {/* Services disponibles */}
                        {services && Array.isArray(services) && services.length > 0 && (
                            <View style={styles.servicesContainer}>
                                <Text style={styles.prestationLabel}>Services disponibles:</Text>
                                <View style={styles.tagsContainer}>
                                    {services.slice(0, 6).map((service: string, idx: number) => (
                                        <View key={idx} style={styles.serviceTag}>
                                            <Text style={styles.serviceText}>{service}</Text>
                                        </View>
                                    ))}
                                    {services.length > 6 && (
                                        <View style={styles.serviceTag}>
                                            <Text style={styles.serviceText}>+{services.length - 6}</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        )}
                    </View>
                );
            }

            case 'hopital_clinique': {
                const hasUrgency = hasEmergencyAvailable(product);

                return (
                    <View style={styles.detailsSection}>
                        {/* Type d'établissement */}
                        {product.typeEtablissement && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="building" size={14} color="#DC2626" />
                                <Text style={styles.detailText}>{product.typeEtablissement}</Text>
                            </View>
                        )}

                        {/* Banque de sang - Badge plus visible */}
                        {product.banqueSang && (
                            <View style={[styles.detailChip, styles.bloodBankChip]}>
                                <Text style={[styles.detailText, styles.bloodBankText]}>🩸 Banque de sang disponible</Text>
                            </View>
                        )}

                        {/* Urgences disponibles - Badge visible */}
                        {hasUrgency && (
                            <View style={[styles.detailChip, styles.emergencyChip]}>
                                <SafeIcon name="alert-circle" size={14} color="#DC2626" />
                                <Text style={[styles.detailText, styles.emergencyText]}>🚨 Urgences disponibles</Text>
                            </View>
                        )}

                        {/* RDV en ligne */}
                        {product.rdvEnLigne && (
                            <View style={[styles.detailChip, styles.successChip]}>
                                <SafeIcon name="calendar" size={14} color="#10B981" />
                                <Text style={[styles.detailText, styles.successText]}>📅 RDV en ligne</Text>
                            </View>
                        )}

                        {/* Prestations médicales COMPLÈTES avec planning */}
                        {product.prestationsMedicales && product.prestationsMedicales.length > 0 && (
                            <View style={styles.prestationsFullContainer}>
                                <Text style={styles.prestationLabelMain}>
                                    🏥 Prestations disponibles ({product.prestationsMedicales.length})
                                </Text>
                                {product.prestationsMedicales.map((prestation: string, idx: number) => {
                                    const planning = product.planningHebdomadaire?.[prestation];
                                    return (
                                        <View key={idx} style={styles.prestationItemFull}>
                                            <View style={styles.prestationHeader}>
                                                <Text style={styles.prestationName}>• {prestation}</Text>
                                            </View>
                                            {planning && (
                                                <Text style={styles.prestationSchedule}>
                                                    {formatPrestationPlanning(planning)}
                                                </Text>
                                            )}
                                            {!planning && (
                                                <Text style={styles.prestationScheduleDefault}>
                                                    📅 Planning non précisé
                                                </Text>
                                            )}
                                        </View>
                                    );
                                })}
                            </View>
                        )}
                    </View>
                );
            }

            case 'laboratoire': {
                return (
                    <View style={styles.detailsSection}>
                        {/* Type de laboratoire */}
                        {product.typeLaboratoire && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="flask" size={14} color="#7C3AED" />
                                <Text style={styles.detailText}>{product.typeLaboratoire}</Text>
                            </View>
                        )}

                        {/* Prélèvement à domicile */}
                        {product.prelevementDomicile && (
                            <View style={[styles.detailChip, styles.successChip]}>
                                <SafeIcon name="home" size={14} color="#10B981" />
                                <Text style={[styles.detailText, styles.successText]}>🏠 Prélèvement domicile</Text>
                            </View>
                        )}

                        {/* Résultats rapides */}
                        {product.resultatRapide && (
                            <View style={[styles.detailChip, styles.emergencyChip]}>
                                <SafeIcon name="zap" size={14} color="#F59E0B" />
                                <Text style={[styles.detailText, styles.emergencyText]}>⚡ Résultats rapides</Text>
                            </View>
                        )}

                        {/* RDV en ligne */}
                        {product.rdvEnLigne && (
                            <View style={[styles.detailChip, styles.successChip]}>
                                <SafeIcon name="calendar" size={14} color="#10B981" />
                                <Text style={[styles.detailText, styles.successText]}>📅 RDV en ligne</Text>
                            </View>
                        )}

                        {/* Examens disponibles COMPLETS avec planning */}
                        {product.examensLaboratoire && product.examensLaboratoire.length > 0 && (
                            <View style={styles.prestationsFullContainer}>
                                <Text style={styles.prestationLabelMain}>
                                    🔬 Examens disponibles ({product.examensLaboratoire.length})
                                </Text>
                                {product.examensLaboratoire.map((examen: string, idx: number) => {
                                    const planning = product.planningExamens?.[examen];
                                    return (
                                        <View key={idx} style={styles.prestationItemFull}>
                                            <View style={styles.prestationHeader}>
                                                <Text style={styles.prestationName}>• {examen}</Text>
                                            </View>
                                            {planning && (
                                                <Text style={styles.prestationSchedule}>
                                                    {formatPrestationPlanning(planning)}
                                                </Text>
                                            )}
                                            {!planning && (
                                                <Text style={styles.prestationScheduleDefault}>
                                                    📅 Planning non précisé
                                                </Text>
                                            )}
                                        </View>
                                    );
                                })}
                            </View>
                        )}

                        {/* Délai résultats */}
                        {product.delaiResultat && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="clock" size={14} color="#6B7280" />
                                <Text style={styles.detailText}>Résultats: {product.delaiResultat}</Text>
                            </View>
                        )}
                    </View>
                );
            }

            case 'ticket_voyage':
                return (
                    <View style={styles.detailsGrid}>
                        {product.depart && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="map-pin" size={14} color="#8B5CF6" />
                                <Text style={styles.detailText}>De: {product.depart}</Text>
                            </View>
                        )}
                        {product.destination && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="flag" size={14} color="#8B5CF6" />
                                <Text style={styles.detailText}>À: {product.destination}</Text>
                            </View>
                        )}
                        {product.dateDepart && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="calendar" size={14} color="#6B7280" />
                                <Text style={styles.detailText}>{product.dateDepart}</Text>
                            </View>
                        )}
                        {product.heureDepart && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="clock" size={14} color="#6B7280" />
                                <Text style={styles.detailText}>{product.heureDepart}</Text>
                            </View>
                        )}
                    </View>
                );

            case 'transport_intra_urbain': {
                return (
                    <View style={{ gap: 12 }}>
                        {/* Type de véhicule */}
                        {product.typeVehiculeTransport && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <SafeIcon name="car" size={16} color="#F59E0B" />
                                <Text style={{ fontSize: 14, fontWeight: '600', color: '#1F2937' }}>
                                    {product.typeVehiculeTransport}
                                </Text>
                            </View>
                        )}

                        {/* Zone de service (ville + quartier) */}
                        {(product.villeService || product.quartierService) && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <SafeIcon name="map-pin" size={16} color="#10B981" />
                                <Text style={{ fontSize: 13, color: '#6B7280' }}>
                                    {product.quartierService || product.villeService}
                                </Text>
                            </View>
                        )}

                        {/* Catégorie de service */}
                        {product.categorieService && (
                            <View style={{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#FEF3C7', borderRadius: 8, alignSelf: 'flex-start' }}>
                                <Text style={{ fontSize: 12, fontWeight: '600', color: '#92400E' }}>
                                    {product.categorieService}
                                </Text>
                            </View>
                        )}

                        {/* Disponibilité */}
                        {product.disponibilite && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <SafeIcon name="clock" size={16} color="#10B981" />
                                <Text style={{ fontSize: 13, color: '#10B981', fontWeight: '500' }}>
                                    {product.disponibilite}
                                </Text>
                            </View>
                        )}

                        {/* Options de confort (badges) */}
                        {product.optionsConfort && Array.isArray(product.optionsConfort) && product.optionsConfort.length > 0 && (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                {product.optionsConfort.slice(0, 3).map((option: string, idx: number) => (
                                    <View key={idx} style={{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#E0F2FE', borderRadius: 6 }}>
                                        <Text style={{ fontSize: 11, color: '#0369A1' }}>{option}</Text>
                                    </View>
                                ))}
                            </View>
                        )}

                        {/* Mode de paiement */}
                        {product.modePaiement && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <SafeIcon name="credit-card" size={16} color="#8B5CF6" />
                                <Text style={{ fontSize: 12, color: '#6B7280' }}>
                                    {Array.isArray(product.modePaiement) ? product.modePaiement.join(', ') : product.modePaiement}
                                </Text>
                            </View>
                        )}
                    </View>
                );
            }

            case 'covoiturage': {
                return (
                    <View style={{ gap: 12 }}>
                        {/* Itinéraire principal */}
                        {(product.pointDepart || product.pointArrivee) && (
                            <View style={styles.covoiturageItineraire}>
                                <Text style={styles.covoiturageVille}>{product.pointDepart || '?'}</Text>
                                <SafeIcon name="arrow-right" size={18} color="#EC4899" />
                                <Text style={styles.covoiturageVille}>{product.pointArrivee || '?'}</Text>
                            </View>
                        )}

                        {/* Horaires */}
                        {(product.dateTrajet || product.heureTrajet) && (
                            <View style={styles.covoiturageHoraires}>
                                {product.dateTrajet && <Text style={styles.covoiturageHoraireText}>📅 {product.dateTrajet}</Text>}
                                {product.heureTrajet && <Text style={styles.covoiturageHoraireText}>🕐 {product.heureTrajet}</Text>}
                            </View>
                        )}

                        {/* Places disponibles */}
                        {product.nbPlacesDisponibles && (
                            <View style={styles.covoituragePlacesBadge}>
                                <Text style={styles.covoituragePlacesText}>
                                    👥 {product.nbPlacesDisponibles} place{parseInt(product.nbPlacesDisponibles) > 1 ? 's' : ''} disponible{parseInt(product.nbPlacesDisponibles) > 1 ? 's' : ''}
                                </Text>
                            </View>
                        )}

                        {/* Véhicule */}
                        {product.vehiculeInfo && (
                            <View style={styles.covoiturageVehiculeBadge}>
                                <Text style={styles.covoiturageVehiculeText}>🚗 {product.vehiculeInfo}</Text>
                            </View>
                        )}

                        {/* Préférences */}
                        {product.preferencesTrajet && (
                            <View style={styles.covoituragePreferences}>
                                <Text style={styles.covoituragePreferencesText}>✓ {product.preferencesTrajet}</Text>
                            </View>
                        )}
                    </View>
                );
            }

            case 'mobilier': {
                const getEtatColorMobilier = (etat: string) => {
                    if (etat?.includes('Neuf')) return { bg: '#D1FAE5', text: '#065F46', border: '#10B981' };
                    if (etat?.includes('Excellent')) return { bg: '#DBEAFE', text: '#1E40AF', border: '#3B82F6' };
                    if (etat?.includes('Bon') || etat?.includes('Très bon')) return { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B' };
                    return { bg: '#FEE2E2', text: '#991B1B', border: '#EF4444' };
                };

                const etatColor = product.etatMobilier ? getEtatColorMobilier(product.etatMobilier) : null;

                return (
                    <View style={{ gap: 12 }}>
                        {/* Badges */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {product.etatMobilier && etatColor && (
                                <View style={[styles.mobilierEtatChip, { backgroundColor: etatColor.bg, borderColor: etatColor.border }]}>
                                    <Text style={[styles.mobilierEtatText, { color: etatColor.text }]}>{product.etatMobilier}</Text>
                                </View>
                            )}
                            {product.styleMobilier && (
                                <View style={styles.mobilierStyleChip}>
                                    <Text style={styles.mobilierStyleText}>{product.styleMobilier}</Text>
                                </View>
                            )}
                            {product.livraison && (
                                <View style={styles.mobilierLivraisonChip}>
                                    <SafeIcon name="truck" size={12} color="#059669" />
                                    <Text style={styles.mobilierLivraisonText}>Livraison</Text>
                                </View>
                            )}
                        </View>

                        {/* Identité */}
                        <View style={styles.mobilierIdentity}>
                            <Text style={styles.mobilierTypeText}>
                                🪑 {product.typeMobilier || 'Meuble'} {product.categorieMobilier ? `• ${product.categorieMobilier}` : ''}
                            </Text>
                            {/* ✅ NOUVEAU: Affichage de la marque/fabricant */}
                            {product.marqueMobilier && (
                                <Text style={styles.mobilierMaterialText}>Marque: {product.marqueMobilier}</Text>
                            )}
                            {product.materiauMobilier && (
                                <Text style={styles.mobilierMaterialText}>Matériau: {product.materiauMobilier}</Text>
                            )}
                        </View>

                        {/* Caractéristiques */}
                        <View style={styles.mobilierCaracteristiques}>
                            {product.dimensionsMobilier && (
                                <View style={styles.mobilierCaracItem}>
                                    <SafeIcon name="ruler" size={14} color="#6B7280" />
                                    <Text style={styles.mobilierCaracText}>{product.dimensionsMobilier}</Text>
                                </View>
                            )}
                            {product.couleurMobilier && (
                                <View style={styles.mobilierCaracItem}>
                                    <SafeIcon name="droplet" size={14} color="#6B7280" />
                                    <Text style={styles.mobilierCaracText}>{product.couleurMobilier}</Text>
                                </View>
                            )}
                            {product.nombrePlaces && (
                                <View style={styles.mobilierCaracItem}>
                                    <SafeIcon name="users" size={14} color="#6B7280" />
                                    <Text style={styles.mobilierCaracText}>{product.nombrePlaces} places</Text>
                                </View>
                            )}
                            {product.poids && (
                                <View style={styles.mobilierCaracItem}>
                                    <SafeIcon name="weight" size={14} color="#6B7280" />
                                    <Text style={styles.mobilierCaracText}>{product.poids} kg</Text>
                                </View>
                            )}
                        </View>

                        {/* ✅ NOUVEAU: Caractéristiques spéciales */}
                        {product.caracteristiquesMobilier && product.caracteristiquesMobilier.length > 0 && (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                                {product.caracteristiquesMobilier.slice(0, 4).map((carac: string, idx: number) => (
                                    <View key={idx} style={styles.mobilierCaracBadge}>
                                        <Text style={styles.mobilierCaracBadgeText}>✓ {carac}</Text>
                                    </View>
                                ))}
                                {product.caracteristiquesMobilier.length > 4 && (
                                    <View style={styles.mobilierCaracBadge}>
                                        <Text style={styles.mobilierCaracBadgeText}>+{product.caracteristiquesMobilier.length - 4}</Text>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* Services */}
                        {(product.fraisLivraison || product.garantieMobilier || product.demontable || product.montageRequis) && (
                            <View style={styles.mobilierServices}>
                                {product.fraisLivraison && (
                                    <Text style={styles.mobilierServiceText}>🚚 Livraison: {product.fraisLivraison} XAF</Text>
                                )}
                                {product.montageRequis && (
                                    <View style={styles.mobilierServiceBadge}>
                                        <SafeIcon name="wrench" size={10} color="#6366F1" />
                                        <Text style={styles.mobilierServiceBadgeText}>Montage requis</Text>
                                    </View>
                                )}
                                {product.demontable && (
                                    <View style={styles.mobilierServiceBadge}>
                                        <SafeIcon name="tool" size={10} color="#10B981" />
                                        <Text style={styles.mobilierServiceBadgeText}>Démontable</Text>
                                    </View>
                                )}
                                {product.garantieMobilier && (
                                    <Text style={styles.mobilierServiceText}>✅ {product.garantieMobilier}</Text>
                                )}
                            </View>
                        )}
                    </View>
                );
            }

            case 'aliments': // ✅ FALLBACK: Redirection vers agroalimentaire
            case 'agroalimentaire': {
                const getStockLevel = (stock: number) => {
                    if (stock > 50) return { label: 'En stock', color: '#10B981' };
                    if (stock > 10) return { label: 'Stock limité', color: '#F59E0B' };
                    if (stock > 0) return { label: 'Dernières unités', color: '#EF4444' };
                    return { label: 'Rupture', color: '#DC2626' };
                };

                // ✅ NOUVEAU: Gestion des variantes
                const hasVariants = product.variants && product.variants.length > 0;
                const currentVariant = hasVariants ? product.variants[selectedVariantIndex] : null;
                const displayStock = currentVariant?.stockDisponible ?? product.stockDisponible;
                const displayPrice = currentVariant?.prix ?? product.prix;
                const displayQuantite = currentVariant?.quantite ?? product.poids;
                const displayUnite = currentVariant?.unite ?? product.uniteMesure;
                const displayConditionnement = currentVariant?.conditionnement ?? product.conditionnement;

                const stockInfo = displayStock !== undefined ? getStockLevel(displayStock) : null;
                const prixUnitaire = displayPrice && displayQuantite ? (parseFloat(displayPrice) / parseFloat(displayQuantite)).toFixed(0) : null;

                return (
                    <View style={{ gap: 12 }}>
                        {/* Badges principaux */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {product.bio && (
                                <View style={styles.alimentBioChip}>
                                    <SafeIcon name="leaf" size={12} color="#059669" />
                                    <Text style={styles.alimentBioText}>BIO</Text>
                                </View>
                            )}
                            {product.typeAliment && (
                                <View style={styles.alimentTypeChip}>
                                    <Text style={styles.alimentTypeText}>{product.typeAliment}</Text>
                                </View>
                            )}
                            {product.marqueAliment && (
                                <View style={styles.alimentMarqueChip}>
                                    <Text style={styles.alimentMarqueText}>{product.marqueAliment}</Text>
                                </View>
                            )}
                            {stockInfo && (
                                <View style={[styles.alimentStockChip, { borderColor: stockInfo.color }]}>
                                    <SafeIcon name="package" size={12} color={stockInfo.color} />
                                    <Text style={[styles.alimentStockText, { color: stockInfo.color }]}>{stockInfo.label}</Text>
                                </View>
                            )}
                        </View>

                        {/* Identité */}
                        <View style={styles.alimentIdentity}>
                            <Text style={styles.alimentCategoryText}>
                                🍽️ {product.categorieAliment || 'Aliment'} {product.origine ? `• ${product.origine}` : ''}
                            </Text>
                        </View>

                        {/* ✅ NOUVEAU: Sélection de variantes */}
                        {hasVariants && product.variants.length > 1 && (
                            <View style={styles.variantsSelector}>
                                <Text style={styles.variantsSelectorLabel}>Conditionnement :</Text>
                                <View style={styles.variantOptions}>
                                    {product.variants.map((variant, index) => (
                                        <TouchableOpacity
                                            key={variant.id || index}
                                            style={[
                                                styles.variantOption,
                                                selectedVariantIndex === index && styles.variantOptionActive
                                            ]}
                                            onPress={() => setSelectedVariantIndex(index)}
                                        >
                                            {/* ✅ OPTIMISATION 3: Image optimisée de la variante */}
                                            {variant.image && (
                                                <OptimizedImage
                                                    uri={variant.image}
                                                    style={styles.variantOptionImage}
                                                    showLoadingIndicator={false}
                                                />
                                            )}
                                            <Text style={[
                                                styles.variantOptionText,
                                                selectedVariantIndex === index && styles.variantOptionTextActive
                                            ]}>
                                                {variant.quantite}{variant.unite}
                                            </Text>
                                            <Text style={[
                                                styles.variantPriceText,
                                                selectedVariantIndex === index && styles.variantPriceTextActive
                                            ]}>
                                                {parseFloat(variant.prix).toLocaleString()} FCFA
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        )}

                        {/* Quantité et Prix */}
                        <View style={styles.alimentQuantite}>
                            {displayQuantite && displayUnite && (
                                <View style={styles.alimentQuantiteItem}>
                                    <SafeIcon name="weight" size={14} color="#10B981" />
                                    <Text style={styles.alimentQuantiteText}>{displayQuantite} {displayUnite}</Text>
                                </View>
                            )}
                            {prixUnitaire && displayUnite && (
                                <View style={styles.alimentQuantiteItem}>
                                    <SafeIcon name="trending-up" size={14} color="#10B981" />
                                    <Text style={styles.alimentQuantiteText}>{prixUnitaire} FCFA/{displayUnite}</Text>
                                </View>
                            )}
                            {displayConditionnement && (
                                <View style={styles.alimentQuantiteItem}>
                                    <SafeIcon name="box" size={14} color="#10B981" />
                                    <Text style={styles.alimentQuantiteText}>{displayConditionnement}</Text>
                                </View>
                            )}
                        </View>

                        {/* Labels et Certifications */}
                        {((product.labelQualite && product.labelQualite.length > 0) || (product.certifications && product.certifications.length > 0)) && (
                            <View style={styles.alimentCertifications}>
                                {product.labelQualite && product.labelQualite.slice(0, 3).map((label, idx) => (
                                    <View key={idx} style={styles.alimentLabelTag}>
                                        <SafeIcon name="award" size={10} color="#EAB308" />
                                        <Text style={styles.alimentLabelText}>{label}</Text>
                                    </View>
                                ))}
                                {product.certifications && product.certifications.slice(0, 3).map((cert, idx) => (
                                    <View key={idx} style={styles.alimentCertTag}>
                                        <SafeIcon name="check-circle" size={10} color="#059669" />
                                        <Text style={styles.alimentCertText}>{cert}</Text>
                                    </View>
                                ))}
                            </View>
                        )}

                        {/* Dates */}
                        {(product.dateProduction || product.dateExpiration) && (
                            <View style={styles.alimentDates}>
                                {product.dateProduction && (
                                    <Text style={styles.alimentDateText}>📅 Production: {product.dateProduction}</Text>
                                )}
                                {product.dateExpiration && (
                                    <Text style={[styles.alimentDateText, styles.alimentDateExpiration]}>
                                        ⚠️ Expiration: {product.dateExpiration}
                                    </Text>
                                )}
                            </View>
                        )}

                        {/* Allergènes */}
                        {(product.allergenes || (product.allergenesArray && product.allergenesArray.length > 0)) && (
                            <View style={styles.alimentAllergenes}>
                                <Text style={styles.alimentAllergenesText}>
                                    ⚠️ Allergènes: {product.allergenesArray ? product.allergenesArray.join(', ') : product.allergenes}
                                </Text>
                            </View>
                        )}
                    </View>
                );
            }

            case 'assurance': {
                // Badge type VIE / NON VIE
                const getTypeColor = (type: string) => {
                    if (type === 'VIE') return { bg: '#D1FAE5', text: '#065F46', border: '#10B981' };
                    if (type === 'NON VIE') return { bg: '#DBEAFE', text: '#1E40AF', border: '#3B82F6' };
                    return { bg: '#F3F4F6', text: '#374151', border: '#9CA3AF' };
                };

                const typeColor = product.typeAssuranceVie ? getTypeColor(product.typeAssuranceVie) : null;
                const hasOptions = product.optionsPrimes && product.optionsPrimes.length > 0;

                return (
                    <View style={{ gap: 12 }}>
                        {/* Badges : Type + Compagnie */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {product.typeAssuranceVie && typeColor && (
                                <View style={[styles.assuranceTypeBadge, { backgroundColor: typeColor.bg, borderColor: typeColor.border }]}>
                                    <SafeIcon name="shield" size={12} color={typeColor.text} />
                                    <Text style={[styles.assuranceTypeText, { color: typeColor.text }]}>
                                        {product.typeAssuranceVie}
                                    </Text>
                                </View>
                            )}
                            {product.compagnieAssurance && (
                                <View style={styles.assuranceCompagnieBadge}>
                                    <SafeIcon name="building" size={12} color="#14B8A6" />
                                    <Text style={styles.assuranceCompagnieText}>{product.compagnieAssurance}</Text>
                                </View>
                            )}
                        </View>

                        {/* Produit d'assurance */}
                        <View style={styles.assuranceProduit}>
                            <Text style={styles.assuranceProduitText}>
                                🛡️ {product.produitAssurance || product.name}
                            </Text>
                        </View>

                        {/* Prime et Durée */}
                        <View style={styles.assurancePrime}>
                            {product.primeAnnuelle && (
                                <View style={styles.assurancePrimeItem}>
                                    <SafeIcon name="dollar-sign" size={14} color="#14B8A6" />
                                    <Text style={styles.assurancePrimeText}>
                                        {hasOptions ? 'À partir de ' : ''}{parseFloat(product.primeAnnuelle).toLocaleString()} FCFA/an
                                    </Text>
                                </View>
                            )}
                            {product.dureeContrat && (
                                <View style={styles.assurancePrimeItem}>
                                    <SafeIcon name="calendar" size={14} color="#14B8A6" />
                                    <Text style={styles.assurancePrimeText}>{product.dureeContrat}</Text>
                                </View>
                            )}
                            {product.franchise && (
                                <View style={styles.assurancePrimeItem}>
                                    <SafeIcon name="info" size={14} color="#14B8A6" />
                                    <Text style={styles.assurancePrimeText}>Franchise: {parseFloat(product.franchise).toLocaleString()} FCFA</Text>
                                </View>
                            )}
                        </View>

                        {/* Couvertures */}
                        {product.couverturesArray && product.couverturesArray.length > 0 && (
                            <View style={styles.assuranceCouvertures}>
                                <Text style={styles.assuranceCouverturesTitle}>✓ Couvertures incluses :</Text>
                                <View style={styles.assuranceCouverturesList}>
                                    {product.couverturesArray.slice(0, 4).map((couv, idx) => (
                                        <View key={idx} style={styles.assuranceCouvertureTag}>
                                            <SafeIcon name="check" size={10} color="#059669" />
                                            <Text style={styles.assuranceCouvertureText}>{couv}</Text>
                                        </View>
                                    ))}
                                    {product.couverturesArray.length > 4 && (
                                        <Text style={styles.assuranceMoreText}>
                                            +{product.couverturesArray.length - 4} autres
                                        </Text>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* Options/Formules disponibles */}
                        {hasOptions && (
                            <View style={styles.assuranceOptions}>
                                <Text style={styles.assuranceOptionsTitle}>📋 {product.optionsPrimes.length} formule{product.optionsPrimes.length > 1 ? 's' : ''} disponible{product.optionsPrimes.length > 1 ? 's' : ''}</Text>
                                <View style={styles.assuranceOptionsGrid}>
                                    {product.optionsPrimes.slice(0, 3).map((opt, idx) => (
                                        <View key={idx} style={styles.assuranceOptionCard}>
                                            <Text style={styles.assuranceOptionName}>{opt.option}</Text>
                                            <Text style={styles.assuranceOptionPrime}>{parseFloat(opt.prime).toLocaleString()} FCFA</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}
                    </View>
                );
            }

            case 'vin_liqueur':
            case 'vin_et_liqueur':
            case 'vin':
            case 'liqueur':
            case 'champagne':
            case 'spiritueux': {
                // Couleurs par type de produit
                const getVinTypeColor = (type: string) => {
                    if (type?.includes('rouge')) return { bg: '#FEE2E2', text: '#991B1B', border: '#DC2626' };
                    if (type?.includes('blanc')) return { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B' };
                    if (type?.includes('rosé')) return { bg: '#FCE7F3', text: '#9F1239', border: '#EC4899' };
                    if (type?.includes('Champagne')) return { bg: '#FEF3C7', text: '#854D0E', border: '#EAB308' };
                    if (type?.includes('Whisky') || type?.includes('Cognac') || type?.includes('Rhum')) return { bg: '#FED7AA', text: '#9A3412', border: '#F97316' };
                    if (type?.includes('Vodka') || type?.includes('Gin')) return { bg: '#E0F2FE', text: '#075985', border: '#0EA5E9' };
                    return { bg: '#F3F4F6', text: '#374151', border: '#9CA3AF' };
                };

                const vinTypeColors = getVinTypeColor(product.typeProduitVin || '');

                return (
                    <View style={{ gap: 12 }}>
                        {/* Badge Type Produit */}
                        {product.typeProduitVin && (
                            <View style={[styles.livreBadge, { backgroundColor: vinTypeColors.bg, borderColor: vinTypeColors.border }]}>
                                <Text style={[styles.livreBadgeText, { color: vinTypeColors.text }]}>
                                    🍷 {product.typeProduitVin}
                                </Text>
                            </View>
                        )}

                        {/* Badge Marque */}
                        {product.marqueVin && (
                            <View style={styles.livreNiveauBadge}>
                                <Text style={styles.livreNiveauText}>🏷️ {product.marqueVin}</Text>
                            </View>
                        )}

                        {/* Format et Millésime */}
                        {(product.formatVin || product.millesimeVin) && (
                            <View style={styles.livreIdentity}>
                                <Text style={styles.livreIdentityText}>
                                    {product.formatVin || ''} {product.millesimeVin && product.formatVin && '•'} {product.millesimeVin || ''}
                                </Text>
                            </View>
                        )}

                        {/* Infos détaillées */}
                        <View style={styles.livreInfos}>
                            {product.regionVin && (
                                <View style={styles.livreInfoItem}>
                                    <Text style={styles.livreInfoLabel}>Région:</Text>
                                    <Text style={styles.livreInfoText}>{product.regionVin}</Text>
                                </View>
                            )}
                            {product.cepageVin && (
                                <View style={styles.livreInfoItem}>
                                    <Text style={styles.livreInfoLabel}>Cépage:</Text>
                                    <Text style={styles.livreInfoText}>{product.cepageVin}</Text>
                                </View>
                            )}
                            {product.degreAlcool && (
                                <View style={styles.livreInfoItem}>
                                    <Text style={styles.livreInfoLabel}>Degré:</Text>
                                    <Text style={styles.livreInfoText}>{product.degreAlcool}</Text>
                                </View>
                            )}
                            {product.paysOrigineVin && (
                                <View style={styles.livreInfoItem}>
                                    <Text style={styles.livreInfoLabel}>Origine:</Text>
                                    <Text style={styles.livreInfoText}>{product.paysOrigineVin}</Text>
                                </View>
                            )}
                            {product.certificationVin && (
                                <View style={styles.livreInfoItem}>
                                    <Text style={styles.livreInfoLabel}>Label:</Text>
                                    <Text style={styles.livreInfoText}>{product.certificationVin}</Text>
                                </View>
                            )}
                        </View>

                        {/* Type de commercialisation */}
                        {product.typeCommercialisation && (
                            <View style={styles.livreIsbnBadge}>
                                <Text style={styles.livreIsbnText}>💼 {product.typeCommercialisation}</Text>
                            </View>
                        )}

                        {/* Quantité minimale */}
                        {product.quantiteMinimale && (
                            <View style={styles.livreTypeBadge}>
                                <Text style={styles.livreTypeText}>📦 {product.quantiteMinimale}</Text>
                            </View>
                        )}

                        {/* État */}
                        {product.etatVin && (
                            <View style={styles.livreTypeBadge}>
                                <Text style={styles.livreTypeText}>✓ {product.etatVin}</Text>
                            </View>
                        )}
                    </View>
                );
            }

            case 'livres_fournitures': {
                // Couleurs par état
                const getEtatLivreColor = (etat: string) => {
                    if (etat?.includes('Neuf emballé')) return { bg: '#D1FAE5', text: '#065F46', border: '#10B981' };
                    if (etat?.includes('Neuf')) return { bg: '#DBEAFE', text: '#1E40AF', border: '#3B82F6' };
                    if (etat?.includes('Excellent')) return { bg: '#E0E7FF', text: '#3730A3', border: '#6366F1' };
                    if (etat?.includes('Bon')) return { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B' };
                    if (etat?.includes('Occasion') || etat?.includes('Usagé')) return { bg: '#FED7AA', text: '#9A3412', border: '#F97316' };
                    return { bg: '#F3F4F6', text: '#374151', border: '#9CA3AF' };
                };

                const etatColors = getEtatLivreColor(product.etatLivre || '');

                return (
                    <View style={{ gap: 12 }}>
                        {/* Badge État */}
                        {product.etatLivre && (
                            <View style={[styles.livreBadge, { backgroundColor: etatColors.bg, borderColor: etatColors.border }]}>
                                <Text style={[styles.livreBadgeText, { color: etatColors.text }]}>
                                    {product.etatLivre}
                                </Text>
                            </View>
                        )}

                        {/* Badge Niveau */}
                        {product.niveau && (
                            <View style={styles.livreNiveauBadge}>
                                <Text style={styles.livreNiveauText}>🎓 {product.niveau}</Text>
                            </View>
                        )}

                        {/* Identité : Catégorie + Matière */}
                        {(product.categorieLivre || product.matiereScolaire) && (
                            <View style={styles.livreIdentity}>
                                <Text style={styles.livreIdentityText}>
                                    {product.categorieLivre || 'Article'} {product.matiereScolaire && `• ${product.matiereScolaire}`}
                                </Text>
                            </View>
                        )}

                        {/* Infos détaillées */}
                        <View style={styles.livreInfos}>
                            {product.auteur && (
                                <View style={styles.livreInfoItem}>
                                    <Text style={styles.livreInfoLabel}>Auteur:</Text>
                                    <Text style={styles.livreInfoText}>{product.auteur}</Text>
                                </View>
                            )}
                            {product.editeur && (
                                <View style={styles.livreInfoItem}>
                                    <Text style={styles.livreInfoLabel}>Éditeur:</Text>
                                    <Text style={styles.livreInfoText}>{product.editeur}</Text>
                                </View>
                            )}
                            {product.anneeEdition && (
                                <View style={styles.livreInfoItem}>
                                    <Text style={styles.livreInfoLabel}>Année:</Text>
                                    <Text style={styles.livreInfoText}>{product.anneeEdition}</Text>
                                </View>
                            )}
                            {product.langue && (
                                <View style={styles.livreInfoItem}>
                                    <Text style={styles.livreInfoLabel}>Langue:</Text>
                                    <Text style={styles.livreInfoText}>{product.langue}</Text>
                                </View>
                            )}
                        </View>

                        {/* Programme MENESRES */}
                        {product.programmesMenesres && (
                            <View style={styles.livreProgrammeBadge}>
                                <Text style={styles.livreProgrammeText}>🎯 {product.programmesMenesres}</Text>
                            </View>
                        )}

                        {/* Format cahier */}
                        {product.formatsCahiers && (
                            <View style={styles.livreFormatBadge}>
                                <Text style={styles.livreFormatText}>📄 {product.formatsCahiers}</Text>
                            </View>
                        )}

                        {/* Couleur fournitures */}
                        {product.couleursFournitures && (
                            <View style={styles.livreCouleurBadge}>
                                <Text style={styles.livreCouleurText}>🎨 {product.couleursFournitures}</Text>
                            </View>
                        )}

                        {/* ISBN si disponible */}
                        {product.isbn && (
                            <View style={styles.livreIsbnBadge}>
                                <Text style={styles.livreIsbnText}>ISBN: {product.isbn}</Text>
                            </View>
                        )}

                        {/* Type calculatrice si disponible */}
                        {product.typeCalculatrice && (
                            <View style={styles.livreTypeBadge}>
                                <Text style={styles.livreTypeText}>🔢 {product.typeCalculatrice}</Text>
                            </View>
                        )}
                    </View>
                );
            }

            case 'evenementiel': {
                return (
                    <View style={{ gap: 12 }}>
                        {/* Badge Type événement */}
                        {product.typeEvenement && (
                            <View style={styles.evenementTypeBadge}>
                                <Text style={styles.evenementTypeText}>🎉 {product.typeEvenement}</Text>
                            </View>
                        )}

                        {/* Capacité */}
                        {product.capaciteEvenement && (
                            <View style={styles.evenementCapaciteBadge}>
                                <Text style={styles.evenementCapaciteText}>👥 {product.capaciteEvenement}</Text>
                            </View>
                        )}

                        {/* Durée */}
                        {product.dureeEvenement && (
                            <View style={styles.evenementDureeBadge}>
                                <Text style={styles.evenementDureeText}>⏱️ {product.dureeEvenement}</Text>
                            </View>
                        )}

                        {/* Services */}
                        {product.servicesEvenement && Array.isArray(product.servicesEvenement) && product.servicesEvenement.length > 0 && (
                            <View style={styles.evenementServices}>
                                <Text style={styles.evenementServicesTitle}>Services inclus:</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                    {product.servicesEvenement.slice(0, 5).map((service, idx) => (
                                        <View key={idx} style={styles.evenementServiceTag}>
                                            <Text style={styles.evenementServiceText}>✓ {service}</Text>
                                        </View>
                                    ))}
                                    {product.servicesEvenement.length > 5 && (
                                        <Text style={styles.evenementServicesPlus}>+{product.servicesEvenement.length - 5}</Text>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* Équipements */}
                        {product.equipementsEvenement && Array.isArray(product.equipementsEvenement) && product.equipementsEvenement.length > 0 && (
                            <View style={styles.evenementEquipements}>
                                <Text style={styles.evenementEquipementsText}>🎛️ Équipements: {product.equipementsEvenement.slice(0, 3).join(', ')}{product.equipementsEvenement.length > 3 ? '...' : ''}</Text>
                            </View>
                        )}
                    </View>
                );
            }

            case 'voyage_tourisme': {
                return (
                    <View style={{ gap: 12 }}>
                        {/* Type voyage */}
                        {product.typeVoyage && (
                            <View style={styles.voyageBadge}>
                                <Text style={styles.voyageText}>✈️ {product.typeVoyage}</Text>
                            </View>
                        )}

                        {/* Destination + Durée */}
                        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                            {product.destinationVoyage && (
                                <View style={styles.voyageDestBadge}>
                                    <Text style={styles.voyageDestText}>📍 {product.destinationVoyage}</Text>
                                </View>
                            )}
                            {product.dureeVoyage && (
                                <View style={styles.voyageDureeBadge}>
                                    <Text style={styles.voyageDureeText}>🕐 {product.dureeVoyage}</Text>
                                </View>
                            )}
                        </View>

                        {/* Services */}
                        {product.servicesVoyage && Array.isArray(product.servicesVoyage) && product.servicesVoyage.length > 0 && (
                            <View style={{ gap: 4 }}>
                                <Text style={{ fontSize: 11, fontWeight: '600', color: '#374151' }}>Inclus:</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                    {product.servicesVoyage.slice(0, 4).map((service, idx) => (
                                        <Text key={idx} style={styles.voyageServiceText}>✓ {service}</Text>
                                    ))}
                                </View>
                            </View>
                        )}

                        {/* Hébergement */}
                        {product.hebergementVoyage && (
                            <Text style={styles.voyageHebergement}>🏨 {product.hebergementVoyage}</Text>
                        )}
                    </View>
                );
            }

            case 'demenagement': {
                return (
                    <View style={{ gap: 12 }}>
                        {/* Type de déménagement */}
                        {product.typeDemenagement && (
                            <View style={styles.demenagementBadge}>
                                <Text style={styles.demenagementText}>📦 {product.typeDemenagement}</Text>
                            </View>
                        )}

                        {/* Volume */}
                        {product.volumeDemenagement && (
                            <View style={styles.demenagementVolumeBadge}>
                                <Text style={styles.demenagementVolumeText}>📏 {product.volumeDemenagement}</Text>
                            </View>
                        )}

                        {/* Trajet */}
                        {product.trajetDemenagement && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <Text style={{ fontSize: 12, fontWeight: '600', color: '#F97316' }}>📍</Text>
                                <Text style={{ fontSize: 12, fontWeight: '600', color: '#374151' }}>{product.trajetDemenagement}</Text>
                            </View>
                        )}

                        {/* Ville départ → Ville arrivée (si pas de trajet) */}
                        {!product.trajetDemenagement && product.villeDepartDemenagement && product.villeArriveeDemenagement && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <Text style={{ fontSize: 12, fontWeight: '600', color: '#F97316' }}>📍</Text>
                                <Text style={{ fontSize: 12, fontWeight: '500', color: '#374151' }}>
                                    {product.villeDepartDemenagement} → {product.villeArriveeDemenagement}
                                </Text>
                            </View>
                        )}

                        {/* Distance */}
                        {product.distanceDemenagement && (
                            <Text style={{ fontSize: 11, fontWeight: '500', color: '#6B7280' }}>
                                🛣️ {product.distanceDemenagement}
                            </Text>
                        )}

                        {/* Véhicule et déménageurs */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                            {product.typeVehiculeDemenagement && (
                                <Text style={styles.demenagementVehicule}>🚛 {product.typeVehiculeDemenagement}</Text>
                            )}
                            {product.nbDemenageurs && (
                                <Text style={styles.demenagementVehicule}>👥 {product.nbDemenageurs}</Text>
                            )}
                        </View>

                        {/* Compagnie */}
                        {product.compagnieDemenagement && (
                            <Text style={{ fontSize: 11, fontWeight: '600', color: '#059669' }}>
                                🏢 {product.compagnieDemenagement}
                            </Text>
                        )}

                        {/* Services */}
                        {product.servicesDemenagement && Array.isArray(product.servicesDemenagement) && product.servicesDemenagement.length > 0 && (
                            <View style={{ gap: 4 }}>
                                <Text style={{ fontSize: 11, fontWeight: '600', color: '#374151' }}>Services inclus:</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                    {product.servicesDemenagement.slice(0, 5).map((service, idx) => (
                                        <Text key={idx} style={styles.demenagementServiceText}>✓ {service}</Text>
                                    ))}
                                    {product.servicesDemenagement.length > 5 && (
                                        <Text style={{ fontSize: 10, fontWeight: '500', color: '#6B7280' }}>
                                            +{product.servicesDemenagement.length - 5} autres
                                        </Text>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* Durée et disponibilité */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                            {product.dureeDemenagement && (
                                <Text style={{ fontSize: 11, fontWeight: '500', color: '#6B7280' }}>
                                    ⏱️ {product.dureeDemenagement}
                                </Text>
                            )}
                            {product.disponibiliteDemenagement && (
                                <Text style={{ fontSize: 11, fontWeight: '500', color: '#059669' }}>
                                    ✓ {product.disponibiliteDemenagement}
                                </Text>
                            )}
                        </View>

                        {/* Assurance */}
                        {product.typeAssuranceDemenagement && (
                            <Text style={{ fontSize: 11, fontWeight: '600', color: '#3B82F6' }}>
                                🛡️ {product.typeAssuranceDemenagement}
                            </Text>
                        )}
                    </View>
                );
            }

            case 'plomberie':
            case 'plombier': {
                return (
                    <View style={{ gap: 12 }}>
                        {/* ✅ AMÉLIORÉ: Images de réalisations en miniature */}
                        {images && images.length > 0 && images.length <= 4 && (
                            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                                {images.slice(0, 3).map((img: string, idx: number) => (
                                    <Image
                                        key={idx}
                                        source={{ uri: img }}
                                        style={{ width: 60, height: 60, borderRadius: 8 }}
                                        resizeMode="cover"
                                    />
                                ))}
                            </View>
                        )}

                        {/* ✅ AMÉLIORÉ: Badges principaux en ligne */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {/* Type de prestation */}
                            {product.typePrestation && (
                                <View style={styles.plomberieBadge}>
                                    <Text style={styles.plomberieText}>🔧 {product.typePrestation}</Text>
                                </View>
                            )}

                            {/* Badge Urgence 24/7 */}
                            {(product.urgence || product.urgence24h || product.disponibilitePrestation?.includes('Urgence') || product.disponibilitePrestation?.includes('express')) && (
                                <View style={[styles.plomberieUrgenceBadge, { backgroundColor: '#FEE2E2', borderColor: '#EF4444', borderWidth: 1 }]}>
                                    <SafeIcon name="zap" size={14} color="#DC2626" />
                                    <Text style={[styles.plomberieUrgenceText, { color: '#DC2626' }]}>🚨 {product.disponibilitePrestation?.includes('express') ? 'Express 1h' : 'Urgence 24/7'}</Text>
                                </View>
                            )}

                            {/* ✅ NOUVEAU: Badge Certifié */}
                            {(product.certificationsPlombier || product.certifie || product.certification) && (
                                <View style={{
                                    backgroundColor: '#FEF3C7',
                                    paddingHorizontal: 10,
                                    paddingVertical: 6,
                                    borderRadius: 6,
                                    borderWidth: 1,
                                    borderColor: '#F59E0B',
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 4
                                }}>
                                    <SafeIcon name="award" size={12} color="#D97706" />
                                    <Text style={{ fontSize: 10, fontWeight: '600', color: '#92400E' }}>Certifié</Text>
                                </View>
                            )}

                            {/* ✅ NOUVEAU: Badge Ancienneté */}
                            {product.experiencePlombier && (
                                <View style={{
                                    backgroundColor: '#E0E7FF',
                                    paddingHorizontal: 10,
                                    paddingVertical: 6,
                                    borderRadius: 6,
                                    borderWidth: 1,
                                    borderColor: '#6366F1'
                                }}>
                                    <Text style={{ fontSize: 10, fontWeight: '600', color: '#3730A3' }}>
                                        ⭐ {product.experiencePlombier}
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Spécialités (multiselect) */}
                        {product.specialitesPlomberie && Array.isArray(product.specialitesPlomberie) && product.specialitesPlomberie.length > 0 && (
                            <View style={{ gap: 4 }}>
                                <Text style={{ fontSize: 11, fontWeight: '600', color: '#374151' }}>🎯 Spécialités:</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                                    {product.specialitesPlomberie.slice(0, 4).map((spec: string, idx: number) => (
                                        <View key={idx} style={{
                                            backgroundColor: '#DBEAFE',
                                            paddingHorizontal: 8,
                                            paddingVertical: 4,
                                            borderRadius: 6,
                                            borderWidth: 1,
                                            borderColor: '#3B82F6'
                                        }}>
                                            <Text style={{ fontSize: 10, fontWeight: '500', color: '#1E40AF' }}>
                                                {spec}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}

                        {/* Équipements concernés */}
                        {product.equipementsPlomberie && Array.isArray(product.equipementsPlomberie) && product.equipementsPlomberie.length > 0 && (
                            <Text style={{ fontSize: 11, color: '#6B7280' }}>
                                🛠️ Équipements: {product.equipementsPlomberie.slice(0, 3).join(', ')}
                                {product.equipementsPlomberie.length > 3 && ` +${product.equipementsPlomberie.length - 3}`}
                            </Text>
                        )}

                        {/* ✅ AMÉLIORÉ: Disponibilité avec plus de détails */}
                        {product.disponibilitePrestation && !product.disponibilitePrestation?.includes('Urgence') && !product.disponibilitePrestation?.includes('express') && (
                            <View style={{
                                backgroundColor: '#FEF3C7',
                                paddingHorizontal: 10,
                                paddingVertical: 6,
                                borderRadius: 6,
                                borderWidth: 1,
                                borderColor: '#F59E0B'
                            }}>
                                <Text style={{ fontSize: 11, fontWeight: '500', color: '#92400E' }}>
                                    ⏰ {product.disponibilitePrestation}
                                </Text>
                            </View>
                        )}

                        {/* ✅ AMÉLIORÉ: Badges d'avantages en ligne */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {/* Garantie travaux */}
                            {product.garantieTravaux && (
                                <View style={{
                                    backgroundColor: '#D1FAE5',
                                    paddingHorizontal: 10,
                                    paddingVertical: 6,
                                    borderRadius: 6,
                                    borderWidth: 1,
                                    borderColor: '#10B981'
                                }}>
                                    <Text style={{ fontSize: 10, fontWeight: '500', color: '#065F46' }}>
                                        ✓ Garantie {product.garantieTravaux}
                                    </Text>
                                </View>
                            )}

                            {/* Devis gratuit */}
                            {product.devisGratuit && (
                                <View style={{
                                    backgroundColor: '#EFF6FF',
                                    paddingHorizontal: 10,
                                    paddingVertical: 6,
                                    borderRadius: 6,
                                    borderWidth: 1,
                                    borderColor: '#3B82F6'
                                }}>
                                    <Text style={{ fontSize: 10, fontWeight: '500', color: '#1E40AF' }}>
                                        📋 Devis gratuit
                                    </Text>
                                </View>
                            )}

                            {/* ✅ NOUVEAU: Nombre d'avis */}
                            {product.nombreAvis && (
                                <View style={{
                                    backgroundColor: '#F3F4F6',
                                    paddingHorizontal: 10,
                                    paddingVertical: 6,
                                    borderRadius: 6,
                                    borderWidth: 1,
                                    borderColor: '#9CA3AF'
                                }}>
                                    <Text style={{ fontSize: 10, fontWeight: '500', color: '#374151' }}>
                                        💬 {product.nombreAvis} avis
                                    </Text>
                                </View>
                            )}

                            {/* ✅ NOUVEAU: Note moyenne */}
                            {product.note && (
                                <View style={{
                                    backgroundColor: '#FEF3C7',
                                    paddingHorizontal: 10,
                                    paddingVertical: 6,
                                    borderRadius: 6,
                                    borderWidth: 1,
                                    borderColor: '#FCD34D'
                                }}>
                                    <Text style={{ fontSize: 10, fontWeight: '500', color: '#92400E' }}>
                                        ⭐ {product.note}/5
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Zones d'intervention */}
                        {(product.zones_intervention || product.zonesIntervention) && Array.isArray(product.zones_intervention || product.zonesIntervention) && (product.zones_intervention || product.zonesIntervention).length > 0 && (
                            <View style={{ gap: 4 }}>
                                <Text style={{ fontSize: 11, fontWeight: '600', color: '#374151' }}>📍 Zones d'intervention:</Text>
                                <Text style={{ fontSize: 10, color: '#6B7280' }}>
                                    {(product.zones_intervention || product.zonesIntervention).slice(0, 3).join(', ')}
                                    {(product.zones_intervention || product.zonesIntervention).length > 3 && ` +${(product.zones_intervention || product.zonesIntervention).length - 3} autres`}
                                </Text>
                            </View>
                        )}
                    </View>
                );
            }

            // ════════════════════════════════════════════════════════════
            // 🌳 JARDINAGE & PAYSAGISME - AFRIQUE FRANCOPHONE
            // ════════════════════════════════════════════════════════════
            case 'jardinage_paysagisme':
            case 'jardinage': {
                return (
                    <View style={{ gap: 12 }}>
                        {/* Type de service (priorité) */}
                        {product.typeService && (
                            <View style={[styles.plomberieBadge, { backgroundColor: '#D1FAE5', borderColor: '#059669' }]}>
                                <Text style={[styles.plomberieText, { color: '#059669' }]}>
                                    {product.typeService.length > 50 ? product.typeService.substring(0, 50) + '...' : product.typeService}
                                </Text>
                            </View>
                        )}

                        {/* Plantes africaines (si présentes) */}
                        {product.plantesAfricaines && Array.isArray(product.plantesAfricaines) && product.plantesAfricaines.length > 0 && (
                            <View style={{ gap: 4 }}>
                                <Text style={{ fontSize: 11, fontWeight: '600', color: '#374151' }}>🌿 Plantes:</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                    {product.plantesAfricaines.slice(0, 3).map((plante: string, idx: number) => (
                                        <Text key={idx} style={[styles.nettoyageServiceText, { backgroundColor: '#D1FAE5', color: '#059669' }]}>
                                            {plante.length > 25 ? plante.substring(0, 25) + '...' : plante}
                                        </Text>
                                    ))}
                                </View>
                            </View>
                        )}

                        {/* Fréquence + Surface */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                            {product.frequenceEntretien && (
                                <View style={[styles.nettoyageFrequenceBadge, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }]}>
                                    <Text style={[styles.nettoyageFrequenceText, { color: '#D97706' }]}>
                                        {product.frequenceEntretien.length > 30 ? product.frequenceEntretien.substring(0, 30) + '...' : product.frequenceEntretien}
                                    </Text>
                                </View>
                            )}
                            {product.surfaceTerrain && (
                                <View style={[styles.nettoyageFrequenceBadge, { backgroundColor: '#E0E7FF', borderColor: '#6366F1' }]}>
                                    <Text style={[styles.nettoyageFrequenceText, { color: '#4F46E5' }]}>
                                        {product.surfaceTerrain.length > 30 ? product.surfaceTerrain.substring(0, 30) + '...' : product.surfaceTerrain}
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Matériel disponible */}
                        {product.materielJardinage && Array.isArray(product.materielJardinage) && product.materielJardinage.length > 0 && (
                            <View style={{ gap: 4 }}>
                                <Text style={{ fontSize: 11, fontWeight: '600', color: '#374151' }}>🛠️ Matériel:</Text>
                                <Text style={{ fontSize: 11, color: '#6B7280' }}>
                                    {product.materielJardinage.slice(0, 3).join(' • ')}
                                    {product.materielJardinage.length > 3 && ` +${product.materielJardinage.length - 3}`}
                                </Text>
                            </View>
                        )}

                        {/* Prestations incluses (badges verts) */}
                        {product.prestationsIncluses && Array.isArray(product.prestationsIncluses) && product.prestationsIncluses.length > 0 && (
                            <View style={{ gap: 4 }}>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                                    {product.prestationsIncluses.slice(0, 3).map((prestation: string, idx: number) => (
                                        <Text key={idx} style={[styles.plomberieGarantie, { fontSize: 10, color: '#059669' }]}>
                                            {prestation}
                                        </Text>
                                    ))}
                                </View>
                            </View>
                        )}

                        {/* Niveau d'expérience */}
                        {product.niveauExperience && (
                            <Text style={[styles.plomberieGarantie, { color: '#047857' }]}>
                                {product.niveauExperience}
                            </Text>
                        )}

                        {/* Zones d'intervention (multilignes si nombreuses) */}
                        {product.zonesIntervention && Array.isArray(product.zonesIntervention) && product.zonesIntervention.length > 0 && (
                            <View style={{ gap: 4 }}>
                                <Text style={{ fontSize: 11, fontWeight: '600', color: '#374151' }}>📍 Zones:</Text>
                                <Text style={{ fontSize: 11, color: '#6B7280' }}>
                                    {product.zonesIntervention.slice(0, 5).join(', ')}
                                    {product.zonesIntervention.length > 5 && ` +${product.zonesIntervention.length - 5} autres`}
                                </Text>
                            </View>
                        )}
                    </View>
                );
            }

            // ════════════════════════════════════════════════════════════
            // 🧹 NETTOYAGE & ENTRETIEN - ULTRA-ENRICHI AFRIQUE
            // ════════════════════════════════════════════════════════════
            case 'nettoyage_entretien': {
                return (
                    <View style={{ gap: 10 }}>
                        {/* Type de service (priorité absolue) */}
                        {product.typeServiceNettoyage && (
                            <View style={[styles.nettoyageBadge, { backgroundColor: '#D1FAE5', borderColor: '#10B981', borderWidth: 1, borderRadius: 8 }]}>
                                <Text style={[styles.nettoyageText, { color: '#047857', fontSize: 12, fontWeight: '600' }]}>
                                    🧹 {product.typeServiceNettoyage}
                                </Text>
                            </View>
                        )}

                        {/* Grille de badges (Fréquence + Modalité + Horaires) */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {product.frequenceService && (
                                <View style={[styles.nettoyageFrequenceBadge, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B', borderWidth: 1 }]}>
                                    <SafeIcon name="calendar" size={11} color="#D97706" />
                                    <Text style={[styles.nettoyageFrequenceText, { color: '#D97706', fontSize: 10 }]}>
                                        {product.frequenceService.length > 25 ? product.frequenceService.substring(0, 25) + '...' : product.frequenceService}
                                    </Text>
                                </View>
                            )}
                            {product.modaliteEmploi && (
                                <View style={[styles.nettoyageFrequenceBadge, { backgroundColor: '#E0E7FF', borderColor: '#6366F1', borderWidth: 1 }]}>
                                    <SafeIcon name="home" size={11} color="#4F46E5" />
                                    <Text style={[styles.nettoyageFrequenceText, { color: '#4F46E5', fontSize: 10 }]}>
                                        {product.modaliteEmploi.length > 20 ? product.modaliteEmploi.substring(0, 20) + '...' : product.modaliteEmploi}
                                    </Text>
                                </View>
                            )}
                            {product.horairesService && (
                                <View style={[styles.nettoyageFrequenceBadge, { backgroundColor: '#FCE7F3', borderColor: '#EC4899', borderWidth: 1 }]}>
                                    <SafeIcon name="clock" size={11} color="#BE185D" />
                                    <Text style={[styles.nettoyageFrequenceText, { color: '#BE185D', fontSize: 10 }]}>
                                        {product.horairesService.length > 20 ? product.horairesService.substring(0, 20) + '...' : product.horairesService}
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Garde d'enfants (si nounou/baby-sitter) */}
                        {(product.nombreEnfants || product.ageEnfants) && (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                {product.nombreEnfants && (
                                    <View style={[styles.nettoyageFrequenceBadge, { backgroundColor: '#FED7AA', borderColor: '#F59E0B' }]}>
                                        <Text style={{ fontSize: 10, color: '#C2410C' }}>👶 {product.nombreEnfants}</Text>
                                    </View>
                                )}
                                {product.ageEnfants && (
                                    <View style={[styles.nettoyageFrequenceBadge, { backgroundColor: '#FED7AA', borderColor: '#F59E0B' }]}>
                                        <Text style={{ fontSize: 10, color: '#C2410C' }}>🍼 {product.ageEnfants}</Text>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* Tâches spécifiques (max 5 affichées) */}
                        {product.tachesSpecifiques && Array.isArray(product.tachesSpecifiques) && product.tachesSpecifiques.length > 0 && (
                            <View style={{ gap: 4 }}>
                                <Text style={{ fontSize: 11, fontWeight: '600', color: '#374151' }}>Tâches:</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                                    {product.tachesSpecifiques.slice(0, 5).map((tache, idx) => (
                                        <Text key={idx} style={[styles.nettoyageServiceText, { fontSize: 9, backgroundColor: '#DBEAFE', color: '#1E40AF' }]}>
                                            ✓ {tache.length > 25 ? tache.substring(0, 25) + '...' : tache}
                                        </Text>
                                    ))}
                                    {product.tachesSpecifiques.length > 5 && (
                                        <Text style={[styles.nettoyageServiceText, { fontSize: 9, backgroundColor: '#E5E7EB', color: '#6B7280' }]}>
                                            +{product.tachesSpecifiques.length - 5} autres
                                        </Text>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* Expérience + Langues (côte à côte) */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {product.experienceNettoyage && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                    <SafeIcon name="briefcase" size={12} color="#047857" />
                                    <Text style={{ fontSize: 10, color: '#047857', fontWeight: '500' }}>
                                        {product.experienceNettoyage}
                                    </Text>
                                </View>
                            )}
                            {product.languesParlees && Array.isArray(product.languesParlees) && product.languesParlees.length > 0 && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                    <SafeIcon name="globe" size={12} color="#7C3AED" />
                                    <Text style={{ fontSize: 10, color: '#7C3AED', fontWeight: '500' }}>
                                        {product.languesParlees.slice(0, 2).join(', ')}
                                        {product.languesParlees.length > 2 && ` +${product.languesParlees.length - 2}`}
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Certifications (badges verts) */}
                        {product.certificationNettoyage && Array.isArray(product.certificationNettoyage) && product.certificationNettoyage.length > 0 && (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                                {product.certificationNettoyage.slice(0, 2).map((certif, idx) => (
                                    <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#D1FAE5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                                        <SafeIcon name="award" size={10} color="#059669" />
                                        <Text style={{ fontSize: 9, color: '#047857' }}>
                                            {certif.length > 20 ? certif.substring(0, 20) + '...' : certif}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        )}

                        {/* Salaire souhaité (badge bleu) */}
                        {product.salaireSouhaite && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <SafeIcon name="dollar-sign" size={12} color="#2563EB" />
                                <Text style={{ fontSize: 11, color: '#2563EB', fontWeight: '600' }}>
                                    {product.salaireSouhaite}
                                </Text>
                            </View>
                        )}

                        {/* Surface + Équipements (si renseignés) */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {product.surfaceEntretien && (
                                <Text style={{ fontSize: 10, color: '#6B7280' }}>
                                    📏 {product.surfaceEntretien}
                                </Text>
                            )}
                            {product.equipementsFournis && Array.isArray(product.equipementsFournis) && product.equipementsFournis.length > 0 && (
                                <Text style={{ fontSize: 10, color: '#6B7280' }}>
                                    🛠️ {product.equipementsFournis.slice(0, 2).join(', ')}
                                    {product.equipementsFournis.length > 2 && ` +${product.equipementsFournis.length - 2}`}
                                </Text>
                            )}
                        </View>

                        {/* Disponibilité + Type contrat */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {product.disponibiliteImmediateNettoyage && (
                                <View style={[styles.nettoyageFrequenceBadge, { backgroundColor: '#D1FAE5', borderColor: '#10B981' }]}>
                                    <SafeIcon name="check-circle" size={11} color="#059669" />
                                    <Text style={{ fontSize: 10, color: '#047857' }}>
                                        {product.disponibiliteImmediateNettoyage}
                                    </Text>
                                </View>
                            )}
                            {product.typeContratNettoyage && (
                                <Text style={{ fontSize: 10, color: '#6B7280' }}>
                                    📄 {product.typeContratNettoyage.length > 25 ? product.typeContratNettoyage.substring(0, 25) + '...' : product.typeContratNettoyage}
                                </Text>
                            )}
                        </View>
                    </View>
                );
            }

            // ✅ Compatibilité legacy 'nettoyage' (ancienne version)
            case 'nettoyage': {
                return (
                    <View style={{ gap: 12 }}>
                        {product.typeNettoyage && (
                            <View style={styles.nettoyageBadge}>
                                <Text style={styles.nettoyageText}>🧹 {product.typeNettoyage}</Text>
                            </View>
                        )}
                        {product.frequenceNettoyage && (
                            <View style={styles.nettoyageFrequenceBadge}>
                                <Text style={styles.nettoyageFrequenceText}>📅 {product.frequenceNettoyage}</Text>
                            </View>
                        )}
                        {product.servicesNettoyage && Array.isArray(product.servicesNettoyage) && product.servicesNettoyage.length > 0 && (
                            <View style={{ gap: 4 }}>
                                <Text style={{ fontSize: 11, fontWeight: '600', color: '#374151' }}>Services:</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                    {product.servicesNettoyage.slice(0, 4).map((service, idx) => (
                                        <Text key={idx} style={styles.nettoyageServiceText}>✓ {service}</Text>
                                    ))}
                                </View>
                            </View>
                        )}
                        {product.produitsBio && (
                            <View style={styles.nettoyageBioBadge}>
                                <Text style={styles.nettoyageBioText}>🌱 Produits bio</Text>
                            </View>
                        )}
                    </View>
                );
            }

            case 'assurance': {
                return (
                    <View style={{ gap: 12 }}>
                        {product.typeAssurance && (
                            <View style={styles.assuranceBadge}>
                                <Text style={styles.assuranceText}>🛡️ {product.typeAssurance}</Text>
                            </View>
                        )}
                        {product.compagnieAssurance && (
                            <View style={styles.assuranceCompagnieBadge}>
                                <Text style={styles.assuranceCompagnieText}>{product.compagnieAssurance}</Text>
                            </View>
                        )}
                        {product.typeCouverture && (
                            <Text style={styles.assuranceCouverture}>📋 {product.typeCouverture}</Text>
                        )}
                        {product.dureeContrat && (
                            <Text style={styles.assuranceDuree}>⏱️ Contrat {product.dureeContrat}</Text>
                        )}
                        {product.franchiseAssurance && (
                            <Text style={styles.assuranceFranchise}>Franchise: {product.franchiseAssurance}</Text>
                        )}
                    </View>
                );
            }

            case 'quincaillerie': {
                const getEtatColor = (etat: string) => {
                    if (etat?.includes('Neuf')) return { bg: '#D1FAE5', text: '#065F46', border: '#10B981' };
                    if (etat?.includes('Excellent')) return { bg: '#E0E7FF', text: '#3730A3', border: '#6366F1' };
                    if (etat?.includes('Bon')) return { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B' };
                    if (etat?.includes('Occasion') || etat?.includes('réparer')) return { bg: '#FEE2E2', text: '#991B1B', border: '#EF4444' };
                    return { bg: '#F3F4F6', text: '#374151', border: '#9CA3AF' };
                };

                const etatColor = product.etatQuincaillerie ? getEtatColor(product.etatQuincaillerie) : null;

                return (
                    <View style={{ gap: 12 }}>
                        {/* Badges principaux */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {product.categorieQuincaillerie && (
                                <View style={[styles.detailChip, { backgroundColor: '#E0E7FF', borderColor: '#6366F1' }]}>
                                    <SafeIcon name="layers" size={14} color="#6366F1" />
                                    <Text style={[styles.detailText, { color: '#3730A3' }]}>{product.categorieQuincaillerie}</Text>
                                </View>
                            )}
                            {product.marqueQuincaillerie && (
                                <View style={[styles.detailChip, { backgroundColor: '#F3F4F6', borderColor: '#D1D5DB' }]}>
                                    <SafeIcon name="tag" size={14} color="#6B7280" />
                                    <Text style={styles.detailText}>{product.marqueQuincaillerie}</Text>
                                </View>
                            )}
                            {product.etatQuincaillerie && etatColor && (
                                <View style={[styles.detailChip, { backgroundColor: etatColor.bg, borderColor: etatColor.border }]}>
                                    <Text style={[styles.detailText, { color: etatColor.text }]}>📦 {product.etatQuincaillerie}</Text>
                                </View>
                            )}
                        </View>

                        {/* Caractéristiques techniques */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {product.materiauQuincaillerie && (
                                <View style={styles.detailChip}>
                                    <SafeIcon name="brick" size={14} color="#6B7280" />
                                    <Text style={styles.detailText}>{product.materiauQuincaillerie}</Text>
                                </View>
                            )}
                            {product.dimensionQuincaillerie && (
                                <View style={styles.detailChip}>
                                    <SafeIcon name="ruler" size={14} color="#6B7280" />
                                    <Text style={styles.detailText}>{product.dimensionQuincaillerie}</Text>
                                </View>
                            )}
                            {product.finitionQuincaillerie && (
                                <View style={styles.detailChip}>
                                    <SafeIcon name="palette" size={14} color="#6B7280" />
                                    <Text style={styles.detailText}>{product.finitionQuincaillerie}</Text>
                                </View>
                            )}
                        </View>

                        {/* Information de vente */}
                        {(product.uniteVente || product.stockDisponible) && (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                {product.uniteVente && (
                                    <View style={styles.detailChip}>
                                        <SafeIcon name="package" size={14} color="#6B7280" />
                                        <Text style={styles.detailText}>Unité: {product.uniteVente}</Text>
                                    </View>
                                )}
                                {product.stockDisponible && product.stockDisponible > 0 && (
                                    <View style={[styles.detailChip, { backgroundColor: '#D1FAE5', borderColor: '#10B981' }]}>
                                        <SafeIcon name="check-circle" size={14} color="#10B981" />
                                        <Text style={[styles.detailText, { color: '#065F46' }]}>Stock: {product.stockDisponible}</Text>
                                    </View>
                                )}
                                {product.stockDisponible === 0 && (
                                    <View style={[styles.detailChip, { backgroundColor: '#FEE2E2', borderColor: '#EF4444' }]}>
                                        <SafeIcon name="alert-circle" size={14} color="#EF4444" />
                                        <Text style={[styles.detailText, { color: '#991B1B' }]}>Rupture de stock</Text>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* Usage et certification */}
                        {(product.usageQuincaillerie || product.normeQuincaillerie) && (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                {product.usageQuincaillerie && (
                                    <View style={styles.detailChip}>
                                        <SafeIcon name="target" size={14} color="#6B7280" />
                                        <Text style={styles.detailText}>{product.usageQuincaillerie}</Text>
                                    </View>
                                )}
                                {product.normeQuincaillerie && (
                                    <View style={[styles.detailChip, { backgroundColor: '#EFF6FF', borderColor: '#3B82F6' }]}>
                                        <SafeIcon name="award" size={14} color="#3B82F6" />
                                        <Text style={[styles.detailText, { color: '#1E40AF' }]}>{product.normeQuincaillerie}</Text>
                                    </View>
                                )}
                            </View>
                        )}
                    </View>
                );
            }

            case 'electricien': {
                // ✅ NOUVEAU: Calculer indicateur charge de travail
                const chargeTravail = product.urgencesEnCours || 0;
                const getChargeColor = () => {
                    if (chargeTravail === 0) return { bg: '#ECFDF5', text: '#047857', icon: 'check-circle' };
                    if (chargeTravail <= 2) return { bg: '#FEF3C7', text: '#92400E', icon: 'alert-circle' };
                    return { bg: '#FEE2E2', text: '#991B1B', icon: 'x-circle' };
                };
                const chargeStyle = getChargeColor();

                return (
                    <View style={{ gap: 12 }}>
                        {/* ✅ NOUVEAU: Badge Promotion temporaire */}
                        {product.promotionActive && product.promotionEndDate && new Date(product.promotionEndDate) > new Date() && (
                            <View style={[styles.electricienPromotionBadge]}>
                                <SafeIcon name="tag" size={14} color="#DC2626" />
                                <Text style={styles.electricienPromotionText}>
                                    🔥 PROMO {product.promotionPourcentage ? `-${product.promotionPourcentage}%` : 'ACTIVE'}
                                </Text>
                            </View>
                        )}

                        {/* Type de prestation */}
                        {product.typeElectricien && (
                            <View style={styles.electricienBadge}>
                                <SafeIcon name="zap" size={14} color="#F59E0B" />
                                <Text style={styles.electricienText}>⚡ {product.typeElectricien}</Text>
                            </View>
                        )}

                        {/* Spécialités */}
                        {product.specialitesElectricien && product.specialitesElectricien.length > 0 && (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                {product.specialitesElectricien.slice(0, 3).map((specialite, index) => (
                                    <View key={index} style={styles.electricienSpecialiteBadge}>
                                        <Text style={styles.electricienSpecialiteText}>{specialite}</Text>
                                    </View>
                                ))}
                                {product.specialitesElectricien.length > 3 && (
                                    <View style={styles.electricienSpecialiteBadge}>
                                        <Text style={styles.electricienSpecialiteText}>+{product.specialitesElectricien.length - 3}</Text>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* Disponibilité et urgence */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {product.urgence24hElec && (
                                <View style={styles.electricienUrgenceBadge}>
                                    <SafeIcon name="zap" size={12} color="#DC2626" />
                                    <Text style={styles.electricienUrgenceText}>Urgence 24h/24</Text>
                                    {/* ✅ NOUVEAU: Indicateur charge de travail */}
                                    {chargeTravail > 0 && (
                                        <View style={[styles.electricienChargeBadge, { backgroundColor: chargeStyle.bg }]}>
                                            <SafeIcon name={chargeStyle.icon} size={10} color={chargeStyle.text} />
                                            <Text style={[styles.electricienChargeText, { color: chargeStyle.text }]}>{chargeTravail}</Text>
                                        </View>
                                    )}
                                </View>
                            )}
                            {product.disponibiliteElectricien && (
                                <View style={styles.electricienDispoBadge}>
                                    <SafeIcon name="clock" size={12} color="#6B7280" />
                                    <Text style={styles.electricienDispoText}>{product.disponibiliteElectricien}</Text>
                                </View>
                            )}
                            {product.devisGratuitElec && (
                                <View style={styles.electricienDevisBadge}>
                                    <SafeIcon name="file-text" size={12} color="#10B981" />
                                    <Text style={styles.electricienDevisText}>Devis gratuit</Text>
                                </View>
                            )}
                        </View>

                        {/* Garantie et certifications */}
                        {product.garantieElectricien && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <SafeIcon name="shield" size={14} color="#059669" />
                                <Text style={styles.electricienGarantie}>Garantie {product.garantieElectricien}</Text>
                            </View>
                        )}
                        {product.certificationsElectricien && product.certificationsElectricien.length > 0 && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <SafeIcon name="award" size={14} color="#F59E0B" />
                                <Text style={styles.electricienCertif}>{product.certificationsElectricien[0]}</Text>
                            </View>
                        )}

                        {/* Zones d'intervention */}
                        {product.zonesInterventionElectricien && product.zonesInterventionElectricien.length > 0 && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <SafeIcon name="map-pin" size={14} color="#6366F1" />
                                <Text style={styles.electricienZones}>
                                    {product.zonesInterventionElectricien.slice(0, 2).join(', ')}
                                    {product.zonesInterventionElectricien.length > 2 && ` +${product.zonesInterventionElectricien.length - 2}`}
                                </Text>
                            </View>
                        )}
                    </View>
                );
            }

            case 'electricien_auto': {
                return (
                    <View style={{ gap: 12 }}>
                        {/* Type de prestation */}
                        {product.typeElectricienAuto && (
                            <View style={styles.electricienAutoBadge}>
                                <SafeIcon name="battery-charging" size={14} color="#FF6B35" />
                                <Text style={styles.electricienAutoText}>🔋 {product.typeElectricienAuto}</Text>
                            </View>
                        )}

                        {/* Spécialités */}
                        {product.specialitesElectricienAuto && product.specialitesElectricienAuto.length > 0 && (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                {product.specialitesElectricienAuto.slice(0, 2).map((specialite, index) => (
                                    <View key={index} style={styles.electricienAutoSpecialiteBadge}>
                                        <Text style={styles.electricienAutoSpecialiteText}>{specialite}</Text>
                                    </View>
                                ))}
                                {product.specialitesElectricienAuto.length > 2 && (
                                    <View style={styles.electricienAutoSpecialiteBadge}>
                                        <Text style={styles.electricienAutoSpecialiteText}>+{product.specialitesElectricienAuto.length - 2}</Text>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* Véhicules pris en charge */}
                        {product.vehiculesElectricienAuto && product.vehiculesElectricienAuto.length > 0 && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <SafeIcon name="car" size={14} color="#6B7280" />
                                <Text style={styles.electricienAutoVehicules}>
                                    {product.vehiculesElectricienAuto.slice(0, 2).join(', ')}
                                    {product.vehiculesElectricienAuto.length > 2 && ` +${product.vehiculesElectricienAuto.length - 2}`}
                                </Text>
                            </View>
                        )}

                        {/* Disponibilité et urgence */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {product.urgence24hElecAuto && (
                                <View style={styles.electricienAutoUrgenceBadge}>
                                    <SafeIcon name="zap" size={12} color="#DC2626" />
                                    <Text style={styles.electricienAutoUrgenceText}>Urgence 24h/24</Text>
                                </View>
                            )}
                            {product.disponibiliteElectricienAuto && (
                                <View style={styles.electricienAutoDispoBadge}>
                                    <SafeIcon name="clock" size={12} color="#6B7280" />
                                    <Text style={styles.electricienAutoDispoText}>{product.disponibiliteElectricienAuto}</Text>
                                </View>
                            )}
                            {product.deplacementDomicile && (
                                <View style={styles.electricienAutoDeplacementBadge}>
                                    <SafeIcon name="home" size={12} color="#10B981" />
                                    <Text style={styles.electricienAutoDeplacementText}>Déplacement domicile</Text>
                                </View>
                            )}
                        </View>

                        {/* Équipements de diagnostic */}
                        {product.equipementsDiagnosticAuto && product.equipementsDiagnosticAuto.length > 0 && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <SafeIcon name="activity" size={14} color="#8B5CF6" />
                                <Text style={styles.electricienAutoDiagnostic}>{product.equipementsDiagnosticAuto[0]}</Text>
                            </View>
                        )}

                        {/* Garantie */}
                        {product.garantieElectricienAuto && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <SafeIcon name="shield" size={14} color="#059669" />
                                <Text style={styles.electricienAutoGarantie}>Garantie {product.garantieElectricienAuto}</Text>
                            </View>
                        )}

                        {/* Zones d'intervention */}
                        {product.zonesInterventionElectricienAuto && product.zonesInterventionElectricienAuto.length > 0 && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <SafeIcon name="map-pin" size={14} color="#6366F1" />
                                <Text style={styles.electricienAutoZones}>
                                    {product.zonesInterventionElectricienAuto.slice(0, 2).join(', ')}
                                    {product.zonesInterventionElectricienAuto.length > 2 && ` +${product.zonesInterventionElectricienAuto.length - 2}`}
                                </Text>
                            </View>
                        )}
                    </View>
                );
            }

            case 'reparateur_climatiseur': {
                return (
                    <View style={{ gap: 12 }}>
                        {/* Type de service climatisation */}
                        {product.serviceClimatisation && (
                            <View style={{
                                backgroundColor: '#E0F2FE',
                                borderColor: '#0EA5E9',
                                borderWidth: 1,
                                borderRadius: 12,
                                paddingHorizontal: 12,
                                paddingVertical: 6,
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 6
                            }}>
                                <SafeIcon name="wind" size={14} color="#0EA5E9" />
                                <Text style={{ color: '#075985', fontSize: 13, fontWeight: '600' }}>
                                    {product.serviceClimatisation}
                                </Text>
                            </View>
                        )}

                        {/* Marque climatiseur et Type */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {product.marqueClimatiseur && (
                                <View style={{
                                    backgroundColor: '#F0F9FF',
                                    borderColor: '#0284C7',
                                    borderWidth: 1,
                                    borderRadius: 10,
                                    paddingHorizontal: 10,
                                    paddingVertical: 4,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 4
                                }}>
                                    <SafeIcon name="tag" size={12} color="#0284C7" />
                                    <Text style={{ color: '#0C4A6E', fontSize: 11, fontWeight: '500' }}>
                                        {product.marqueClimatiseur}
                                    </Text>
                                </View>
                            )}
                            {product.typeClimatiseur && (
                                <View style={{
                                    backgroundColor: '#F0FDFA',
                                    borderColor: '#14B8A6',
                                    borderWidth: 1,
                                    borderRadius: 10,
                                    paddingHorizontal: 10,
                                    paddingVertical: 4,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 4
                                }}>
                                    <SafeIcon name="droplet" size={12} color="#14B8A6" />
                                    <Text style={{ color: '#134E4A', fontSize: 11, fontWeight: '500' }}>
                                        {product.typeClimatiseur}
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Puissance BTU */}
                        {product.puissanceBtu && (
                            <View style={{
                                backgroundColor: '#FEF3C7',
                                borderColor: '#F59E0B',
                                borderWidth: 1,
                                borderRadius: 10,
                                paddingHorizontal: 10,
                                paddingVertical: 4,
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 4
                            }}>
                                <SafeIcon name="zap" size={12} color="#F59E0B" />
                                <Text style={{ color: '#92400E', fontSize: 11, fontWeight: '500' }}>
                                    {product.puissanceBtu}
                                </Text>
                            </View>
                        )}

                        {/* Disponibilité et Urgence */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {product.disponibiliteClim && (
                                <View style={{
                                    backgroundColor: product.disponibiliteClim.includes('24h') ? '#FEE2E2' : '#E0E7FF',
                                    borderColor: product.disponibiliteClim.includes('24h') ? '#DC2626' : '#6366F1',
                                    borderWidth: 1,
                                    borderRadius: 10,
                                    paddingHorizontal: 10,
                                    paddingVertical: 4,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 4
                                }}>
                                    {product.disponibiliteClim.includes('24h') ? (
                                        <SafeIcon name="zap" size={12} color="#DC2626" />
                                    ) : (
                                        <SafeIcon name="clock" size={12} color="#6366F1" />
                                    )}
                                    <Text style={{
                                        color: product.disponibiliteClim.includes('24h') ? '#991B1B' : '#3730A3',
                                        fontSize: 11,
                                        fontWeight: '600'
                                    }}>
                                        {product.disponibiliteClim}
                                    </Text>
                                </View>
                            )}
                            {product.devisGratuitClim && (
                                <View style={{
                                    backgroundColor: '#D1FAE5',
                                    borderColor: '#10B981',
                                    borderWidth: 1,
                                    borderRadius: 10,
                                    paddingHorizontal: 10,
                                    paddingVertical: 4,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 4
                                }}>
                                    <SafeIcon name="file-text" size={12} color="#10B981" />
                                    <Text style={{ color: '#065F46', fontSize: 11, fontWeight: '500' }}>
                                        Devis gratuit
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Certification et Garantie */}
                        {product.certificationClim && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <SafeIcon name="award" size={14} color="#F59E0B" />
                                <Text style={{ color: '#92400E', fontSize: 12, fontWeight: '500' }}>
                                    {product.certificationClim}
                                </Text>
                            </View>
                        )}
                        {product.garantieClim && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <SafeIcon name="shield" size={14} color="#059669" />
                                <Text style={{ color: '#047857', fontSize: 12, fontWeight: '500' }}>
                                    Garantie {product.garantieClim}
                                </Text>
                            </View>
                        )}

                        {/* Zones d'intervention */}
                        {product.zonesInterventionClim && product.zonesInterventionClim.length > 0 && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <SafeIcon name="map-pin" size={14} color="#6366F1" />
                                <Text style={{ color: '#4338CA', fontSize: 11, fontWeight: '500' }}>
                                    {product.zonesInterventionClim.slice(0, 2).join(', ')}
                                    {product.zonesInterventionClim.length > 2 && ` +${product.zonesInterventionClim.length - 2}`}
                                </Text>
                            </View>
                        )}

                        {/* Pièces détachées disponibles */}
                        {product.piecesDisponibles && product.piecesDisponibles.length > 0 && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <SafeIcon name="package" size={14} color="#8B5CF6" />
                                <Text style={{ color: '#6B21A8', fontSize: 11, fontWeight: '500' }}>
                                    Pièces: {product.piecesDisponibles.slice(0, 2).join(', ')}
                                    {product.piecesDisponibles.length > 2 && ` +${product.piecesDisponibles.length - 2}`}
                                </Text>
                            </View>
                        )}

                        {/* Type de clientèle */}
                        {product.typeClientele && (
                            <View style={{
                                backgroundColor: '#FDF4FF',
                                borderColor: '#A855F7',
                                borderWidth: 1,
                                borderRadius: 10,
                                paddingHorizontal: 10,
                                paddingVertical: 4,
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 4
                            }}>
                                <SafeIcon name="users" size={12} color="#A855F7" />
                                <Text style={{ color: '#6B21A8', fontSize: 11, fontWeight: '500' }}>
                                    {product.typeClientele}
                                </Text>
                            </View>
                        )}
                    </View>
                );
            }

            case 'mecanicien_moto': {
                return (
                    <View style={styles.detailsSection}>
                        {/* Nom du garage moto */}
                        {product.nomGarageMoto && (
                            <View style={styles.mecanicienMotoIdentity}>
                                <Text style={styles.mecanicienMotoIdentityText}>
                                    🏍️ {product.nomGarageMoto}
                                </Text>
                            </View>
                        )}

                        {/* Spécialités motos */}
                        {product.specialitesMoto && product.specialitesMoto.length > 0 && (
                            <View style={styles.mecanicienMotoSpecialites}>
                                <Text style={styles.mecanicienMotoSpecialitesTitle}>Spécialités motos :</Text>
                                <View style={styles.tagsContainer}>
                                    {product.specialitesMoto.slice(0, 4).map((spec: string, idx: number) => (
                                        <View key={idx} style={styles.mecanicienMotoSpecTag}>
                                            <Text style={styles.mecanicienMotoSpecText}>{spec}</Text>
                                        </View>
                                    ))}
                                    {product.specialitesMoto.length > 4 && (
                                        <View style={styles.mecanicienMotoSpecTag}>
                                            <Text style={styles.mecanicienMotoSpecText}>+{product.specialitesMoto.length - 4}</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* Services spécialisés motos */}
                        {product.typeServiceMoto && product.typeServiceMoto.length > 0 && (
                            <View style={styles.mecanicienMotoServices}>
                                <Text style={styles.prestationLabel}>Services spécialisés :</Text>
                                <View style={styles.tagsContainer}>
                                    {product.typeServiceMoto.slice(0, 5).map((service: string, idx: number) => (
                                        <View key={idx} style={styles.motoServiceTag}>
                                            <Text style={styles.motoServiceText}>{service}</Text>
                                        </View>
                                    ))}
                                    {product.typeServiceMoto.length > 5 && (
                                        <View style={styles.motoServiceTag}>
                                            <Text style={styles.motoServiceText}>+{product.typeServiceMoto.length - 5} services</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* Marques de motos traitées */}
                        {product.marquesMotos && product.marquesMotos.length > 0 && (
                            <View style={styles.mecanicienMotoMarques}>
                                <Text style={styles.prestationLabel}>Marques motos :</Text>
                                <View style={styles.tagsContainer}>
                                    {product.marquesMotos.slice(0, 6).map((marque: string, idx: number) => (
                                        <View key={idx} style={styles.motoMarqueTag}>
                                            <Text style={styles.motoMarqueText}>{marque}</Text>
                                        </View>
                                    ))}
                                    {product.marquesMotos.length > 6 && (
                                        <View style={styles.motoMarqueTag}>
                                            <Text style={styles.motoMarqueText}>+{product.marquesMotos.length - 6}</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* Types de motos */}
                        {product.typesMotos && product.typesMotos.length > 0 && (
                            <View style={styles.mecanicienMotoTypes}>
                                <Text style={styles.prestationLabel}>Types de motos :</Text>
                                <View style={styles.tagsContainer}>
                                    {product.typesMotos.slice(0, 4).map((type: string, idx: number) => (
                                        <View key={idx} style={styles.motoTypeTag}>
                                            <Text style={styles.motoTypeText}>{type}</Text>
                                        </View>
                                    ))}
                                    {product.typesMotos.length > 4 && (
                                        <View style={styles.motoTypeTag}>
                                            <Text style={styles.motoTypeText}>+{product.typesMotos.length - 4}</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* Cylindrées spécialisées */}
                        {product.cylindreesMotos && product.cylindreesMotos.length > 0 && (
                            <View style={styles.mecanicienMotoCylindrees}>
                                <Text style={styles.prestationLabel}>Cylindrées :</Text>
                                <View style={styles.tagsContainer}>
                                    {product.cylindreesMotos.slice(0, 6).map((cyl: string, idx: number) => (
                                        <View key={idx} style={styles.cylindreeTag}>
                                            <Text style={styles.cylindreeText}>{cyl}</Text>
                                        </View>
                                    ))}
                                    {product.cylindreesMotos.length > 6 && (
                                        <View style={styles.cylindreeTag}>
                                            <Text style={styles.cylindreeText}>+{product.cylindreesMotos.length - 6}</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* Certifications spécialisées motos */}
                        {product.certificationsMoto && product.certificationsMoto.length > 0 && (
                            <View style={styles.mecanicienMotoCertifications}>
                                <Text style={styles.prestationLabel}>Certifications motos :</Text>
                                <View style={styles.tagsContainer}>
                                    {product.certificationsMoto.slice(0, 3).map((cert: string, idx: number) => (
                                        <View key={idx} style={styles.motoCertificationTag}>
                                            <SafeIcon name="award" size={12} color="#10B981" />
                                            <Text style={styles.motoCertificationText}>{cert}</Text>
                                        </View>
                                    ))}
                                    {product.certificationsMoto.length > 3 && (
                                        <View style={styles.motoCertificationTag}>
                                            <Text style={styles.motoCertificationText}>+{product.certificationsMoto.length - 3}</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* Horaires & Disponibilité spécialisés */}
                        <View style={styles.mecanicienMotoInfos}>
                            {product.horairesMoto && (
                                <View style={styles.detailChip}>
                                    <SafeIcon name="clock" size={14} color="#6B7280" />
                                    <Text style={styles.detailText}>{product.horairesMoto}</Text>
                                </View>
                            )}
                            {product.delaisMoto && (
                                <View style={styles.detailChip}>
                                    <SafeIcon name="zap" size={14} color="#F59E0B" />
                                    <Text style={styles.detailText}>{product.delaisMoto}</Text>
                                </View>
                            )}
                            {product.urgenceMoto && (
                                <View style={styles.urgenceChip}>
                                    <SafeIcon name="alert-triangle" size={14} color="#EF4444" />
                                    <Text style={styles.urgenceText}>{product.urgenceMoto}</Text>
                                </View>
                            )}
                        </View>

                        {/* Options spécialisées */}
                        <View style={styles.mecanicienMotoOptions}>
                            {product.devisGratuitMoto && (
                                <View style={styles.successChip}>
                                    <SafeIcon name="check" size={12} color="#10B981" />
                                    <Text style={styles.successText}>Devis gratuit</Text>
                                </View>
                            )}
                            {product.garantieReparationsMoto && (
                                <View style={styles.successChip}>
                                    <SafeIcon name="check" size={12} color="#10B981" />
                                    <Text style={styles.successText}>Garantie réparations</Text>
                                </View>
                            )}
                            {product.motoCourtoisie && (
                                <View style={styles.successChip}>
                                    <SafeIcon name="check" size={12} color="#10B981" />
                                    <Text style={styles.successText}>Moto de courtoisie</Text>
                                </View>
                            )}
                            {product.enlevementMoto && (
                                <View style={styles.successChip}>
                                    <SafeIcon name="check" size={12} color="#10B981" />
                                    <Text style={styles.successText}>Enlèvement moto</Text>
                                </View>
                            )}
                        </View>
                    </View>
                );
            }

            case 'macon': {
                return (
                    <View style={{ gap: 12 }}>
                        {/* Type de prestation */}
                        {product.typeMacon && (
                            <View style={styles.maconBadge}>
                                <SafeIcon name="home" size={14} color="#78716C" />
                                <Text style={styles.maconText}>🧱 {product.typeMacon}</Text>
                            </View>
                        )}

                        {/* Spécialités */}
                        {product.specialitesMacon && product.specialitesMacon.length > 0 && (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                {product.specialitesMacon.slice(0, 3).map((specialite, index) => (
                                    <View key={index} style={styles.maconSpecialiteBadge}>
                                        <Text style={styles.maconSpecialiteText}>{specialite}</Text>
                                    </View>
                                ))}
                                {product.specialitesMacon.length > 3 && (
                                    <View style={styles.maconSpecialiteBadge}>
                                        <Text style={styles.maconSpecialiteText}>+{product.specialitesMacon.length - 3}</Text>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* Types de bâtiments */}
                        {product.typesBatimentMacon && product.typesBatimentMacon.length > 0 && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <SafeIcon name="building" size={14} color="#6B7280" />
                                <Text style={styles.maconBatiments}>
                                    {product.typesBatimentMacon.slice(0, 2).join(', ')}
                                    {product.typesBatimentMacon.length > 2 && ` +${product.typesBatimentMacon.length - 2}`}
                                </Text>
                            </View>
                        )}

                        {/* Assurance et garantie */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {product.assuranceDecennale && (
                                <View style={styles.maconAssuranceBadge}>
                                    <SafeIcon name="shield" size={12} color="#10B981" />
                                    <Text style={styles.maconAssuranceText}>Assurance décennale</Text>
                                </View>
                            )}
                            {product.garantieMacon && (
                                <View style={styles.maconGarantieBadge}>
                                    <SafeIcon name="shield-check" size={12} color="#059669" />
                                    <Text style={styles.maconGarantieText}>Garantie {product.garantieMacon}</Text>
                                </View>
                            )}
                            {product.devisGratuitMacon && (
                                <View style={styles.maconDevisBadge}>
                                    <SafeIcon name="file-text" size={12} color="#6366F1" />
                                    <Text style={styles.maconDevisText}>Devis gratuit</Text>
                                </View>
                            )}
                        </View>

                        {/* Disponibilité */}
                        {product.disponibiliteMacon && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <SafeIcon name="clock" size={14} color="#6B7280" />
                                <Text style={styles.maconDispo}>{product.disponibiliteMacon}</Text>
                            </View>
                        )}

                        {/* Zones d'intervention */}
                        {product.zonesInterventionMacon && product.zonesInterventionMacon.length > 0 && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <SafeIcon name="map-pin" size={14} color="#6366F1" />
                                <Text style={styles.maconZones}>
                                    {product.zonesInterventionMacon.slice(0, 2).join(', ')}
                                    {product.zonesInterventionMacon.length > 2 && ` +${product.zonesInterventionMacon.length - 2}`}
                                </Text>
                            </View>
                        )}
                    </View>
                );
            }

            case 'ingenieur_archi': {
                return (
                    <View style={{ gap: 12 }}>
                        {/* Type de prestation */}
                        {product.typeIngenieurArchi && (
                            <View style={styles.archiTypeBadge}>
                                <SafeIcon name="compass" size={14} color="#0891B2" />
                                <Text style={styles.archiTypeText}>📐 {product.typeIngenieurArchi}</Text>
                            </View>
                        )}

                        {/* Services */}
                        {product.servicesIngenieurArchi && product.servicesIngenieurArchi.length > 0 && (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                {product.servicesIngenieurArchi.slice(0, 2).map((service, index) => (
                                    <View key={index} style={styles.archiServiceBadge}>
                                        <Text style={styles.archiServiceText}>{service}</Text>
                                    </View>
                                ))}
                                {product.servicesIngenieurArchi.length > 2 && (
                                    <View style={styles.archiServiceBadge}>
                                        <Text style={styles.archiServiceText}>+{product.servicesIngenieurArchi.length - 2} services</Text>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* Types de projets */}
                        {product.typesProjetArchi && product.typesProjetArchi.length > 0 && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <SafeIcon name="briefcase" size={14} color="#6B7280" />
                                <Text style={styles.archiProjets}>
                                    {product.typesProjetArchi.slice(0, 2).join(', ')}
                                    {product.typesProjetArchi.length > 2 && ` +${product.typesProjetArchi.length - 2}`}
                                </Text>
                            </View>
                        )}

                        {/* Logiciels */}
                        {product.logicielsArchi && product.logicielsArchi.length > 0 && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <SafeIcon name="monitor" size={14} color="#8B5CF6" />
                                <Text style={styles.archiLogiciels}>
                                    {product.logicielsArchi.slice(0, 2).join(', ')}
                                    {product.logicielsArchi.length > 2 && ` +${product.logicielsArchi.length - 2}`}
                                </Text>
                            </View>
                        )}

                        {/* Assurances et certifications */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {product.assuranceRCPro && (
                                <View style={styles.archiAssuranceBadge}>
                                    <SafeIcon name="shield" size={12} color="#10B981" />
                                    <Text style={styles.archiAssuranceText}>RC Pro</Text>
                                </View>
                            )}
                            {product.assuranceDecennaleArchi && (
                                <View style={styles.archiDecennaleBadge}>
                                    <SafeIcon name="shield-check" size={12} color="#059669" />
                                    <Text style={styles.archiDecennaleText}>Décennale</Text>
                                </View>
                            )}
                            {product.certificationsArchi && product.certificationsArchi.length > 0 && (
                                <View style={styles.archiCertifBadge}>
                                    <SafeIcon name="award" size={12} color="#F59E0B" />
                                    <Text style={styles.archiCertifText}>{product.certificationsArchi[0]}</Text>
                                </View>
                            )}
                        </View>

                        {/* Tarification */}
                        {product.tarificationArchi && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <SafeIcon name="dollar-sign" size={14} color="#6B7280" />
                                <Text style={styles.archiTarif}>{product.tarificationArchi}</Text>
                            </View>
                        )}

                        {/* Zones d'intervention */}
                        {product.zonesInterventionArchi && product.zonesInterventionArchi.length > 0 && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <SafeIcon name="map-pin" size={14} color="#6366F1" />
                                <Text style={styles.archiZones}>
                                    {product.zonesInterventionArchi.slice(0, 2).join(', ')}
                                    {product.zonesInterventionArchi.length > 2 && ` +${product.zonesInterventionArchi.length - 2}`}
                                </Text>
                            </View>
                        )}
                    </View>
                );
            }

            case 'electricite': {
                return (
                    <View style={{ gap: 12 }}>
                        {/* Badges principaux : Catégorie + Type */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {product.categorieElectrique && (
                                <View style={[styles.electriciteBadge, { backgroundColor: '#FFF9C4', borderColor: '#FFC107', borderWidth: 1 }]}>
                                    <Text style={[styles.electriciteText, { color: '#F57F17' }]}>📦 {product.categorieElectrique}</Text>
                                </View>
                            )}
                            {product.typeElectricite && (
                                <View style={[styles.electriciteBadge, { backgroundColor: '#FFECB3', borderColor: '#FFB300', borderWidth: 1 }]}>
                                    <Text style={[styles.electriciteText, { color: '#E65100' }]}>⚡ {product.typeElectricite}</Text>
                                </View>
                            )}
                        </View>

                        {/* Marque */}
                        {product.marqueElectricite && (
                            <View style={styles.electriciteMarqueBadge}>
                                <Text style={styles.electriciteMarqueText}>🏷️ {product.marqueElectricite}</Text>
                            </View>
                        )}

                        {/* Caractéristiques techniques */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                            {product.puissanceElectrique && (
                                <Text style={[styles.electriciteCarac, { color: '#F57F17', fontWeight: '600' }]}>
                                    ⚡ {product.puissanceElectrique}
                                </Text>
                            )}
                            {product.tensionElectrique && (
                                <Text style={[styles.electriciteCarac, { color: '#E65100' }]}>
                                    🔌 {product.tensionElectrique}
                                </Text>
                            )}
                            {product.culotAmpoule && (
                                <Text style={[styles.electriciteCarac, { color: '#F57F17' }]}>
                                    💡 {product.culotAmpoule}
                                </Text>
                            )}
                        </View>

                        {/* Couleur de lumière */}
                        {product.couleurLumiere && (
                            <Text style={[styles.electriciteCarac, { color: '#FFA000' }]}>
                                🌈 {product.couleurLumiere}
                            </Text>
                        )}

                        {/* Normes (afficher les 3 premières) */}
                        {product.normesElectrique && Array.isArray(product.normesElectrique) && product.normesElectrique.length > 0 && (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                                {product.normesElectrique.slice(0, 3).map((norme, idx) => (
                                    <View key={idx} style={{ backgroundColor: '#E3F2FD', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 }}>
                                        <Text style={{ fontSize: 11, color: '#1565C0', fontWeight: '500' }}>✓ {norme}</Text>
                                    </View>
                                ))}
                                {product.normesElectrique.length > 3 && (
                                    <View style={{ backgroundColor: '#E3F2FD', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 }}>
                                        <Text style={{ fontSize: 11, color: '#1565C0', fontWeight: '500' }}>+{product.normesElectrique.length - 3}</Text>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* État + Garantie */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                            {product.etatElectrique && (
                                <Text style={[styles.electriciteCarac, { color: '#2E7D32' }]}>
                                    📋 {product.etatElectrique}
                                </Text>
                            )}
                            {product.garantieElectrique && (
                                <Text style={[styles.electriciteCarac, { color: '#1565C0' }]}>
                                    🛡️ Garantie {product.garantieElectrique}
                                </Text>
                            )}
                        </View>

                        {/* Usage */}
                        {product.utilisationElectrique && (
                            <Text style={[styles.electriciteCarac, { color: '#6A1B9A', fontSize: 12 }]}>
                                🏢 Usage: {product.utilisationElectrique}
                            </Text>
                        )}
                    </View>
                );
            }

            case 'image_son': {
                const getEtatImageSonColor = (etat: string) => {
                    if (etat?.includes('Neuf')) return { bg: '#D1FAE5', text: '#065F46', border: '#10B981' };
                    if (etat?.includes('Excellent')) return { bg: '#E0E7FF', text: '#3730A3', border: '#6366F1' };
                    if (etat?.includes('Bon')) return { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B' };
                    return { bg: '#F3F4F6', text: '#374151', border: '#9CA3AF' };
                };
                const etatColors = getEtatImageSonColor(product.etatImageSon || '');

                return (
                    <View style={{ gap: 12 }}>
                        {/* Badges principaux */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {product.etatImageSon && (
                                <View style={[styles.imageSonBadge, { backgroundColor: etatColors.bg, borderColor: etatColors.border }]}>
                                    <Text style={[styles.imageSonBadgeText, { color: etatColors.text }]}>{product.etatImageSon}</Text>
                                </View>
                            )}
                            {product.categorieImageSon && (
                                <View style={styles.imageSonCategorieBadge}>
                                    <Text style={styles.imageSonCategorieText}>📺 {product.categorieImageSon}</Text>
                                </View>
                            )}
                            {product.modeleImageSon && (
                                <View style={styles.imageSonModeleBadge}>
                                    <Text style={styles.imageSonModeleText}>⭐ {product.modeleImageSon}</Text>
                                </View>
                            )}
                        </View>

                        {/* Marque et Type */}
                        {product.marqueImageSon && (
                            <View style={styles.imageSonMarqueBadge}>
                                <Text style={styles.imageSonMarqueText}>🏷️ {product.marqueImageSon}</Text>
                            </View>
                        )}
                        {product.typeImageSon && (
                            <Text style={styles.imageSonType}>📺 {product.typeImageSon}</Text>
                        )}

                        {/* Spécifications techniques */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                            {product.diagonaleEcran && (
                                <Text style={styles.imageSonSpec}>📏 {product.diagonaleEcran}</Text>
                            )}
                            {product.resolution && (
                                <Text style={styles.imageSonSpec}>🎬 {product.resolution}</Text>
                            )}
                            {product.technologieEcran && (
                                <Text style={styles.imageSonSpec}>✨ {product.technologieEcran}</Text>
                            )}
                            {product.puissanceAudio && (
                                <Text style={styles.imageSonSpec}>🔊 {product.puissanceAudio}</Text>
                            )}
                        </View>

                        {/* Fonctionnalités principales (3 premières) */}
                        {product.fonctionnalitesImageSon && product.fonctionnalitesImageSon.length > 0 && (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                                {product.fonctionnalitesImageSon.slice(0, 4).map((fonc, idx) => (
                                    <View key={idx} style={styles.imageSonFonctionTag}>
                                        <Text style={styles.imageSonFonctionText}>✓ {fonc}</Text>
                                    </View>
                                ))}
                                {product.fonctionnalitesImageSon.length > 4 && (
                                    <View style={styles.imageSonFonctionTag}>
                                        <Text style={styles.imageSonFonctionText}>+{product.fonctionnalitesImageSon.length - 4}</Text>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* Connectivités (3 premières) */}
                        {product.connectivitesImageSon && product.connectivitesImageSon.length > 0 && (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                                {product.connectivitesImageSon.slice(0, 3).map((conn, idx) => (
                                    <View key={idx} style={styles.imageSonConnectTag}>
                                        <Text style={styles.imageSonConnectText}>{conn}</Text>
                                    </View>
                                ))}
                                {product.connectivitesImageSon.length > 3 && (
                                    <View style={styles.imageSonConnectTag}>
                                        <Text style={styles.imageSonConnectText}>+{product.connectivitesImageSon.length - 3}</Text>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* Garantie */}
                        {product.garantieImageSon && (
                            <Text style={styles.imageSonGarantie}>🛡️ {product.garantieImageSon}</Text>
                        )}
                    </View>
                );
            }

            case 'sport_loisirs': {
                return (
                    <View style={{ gap: 12 }}>
                        {product.typeSport && (
                            <View style={styles.sportBadge}>
                                <Text style={styles.sportText}>⚽ {product.typeSport}</Text>
                            </View>
                        )}
                        {product.categorieSport && (
                            <View style={styles.sportCategorieBadge}>
                                <Text style={styles.sportCategorieText}>{product.categorieSport}</Text>
                            </View>
                        )}
                        {product.niveauSport && (
                            <Text style={styles.sportNiveau}>🎯 {product.niveauSport}</Text>
                        )}
                        {product.marque && (
                            <Text style={styles.sportMarque}>🏷️ {product.marque}</Text>
                        )}
                    </View>
                );
            }

            case 'bricolage': {
                return (
                    <View style={{ gap: 12 }}>
                        {product.typeBricolage && (
                            <View style={styles.bricolageBadge}>
                                <Text style={styles.bricolageText}>🔨 {product.typeBricolage}</Text>
                            </View>
                        )}
                        {product.categorieBricolage && (
                            <Text style={styles.bricolageCategorie}>{product.categorieBricolage}</Text>
                        )}
                        {product.marque && (
                            <Text style={styles.bricolageMarque}>🏷️ {product.marque}</Text>
                        )}
                    </View>
                );
            }

            case 'enfants_bebes': {
                return (
                    <View style={{ gap: 12 }}>
                        {product.categorieEnfant && (
                            <View style={styles.enfantBadge}>
                                <Text style={styles.enfantText}>👶 {product.categorieEnfant}</Text>
                            </View>
                        )}
                        {product.ageRecommande && (
                            <View style={styles.enfantAgeBadge}>
                                <Text style={styles.enfantAgeText}>🎂 {product.ageRecommande}</Text>
                            </View>
                        )}
                        {product.etatEnfant && (
                            <Text style={styles.enfantEtat}>État: {product.etatEnfant}</Text>
                        )}
                        {product.securiteNorme && (
                            <Text style={styles.enfantSecurite}>✓ Normes CE</Text>
                        )}
                    </View>
                );
            }

            case 'decoration': {
                return (
                    <View style={{ gap: 12 }}>
                        {/* Catégorie */}
                        {product.categorieDecoration && (
                            <View style={styles.decorationBadge}>
                                <Text style={styles.decorationText}>🖼️ {product.categorieDecoration}</Text>
                            </View>
                        )}
                        {/* Style */}
                        {product.styleDecoration && (
                            <View style={styles.decorationStyleBadge}>
                                <Text style={styles.decorationStyleText}>✨ {product.styleDecoration}</Text>
                            </View>
                        )}
                        {/* Pièce */}
                        {product.pieceDecoration && (
                            <Text style={styles.decorationCouleur}>🏠 {product.pieceDecoration}</Text>
                        )}
                        {/* Couleur */}
                        {product.couleurDecoration && (
                            <Text style={styles.decorationCouleur}>🎨 {product.couleurDecoration}</Text>
                        )}
                        {/* Matière */}
                        {product.matiereDecoration && (
                            <Text style={styles.decorationMateriau}>📦 {product.matiereDecoration}</Text>
                        )}
                        {/* Taille */}
                        {product.tailleDecoration && (
                            <Text style={styles.decorationCouleur}>📏 {product.tailleDecoration}</Text>
                        )}
                        {/* État */}
                        {product.etatDecoration && (
                            <Text style={styles.decorationCouleur}>✅ {product.etatDecoration}</Text>
                        )}
                        {/* Legacy support */}
                        {!product.categorieDecoration && product.typeDecoration && (
                            <View style={styles.decorationBadge}>
                                <Text style={styles.decorationText}>🖼️ {product.typeDecoration}</Text>
                            </View>
                        )}
                        {!product.matiereDecoration && product.materiauDecoration && (
                            <Text style={styles.decorationMateriau}>📦 {product.materiauDecoration}</Text>
                        )}
                    </View>
                );
            }

            case 'telephone': {
                // ✅ SMARTPHONE - Rendu optimisé avec badges specs
                const getEtatColorPhone = (etat: string) => {
                    if (etat?.includes('Neuf')) return { bg: '#D1FAE5', text: '#065F46', border: '#10B981' };
                    if (etat?.includes('Reconditionné')) return { bg: '#DBEAFE', text: '#1E40AF', border: '#3B82F6' };
                    if (etat?.includes('Excellent')) return { bg: '#E0E7FF', text: '#3730A3', border: '#6366F1' };
                    if (etat?.includes('Bon')) return { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B' };
                    if (etat?.includes('Moyen')) return { bg: '#FED7AA', text: '#9A3412', border: '#F97316' };
                    return { bg: '#F3F4F6', text: '#374151', border: '#9CA3AF' };
                };

                const etatColor = product.etatTelephone ? getEtatColorPhone(product.etatTelephone) : null;

                return (
                    <View style={{ gap: 12 }}>
                        {/* Badges État + Garantie */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {product.etatTelephone && etatColor && (
                                <View style={[styles.phoneBadge, { backgroundColor: etatColor.bg, borderColor: etatColor.border }]}>
                                    <Text style={[styles.phoneBadgeText, { color: etatColor.text }]}>
                                        {product.etatTelephone}
                                    </Text>
                                </View>
                            )}
                            {product.anneeAchatTelephone && parseInt(product.anneeAchatTelephone) >= 2023 && (
                                <View style={styles.phoneRecentBadge}>
                                    <SafeIcon name="zap" size={12} color="#059669" />
                                    <Text style={styles.phoneRecentText}>Récent {product.anneeAchatTelephone}</Text>
                                </View>
                            )}
                            {product.garantieConstructeurTelephone && (
                                <View style={styles.phoneGarantieBadge}>
                                    <SafeIcon name="shield-check" size={12} color="#6366F1" />
                                    <Text style={styles.phoneGarantieText}>Garantie constructeur</Text>
                                </View>
                            )}
                            {product.connectivite5G && (
                                <View style={styles.phone5GBadge}>
                                    <Text style={styles.phone5GText}>5G</Text>
                                </View>
                            )}
                        </View>

                        {/* Identité Smartphone */}
                        <View style={styles.phoneIdentity}>
                            <Text style={styles.phoneIdentityText}>
                                📱 {product.marqueTelephone || ''} {product.modeleTelephone || ''}
                            </Text>
                        </View>

                        {/* Specs principales */}
                        <View style={styles.phoneSpecs}>
                            {product.stockage && (
                                <View style={styles.phoneSpecItem}>
                                    <SafeIcon name="hard-drive" size={16} color="#6B7280" />
                                    <Text style={styles.phoneSpecLabel}>{product.stockage}</Text>
                                </View>
                            )}
                            {product.ram && (
                                <View style={styles.phoneSpecItem}>
                                    <SafeIcon name="cpu" size={16} color="#6B7280" />
                                    <Text style={styles.phoneSpecLabel}>{product.ram} RAM</Text>
                                </View>
                            )}
                            {product.tailleEcran && (
                                <View style={styles.phoneSpecItem}>
                                    <SafeIcon name="smartphone" size={16} color="#6B7280" />
                                    <Text style={styles.phoneSpecLabel}>{product.tailleEcran}</Text>
                                </View>
                            )}
                            {product.numeroCameraPrincipale && (
                                <View style={styles.phoneSpecItem}>
                                    <SafeIcon name="camera" size={16} color="#6B7280" />
                                    <Text style={styles.phoneSpecLabel}>{product.numeroCameraPrincipale}</Text>
                                </View>
                            )}
                            {product.batterieSante && (
                                <View style={styles.phoneSpecItem}>
                                    <SafeIcon name="battery" size={16} color="#6B7280" />
                                    <Text style={styles.phoneSpecLabel}>Batterie {product.batterieSante}</Text>
                                </View>
                            )}
                            {product.couleurTelephone && (
                                <View style={styles.phoneSpecItem}>
                                    <Text style={styles.phoneSpecLabel}>Couleur: {product.couleurTelephone}</Text>
                                </View>
                            )}
                        </View>

                        {/* Opérateur */}
                        {product.operateur && (
                            <View style={styles.phoneOperateur}>
                                <SafeIcon name="sim-card" size={14} color="#6B7280" />
                                <Text style={styles.phoneOperateurText}>{product.operateur}</Text>
                            </View>
                        )}

                        {/* Badges confiance */}
                        {(product.boiteOriginale || product.factureTelephone || product.ecranOriginal || product.imei) && (
                            <View style={styles.phoneConfiance}>
                                {product.boiteOriginale && (
                                    <View style={styles.phoneConfianceTag}>
                                        <SafeIcon name="box" size={12} color="#059669" />
                                        <Text style={styles.phoneConfianceText}>Boîte origine</Text>
                                    </View>
                                )}
                                {product.factureTelephone && (
                                    <View style={styles.phoneConfianceTag}>
                                        <SafeIcon name="file-text" size={12} color="#059669" />
                                        <Text style={styles.phoneConfianceText}>Facture</Text>
                                    </View>
                                )}
                                {product.ecranOriginal && (
                                    <View style={styles.phoneConfianceTag}>
                                        <SafeIcon name="shield-check" size={12} color="#059669" />
                                        <Text style={styles.phoneConfianceText}>Écran original</Text>
                                    </View>
                                )}
                                {product.imei && (
                                    <View style={styles.phoneConfianceTag}>
                                        <SafeIcon name="hash" size={12} color="#059669" />
                                        <Text style={styles.phoneConfianceText}>IMEI vérifié</Text>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* Accessoires */}
                        {product.accessoiresTelephone && product.accessoiresTelephone.length > 0 && (
                            <View style={styles.phoneAccessoires}>
                                <Text style={styles.phoneAccessoiresTitle}>Accessoires inclus :</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                                    {product.accessoiresTelephone.slice(0, 4).map((accessoire, idx) => (
                                        <View key={idx} style={styles.phoneAccessoireTag}>
                                            <Text style={styles.phoneAccessoireText}>{accessoire}</Text>
                                        </View>
                                    ))}
                                    {product.accessoiresTelephone.length > 4 && (
                                        <View style={styles.phoneAccessoireTag}>
                                            <Text style={styles.phoneAccessoireText}>+{product.accessoiresTelephone.length - 4}</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        )}
                    </View>
                );
            }

            case 'reparateur_telephone':
            case 'reparateur_telephone_tablette':
            case 'reparation_telephone':
            case 'reparation_smartphone': {
                // ✅ RÉPARATEUR TÉLÉPHONE/TABLETTE - Rendu spécialisé services
                const getDelaiColor = (delai: string) => {
                    if (delai?.includes('Express') || delai?.includes('1-2h')) return { bg: '#FEE2E2', text: '#991B1B', border: '#EF4444' };
                    if (delai?.includes('Rapide') || delai?.includes('3-6h')) return { bg: '#FED7AA', text: '#9A3412', border: '#F97316' };
                    if (delai?.includes('Jour même')) return { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B' };
                    if (delai?.includes('24-48h')) return { bg: '#E0F2FE', text: '#075985', border: '#0EA5E9' };
                    return { bg: '#F3F4F6', text: '#374151', border: '#9CA3AF' };
                };

                const getGarantieColor = (garantie: string) => {
                    if (garantie?.includes('6 mois') || garantie?.includes('à vie')) return { bg: '#D1FAE5', text: '#065F46', border: '#10B981' };
                    if (garantie?.includes('3 mois')) return { bg: '#DBEAFE', text: '#1E40AF', border: '#3B82F6' };
                    if (garantie?.includes('1 mois') || garantie?.includes('15 jours')) return { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B' };
                    if (garantie?.includes('Aucune')) return { bg: '#FEE2E2', text: '#991B1B', border: '#EF4444' };
                    return { bg: '#F3F4F6', text: '#374151', border: '#9CA3AF' };
                };

                const delaiColor = product.delaisReparation ? getDelaiColor(product.delaisReparation) : null;
                const garantieColor = product.garantieReparation ? getGarantieColor(product.garantieReparation) : null;

                // Extraire les types de réparation (multiselect ou string)
                let typesReparation = [];
                if (Array.isArray(product.typeReparation)) {
                    typesReparation = product.typeReparation;
                } else if (typeof product.typeReparation === 'string') {
                    try {
                        typesReparation = JSON.parse(product.typeReparation);
                    } catch {
                        typesReparation = [product.typeReparation];
                    }
                }

                // Extraire les marques supportées
                let marquesSuppoortees = [];
                if (Array.isArray(product.marquesSuppoortees)) {
                    marquesSuppoortees = product.marquesSuppoortees;
                } else if (typeof product.marquesSuppoortees === 'string') {
                    try {
                        marquesSuppoortees = JSON.parse(product.marquesSuppoortees);
                    } catch {
                        marquesSuppoortees = [product.marquesSuppoortees];
                    }
                }

                // Extraire les certifications
                let certifications = [];
                if (Array.isArray(product.certifications)) {
                    certifications = product.certifications;
                } else if (typeof product.certifications === 'string') {
                    try {
                        certifications = JSON.parse(product.certifications);
                    } catch {
                        certifications = [product.certifications];
                    }
                }

                return (
                    <View style={{ gap: 12 }}>
                        {/* Badges Délai + Garantie */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {product.delaisReparation && delaiColor && (
                                <View style={[styles.repairBadge, { backgroundColor: delaiColor.bg, borderColor: delaiColor.border }]}>
                                    <SafeIcon name="clock" size={12} color={delaiColor.text} />
                                    <Text style={[styles.repairBadgeText, { color: delaiColor.text }]}>
                                        {product.delaisReparation}
                                    </Text>
                                </View>
                            )}
                            {product.garantieReparation && garantieColor && (
                                <View style={[styles.repairBadge, { backgroundColor: garantieColor.bg, borderColor: garantieColor.border }]}>
                                    <SafeIcon name="shield-check" size={12} color={garantieColor.text} />
                                    <Text style={[styles.repairBadgeText, { color: garantieColor.text }]}>
                                        {product.garantieReparation}
                                    </Text>
                                </View>
                            )}
                            {product.diagnosticGratuit && (
                                <View style={styles.repairFreeBadge}>
                                    <SafeIcon name="check-circle" size={12} color="#059669" />
                                    <Text style={styles.repairFreeText}>Diagnostic gratuit</Text>
                                </View>
                            )}
                            {product.serviceADomicile && (
                                <View style={styles.repairHomeBadge}>
                                    <SafeIcon name="home" size={12} color="#3B82F6" />
                                    <Text style={styles.repairHomeText}>Service à domicile</Text>
                                </View>
                            )}
                        </View>

                        {/* Nom de l'atelier */}
                        {product.nomAtelier && (
                            <View style={styles.repairName}>
                                <SafeIcon name="tool" size={16} color="#10B981" />
                                <Text style={styles.repairNameText}>{product.nomAtelier}</Text>
                            </View>
                        )}

                        {/* Types de réparation */}
                        {typesReparation.length > 0 && (
                            <View style={styles.repairServices}>
                                <Text style={styles.repairSectionTitle}>🔧 Services proposés :</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                                    {typesReparation.slice(0, 5).map((type, idx) => (
                                        <View key={idx} style={styles.repairServiceTag}>
                                            <Text style={styles.repairServiceText}>{type}</Text>
                                        </View>
                                    ))}
                                    {typesReparation.length > 5 && (
                                        <View style={styles.repairServiceTag}>
                                            <Text style={styles.repairServiceText}>+{typesReparation.length - 5} autres</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* Marques supportées */}
                        {marquesSuppoortees.length > 0 && (
                            <View style={styles.repairBrands}>
                                <Text style={styles.repairSectionTitle}>📱 Marques supportées :</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                                    {marquesSuppoortees.slice(0, 6).map((marque, idx) => (
                                        <View key={idx} style={styles.repairBrandTag}>
                                            <Text style={styles.repairBrandText}>{marque}</Text>
                                        </View>
                                    ))}
                                    {marquesSuppoortees.length > 6 && (
                                        <View style={styles.repairBrandTag}>
                                            <Text style={styles.repairBrandText}>+{marquesSuppoortees.length - 6}</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* Qualité des pièces */}
                        {product.qualitePieces && (
                            <View style={styles.repairQuality}>
                                <SafeIcon name="star" size={14} color="#F59E0B" />
                                <Text style={styles.repairQualityText}>{product.qualitePieces}</Text>
                            </View>
                        )}

                        {/* Certifications & Compétences */}
                        {certifications.length > 0 && (
                            <View style={styles.repairCertifications}>
                                <Text style={styles.repairSectionTitle}>🎓 Certifications :</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                                    {certifications.slice(0, 4).map((cert, idx) => (
                                        <View key={idx} style={styles.repairCertTag}>
                                            <SafeIcon name="award" size={10} color="#6366F1" />
                                            <Text style={styles.repairCertText}>{cert}</Text>
                                        </View>
                                    ))}
                                    {certifications.length > 4 && (
                                        <View style={styles.repairCertTag}>
                                            <Text style={styles.repairCertText}>+{certifications.length - 4}</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* Prix estimatif */}
                        {product.prixEstimatif && (
                            <View style={styles.repairPrice}>
                                <SafeIcon name="tag" size={14} color="#6B7280" />
                                <Text style={styles.repairPriceText}>Prix estimatif : {product.prixEstimatif}</Text>
                            </View>
                        )}

                        {/* Services additionnels */}
                        {(product.paiementMobileMoney || product.pretTelephone || product.rachatTelephone) && (
                            <View style={styles.repairExtras}>
                                {product.paiementMobileMoney && (
                                    <View style={styles.repairExtraTag}>
                                        <SafeIcon name="smartphone" size={10} color="#059669" />
                                        <Text style={styles.repairExtraText}>Mobile Money</Text>
                                    </View>
                                )}
                                {product.pretTelephone && (
                                    <View style={styles.repairExtraTag}>
                                        <SafeIcon name="repeat" size={10} color="#059669" />
                                        <Text style={styles.repairExtraText}>Prêt téléphone</Text>
                                    </View>
                                )}
                                {product.rachatTelephone && (
                                    <View style={styles.repairExtraTag}>
                                        <SafeIcon name="dollar-sign" size={10} color="#059669" />
                                        <Text style={styles.repairExtraText}>Rachat ancien</Text>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* Type d'intervention */}
                        {product.typeIntervention && (
                            <View style={styles.repairIntervention}>
                                <SafeIcon name="map-pin" size={14} color="#6B7280" />
                                <Text style={styles.repairInterventionText}>{product.typeIntervention}</Text>
                            </View>
                        )}
                    </View>
                );
            }

            case 'reparateur_informatique': {
                // ✅ RÉPARATEUR INFORMATIQUE - Rendu spécialisé services (ordinateurs, imprimantes)
                const getDelaiColorInfo = (delai: string) => {
                    if (delai?.includes('Express') || delai?.includes('30 min')) return { bg: '#FEE2E2', text: '#991B1B', border: '#EF4444' };
                    if (delai?.includes('Rapide') || delai?.includes('même jour')) return { bg: '#FED7AA', text: '#9A3412', border: '#F97316' };
                    if (delai?.includes('Standard') || delai?.includes('1-3 jours')) return { bg: '#E0F2FE', text: '#075985', border: '#0EA5E9' };
                    if (delai?.includes('Complexe')) return { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B' };
                    return { bg: '#F3F4F6', text: '#374151', border: '#9CA3AF' };
                };

                const getGarantieColorInfo = (garantie: string) => {
                    if (garantie?.includes('1 an')) return { bg: '#D1FAE5', text: '#065F46', border: '#10B981' };
                    if (garantie?.includes('6 mois')) return { bg: '#DBEAFE', text: '#1E40AF', border: '#3B82F6' };
                    if (garantie?.includes('3 mois')) return { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B' };
                    if (garantie?.includes('1 mois')) return { bg: '#FED7AA', text: '#9A3412', border: '#F97316' };
                    return { bg: '#F3F4F6', text: '#374151', border: '#9CA3AF' };
                };

                const delaiColorInfo = product.delaiReparationInfo ? getDelaiColorInfo(product.delaiReparationInfo) : null;
                const garantieColorInfo = product.garantieReparation ? getGarantieColorInfo(product.garantieReparation) : null;

                // Extraire les types de réparation
                let typesReparationInfo = [];
                if (Array.isArray(product.typesReparationInfo)) {
                    typesReparationInfo = product.typesReparationInfo;
                } else if (typeof product.typesReparationInfo === 'string') {
                    try {
                        typesReparationInfo = JSON.parse(product.typesReparationInfo);
                    } catch {
                        typesReparationInfo = [product.typesReparationInfo];
                    }
                }

                // Extraire les marques ordinateurs supportées
                let marquesOrdinateursReparees = [];
                if (Array.isArray(product.marquesOrdinateursReparees)) {
                    marquesOrdinateursReparees = product.marquesOrdinateursReparees;
                } else if (typeof product.marquesOrdinateursReparees === 'string') {
                    try {
                        marquesOrdinateursReparees = JSON.parse(product.marquesOrdinateursReparees);
                    } catch {
                        marquesOrdinateursReparees = [product.marquesOrdinateursReparees];
                    }
                }

                // Extraire les marques imprimantes supportées
                let marquesImprimantesReparees = [];
                if (Array.isArray(product.marquesImprimantesReparees)) {
                    marquesImprimantesReparees = product.marquesImprimantesReparees;
                } else if (typeof product.marquesImprimantesReparees === 'string') {
                    try {
                        marquesImprimantesReparees = JSON.parse(product.marquesImprimantesReparees);
                    } catch {
                        marquesImprimantesReparees = [product.marquesImprimantesReparees];
                    }
                }

                // Extraire les certifications
                let certificationsInfo = [];
                if (Array.isArray(product.certificationsInfo)) {
                    certificationsInfo = product.certificationsInfo;
                } else if (typeof product.certificationsInfo === 'string') {
                    try {
                        certificationsInfo = JSON.parse(product.certificationsInfo);
                    } catch {
                        certificationsInfo = [product.certificationsInfo];
                    }
                }

                return (
                    <View style={{ gap: 12 }}>
                        {/* Badges Délai + Garantie */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {product.delaiReparationInfo && delaiColorInfo && (
                                <View style={[styles.repairBadge, { backgroundColor: delaiColorInfo.bg, borderColor: delaiColorInfo.border }]}>
                                    <SafeIcon name="clock" size={12} color={delaiColorInfo.text} />
                                    <Text style={[styles.repairBadgeText, { color: delaiColorInfo.text }]}>
                                        {product.delaiReparationInfo}
                                    </Text>
                                </View>
                            )}
                            {product.garantieReparation && garantieColorInfo && (
                                <View style={[styles.repairBadge, { backgroundColor: garantieColorInfo.bg, borderColor: garantieColorInfo.border }]}>
                                    <SafeIcon name="shield-check" size={12} color={garantieColorInfo.text} />
                                    <Text style={[styles.repairBadgeText, { color: garantieColorInfo.text }]}>
                                        Garantie {product.garantieReparation}
                                    </Text>
                                </View>
                            )}
                            {product.tarifDiagnostic?.includes('Gratuit') && (
                                <View style={styles.repairFreeBadge}>
                                    <SafeIcon name="check-circle" size={12} color="#059669" />
                                    <Text style={styles.repairFreeText}>Diagnostic gratuit</Text>
                                </View>
                            )}
                        </View>

                        {/* Types de réparation */}
                        {typesReparationInfo.length > 0 && (
                            <View style={styles.repairTypes}>
                                <Text style={styles.repairTypesTitle}>Services proposés:</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                                    {typesReparationInfo.slice(0, 4).map((type, idx) => (
                                        <View key={idx} style={styles.repairTypeTag}>
                                            <Text style={styles.repairTypeText}>
                                                {type.includes('écran') && '💻 '}
                                                {type.includes('virus') && '🦠 '}
                                                {type.includes('Windows') && '🪟 '}
                                                {type.includes('RAM') && '🧠 '}
                                                {type.includes('SSD') && '💾 '}
                                                {type.includes('imprimante') && '🖨️ '}
                                                {type.replace(/💻|🦠|🪟|🧠|💾|🖨️/g, '').trim()}
                                            </Text>
                                        </View>
                                    ))}
                                    {typesReparationInfo.length > 4 && (
                                        <View style={styles.repairTypeTag}>
                                            <Text style={styles.repairTypeText}>+{typesReparationInfo.length - 4}</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* Marques Ordinateurs supportées */}
                        {marquesOrdinateursReparees.length > 0 && (
                            <View style={styles.repairMarques}>
                                <Text style={styles.repairMarquesTitle}>💻 Ordinateurs:</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                                    {marquesOrdinateursReparees.slice(0, 5).map((marque, idx) => (
                                        <View key={idx} style={styles.repairMarqueTag}>
                                            <Text style={styles.repairMarqueText}>{marque}</Text>
                                        </View>
                                    ))}
                                    {marquesOrdinateursReparees.length > 5 && (
                                        <View style={styles.repairMarqueTag}>
                                            <Text style={styles.repairMarqueText}>+{marquesOrdinateursReparees.length - 5}</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* Marques Imprimantes supportées */}
                        {marquesImprimantesReparees.length > 0 && (
                            <View style={styles.repairMarques}>
                                <Text style={styles.repairMarquesTitle}>🖨️ Imprimantes:</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                                    {marquesImprimantesReparees.slice(0, 4).map((marque, idx) => (
                                        <View key={idx} style={styles.repairMarqueTag}>
                                            <Text style={styles.repairMarqueText}>{marque}</Text>
                                        </View>
                                    ))}
                                    {marquesImprimantesReparees.length > 4 && (
                                        <View style={styles.repairMarqueTag}>
                                            <Text style={styles.repairMarqueText}>+{marquesImprimantesReparees.length - 4}</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* Certifications */}
                        {certificationsInfo.length > 0 && (
                            <View style={styles.repairCertifications}>
                                {certificationsInfo.slice(0, 3).map((cert, idx) => (
                                    <View key={idx} style={styles.repairCertTag}>
                                        <Text style={styles.repairCertText}>
                                            {cert.includes('HP') && '🏅 '}
                                            {cert.includes('Dell') && '🏅 '}
                                            {cert.includes('Apple') && '🏅 '}
                                            {cert.includes('CompTIA') && '🎓 '}
                                            {cert.includes('Microsoft') && '🎓 '}
                                            {cert.includes('10 ans') && '🏆 '}
                                            {cert.includes('5 ans') && '🏆 '}
                                            {cert.replace(/🏅|🎓|🏆/g, '').trim()}
                                        </Text>
                                    </View>
                                ))}
                                {certificationsInfo.length > 3 && (
                                    <View style={styles.repairCertTag}>
                                        <Text style={styles.repairCertText}>+{certificationsInfo.length - 3}</Text>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* Services additionnels */}
                        {product.servicesAdditionnelsInfo && product.servicesAdditionnelsInfo.length > 0 && (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                                {product.interventionDomicile && (
                                    <View style={styles.repairExtraBadge}>
                                        <SafeIcon name="home" size={10} color="#059669" />
                                        <Text style={styles.repairExtraText}>Domicile</Text>
                                    </View>
                                )}
                                {product.supportDistance && (
                                    <View style={styles.repairExtraBadge}>
                                        <SafeIcon name="smartphone" size={10} color="#059669" />
                                        <Text style={styles.repairExtraText}>À distance</Text>
                                    </View>
                                )}
                                {product.paiementMobileMoney && (
                                    <View style={styles.repairExtraBadge}>
                                        <SafeIcon name="dollar-sign" size={10} color="#059669" />
                                        <Text style={styles.repairExtraText}>Mobile Money</Text>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* Années d'expérience */}
                        {product.anneesExperienceReparation && (
                            <View style={styles.repairExperience}>
                                <SafeIcon name="award" size={14} color="#6B7280" />
                                <Text style={styles.repairExperienceText}>Expérience: {product.anneesExperienceReparation}</Text>
                            </View>
                        )}
                    </View>
                );
            }

            case 'reparateur_electromenager': {
                // ✅ RÉPARATEUR ÉLECTROMÉNAGER - Rendu spécialisé services (frigos, cuisinières, lave-linge)
                const getDelaiColorElectro = (delai: string) => {
                    if (delai?.includes('Express') || delai?.includes('même jour')) return { bg: '#FEE2E2', text: '#991B1B', border: '#EF4444' };
                    if (delai?.includes('Rapide') || delai?.includes('24-48h')) return { bg: '#FED7AA', text: '#9A3412', border: '#F97316' };
                    if (delai?.includes('Standard')) return { bg: '#E0F2FE', text: '#075985', border: '#0EA5E9' };
                    return { bg: '#F3F4F6', text: '#374151', border: '#9CA3AF' };
                };

                const getGarantieColorElectro = (garantie: string) => {
                    if (garantie?.includes('1 an')) return { bg: '#D1FAE5', text: '#065F46', border: '#10B981' };
                    if (garantie?.includes('6 mois')) return { bg: '#DBEAFE', text: '#1E40AF', border: '#3B82F6' };
                    if (garantie?.includes('3 mois')) return { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B' };
                    if (garantie?.includes('1 mois')) return { bg: '#FED7AA', text: '#9A3412', border: '#F97316' };
                    return { bg: '#F3F4F6', text: '#374151', border: '#9CA3AF' };
                };

                const delaiColorElectro = product.delaiReparationElectro ? getDelaiColorElectro(product.delaiReparationElectro) : null;
                const garantieColorElectro = product.garantieReparationElectro ? getGarantieColorElectro(product.garantieReparationElectro) : null;

                // Extraire les types de réparation
                let typesReparationElectro = [];
                if (Array.isArray(product.typesReparationElectro)) {
                    typesReparationElectro = product.typesReparationElectro;
                } else if (typeof product.typesReparationElectro === 'string') {
                    try {
                        typesReparationElectro = JSON.parse(product.typesReparationElectro);
                    } catch {
                        typesReparationElectro = [product.typesReparationElectro];
                    }
                }

                // Extraire les marques supportées
                let marquesElectromenagerReparees = [];
                if (Array.isArray(product.marquesElectromenagerReparees)) {
                    marquesElectromenagerReparees = product.marquesElectromenagerReparees;
                } else if (typeof product.marquesElectromenagerReparees === 'string') {
                    try {
                        marquesElectromenagerReparees = JSON.parse(product.marquesElectromenagerReparees);
                    } catch {
                        marquesElectromenagerReparees = [product.marquesElectromenagerReparees];
                    }
                }

                // Extraire les types d'appareils
                let typesAppareilsElectro = [];
                if (Array.isArray(product.typesAppareilsElectro)) {
                    typesAppareilsElectro = product.typesAppareilsElectro;
                } else if (typeof product.typesAppareilsElectro === 'string') {
                    try {
                        typesAppareilsElectro = JSON.parse(product.typesAppareilsElectro);
                    } catch {
                        typesAppareilsElectro = [product.typesAppareilsElectro];
                    }
                }

                // Extraire les certifications
                let certificationsElectro = [];
                if (Array.isArray(product.certificationsElectro)) {
                    certificationsElectro = product.certificationsElectro;
                } else if (typeof product.certificationsElectro === 'string') {
                    try {
                        certificationsElectro = JSON.parse(product.certificationsElectro);
                    } catch {
                        certificationsElectro = [product.certificationsElectro];
                    }
                }

                return (
                    <View style={{ gap: 12 }}>
                        {/* 🆕 AMÉLIORATION: Badge "Vérifié" pour techniciens certifiés */}
                        {certificationsElectro.length > 0 && certificationsElectro.some(cert =>
                            cert.includes('certifié') || cert.includes('Certification') || cert.includes('Agrément')
                        ) && (
                                <View style={styles.verifiedBadgeContainer}>
                                    <SafeIcon name="shield-check" size={14} color="#10B981" />
                                    <Text style={styles.verifiedBadgeText}>Technicien vérifié</Text>
                                </View>
                            )}

                        {/* Badges Délai + Garantie */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {product.delaiReparationElectro && delaiColorElectro && (
                                <View style={[styles.repairBadge, { backgroundColor: delaiColorElectro.bg, borderColor: delaiColorElectro.border }]}>
                                    <SafeIcon name="clock" size={12} color={delaiColorElectro.text} />
                                    <Text style={[styles.repairBadgeText, { color: delaiColorElectro.text }]}>
                                        {product.delaiReparationElectro}
                                    </Text>
                                </View>
                            )}
                            {product.garantieReparationElectro && garantieColorElectro && (
                                <View style={[styles.repairBadge, { backgroundColor: garantieColorElectro.bg, borderColor: garantieColorElectro.border }]}>
                                    <SafeIcon name="shield-check" size={12} color={garantieColorElectro.text} />
                                    <Text style={[styles.repairBadgeText, { color: garantieColorElectro.text }]}>
                                        Garantie {product.garantieReparationElectro}
                                    </Text>
                                </View>
                            )}
                            {product.tarifDiagnosticElectro?.includes('Gratuit') && (
                                <View style={styles.repairFreeBadge}>
                                    <SafeIcon name="check-circle" size={12} color="#059669" />
                                    <Text style={styles.repairFreeText}>Diagnostic gratuit</Text>
                                </View>
                            )}
                        </View>

                        {/* Badges spécialités */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {product.specialiteFroid && (
                                <View style={styles.repairSpecialtyBadge}>
                                    <Text style={styles.repairSpecialtyText}>❄️ Spécialiste Froid</Text>
                                </View>
                            )}
                            {product.specialiteCuisson && (
                                <View style={styles.repairSpecialtyBadge}>
                                    <Text style={styles.repairSpecialtyText}>🍳 Spécialiste Cuisson</Text>
                                </View>
                            )}
                            {product.specialiteLavage && (
                                <View style={styles.repairSpecialtyBadge}>
                                    <Text style={styles.repairSpecialtyText}>🧺 Spécialiste Lavage</Text>
                                </View>
                            )}
                        </View>

                        {/* Types d'appareils */}
                        {typesAppareilsElectro.length > 0 && (
                            <View style={styles.repairTypes}>
                                <Text style={styles.repairTypesTitle}>Appareils réparés:</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                                    {typesAppareilsElectro.slice(0, 4).map((appareil, idx) => (
                                        <View key={idx} style={styles.repairTypeTag}>
                                            <Text style={styles.repairTypeText}>
                                                {appareil.includes('Réfrigérateur') && '❄️ '}
                                                {appareil.includes('Cuisinière') && '🍳 '}
                                                {appareil.includes('Lave-linge') && '🧺 '}
                                                {appareil.includes('Climatiseur') && '🌬️ '}
                                                {appareil.includes('café') && '☕ '}
                                                {appareil.replace(/❄️|🍳|🧺|🌬️|☕/g, '').trim()}
                                            </Text>
                                        </View>
                                    ))}
                                    {typesAppareilsElectro.length > 4 && (
                                        <View style={styles.repairTypeTag}>
                                            <Text style={styles.repairTypeText}>+{typesAppareilsElectro.length - 4}</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* Marques supportées */}
                        {marquesElectromenagerReparees.length > 0 && (
                            <View style={styles.repairMarques}>
                                <Text style={styles.repairMarquesTitle}>Marques supportées:</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                                    {marquesElectromenagerReparees.slice(0, 6).map((marque, idx) => (
                                        <View key={idx} style={styles.repairMarqueTag}>
                                            <Text style={styles.repairMarqueText}>{marque}</Text>
                                        </View>
                                    ))}
                                    {marquesElectromenagerReparees.length > 6 && (
                                        <View style={styles.repairMarqueTag}>
                                            <Text style={styles.repairMarqueText}>+{marquesElectromenagerReparees.length - 6}</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* Certifications */}
                        {certificationsElectro.length > 0 && (
                            <View style={styles.repairCertifications}>
                                {certificationsElectro.slice(0, 3).map((cert, idx) => (
                                    <View key={idx} style={styles.repairCertTag}>
                                        <Text style={styles.repairCertText}>
                                            {cert.includes('Frigoriste') && '🏅 '}
                                            {cert.includes('gaz') && '🏅 '}
                                            {cert.includes('10 ans') && '🏆 '}
                                            {cert.includes('5 ans') && '🏆 '}
                                            {cert.replace(/🏅|🏆/g, '').trim()}
                                        </Text>
                                    </View>
                                ))}
                                {certificationsElectro.length > 3 && (
                                    <View style={styles.repairCertTag}>
                                        <Text style={styles.repairCertText}>+{certificationsElectro.length - 3}</Text>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* Services additionnels */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                            {product.interventionDomicileElectro && (
                                <View style={styles.repairExtraBadge}>
                                    <SafeIcon name="home" size={10} color="#059669" />
                                    <Text style={styles.repairExtraText}>Domicile</Text>
                                </View>
                            )}
                            {product.urgenceDisponibleElectro && (
                                <View style={styles.repairExtraBadge}>
                                    <SafeIcon name="zap" size={10} color="#059669" />
                                    <Text style={styles.repairExtraText}>Urgence 24/7</Text>
                                </View>
                            )}
                            {product.paiementMobileMoneyElectro && (
                                <View style={styles.repairExtraBadge}>
                                    <SafeIcon name="dollar-sign" size={10} color="#059669" />
                                    <Text style={styles.repairExtraText}>Mobile Money</Text>
                                </View>
                            )}
                        </View>

                        {/* Années d'expérience */}
                        {product.anneesExperienceElectro && (
                            <View style={styles.repairExperience}>
                                <SafeIcon name="award" size={14} color="#6B7280" />
                                <Text style={styles.repairExperienceText}>Expérience: {product.anneesExperienceElectro}</Text>
                            </View>
                        )}
                    </View>
                );
            }

            case 'ordinateur': {
                // ✅ ORDINATEUR - Rendu optimisé avec badges specs
                const getEtatColorPC = (etat: string) => {
                    if (etat?.includes('Neuf')) return { bg: '#D1FAE5', text: '#065F46', border: '#10B981' };
                    if (etat?.includes('Reconditionné')) return { bg: '#DBEAFE', text: '#1E40AF', border: '#3B82F6' };
                    if (etat?.includes('Excellent')) return { bg: '#E0E7FF', text: '#3730A3', border: '#6366F1' };
                    if (etat?.includes('Bon')) return { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B' };
                    return { bg: '#F3F4F6', text: '#374151', border: '#9CA3AF' };
                };

                const etatColor = product.etatOrdinateur ? getEtatColorPC(product.etatOrdinateur) : null;

                return (
                    <View style={{ gap: 12 }}>
                        {/* Badges État + Usage */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {product.etatOrdinateur && etatColor && (
                                <View style={[styles.pcBadge, { backgroundColor: etatColor.bg, borderColor: etatColor.border }]}>
                                    <Text style={[styles.pcBadgeText, { color: etatColor.text }]}>
                                        {product.etatOrdinateur}
                                    </Text>
                                </View>
                            )}
                            {product.usage && (
                                <View style={styles.pcUsageBadge}>
                                    <Text style={styles.pcUsageText}>{product.usage}</Text>
                                </View>
                            )}
                            {product.anneeAchatOrdinateur && parseInt(product.anneeAchatOrdinateur) >= 2022 && (
                                <View style={styles.pcRecentBadge}>
                                    <SafeIcon name="zap" size={12} color="#059669" />
                                    <Text style={styles.pcRecentText}>Récent {product.anneeAchatOrdinateur}</Text>
                                </View>
                            )}
                        </View>

                        {/* Identité */}
                        <View style={styles.pcIdentity}>
                            <Text style={styles.pcIdentityText}>
                                💻 {product.typeOrdinateur || ''} {product.marqueOrdinateur || ''} {product.modeleOrdinateur || ''}
                            </Text>
                        </View>

                        {/* Specs principales */}
                        <View style={styles.pcSpecs}>
                            {product.processeur && (
                                <View style={styles.pcSpecItem}>
                                    <SafeIcon name="cpu" size={16} color="#6B7280" />
                                    <Text style={styles.pcSpecLabel}>{product.processeur}</Text>
                                </View>
                            )}
                            {product.ramOrdinateur && (
                                <View style={styles.pcSpecItem}>
                                    <Text style={styles.pcSpecLabel}>RAM: {product.ramOrdinateur}</Text>
                                </View>
                            )}
                            {product.stockageOrdinateur && (
                                <View style={styles.pcSpecItem}>
                                    <SafeIcon name="hard-drive" size={16} color="#6B7280" />
                                    <Text style={styles.pcSpecLabel}>{product.stockageOrdinateur}</Text>
                                </View>
                            )}
                            {product.carteGraphique && (
                                <View style={styles.pcSpecItem}>
                                    <Text style={styles.pcSpecLabel}>GPU: {product.carteGraphique}</Text>
                                </View>
                            )}
                            {product.tailleEcranOrdinateur && (
                                <View style={styles.pcSpecItem}>
                                    <SafeIcon name="monitor" size={16} color="#6B7280" />
                                    <Text style={styles.pcSpecLabel}>{product.tailleEcranOrdinateur}</Text>
                                </View>
                            )}
                            {product.systemeExploitation && (
                                <View style={styles.pcSpecItem}>
                                    <Text style={styles.pcSpecLabel}>OS: {product.systemeExploitation}</Text>
                                </View>
                            )}
                        </View>

                        {/* Badges confiance */}
                        {(product.boiteOriginaleOrdinateur || product.factureOrdinateur || product.garantieConstructeurOrdinateur) && (
                            <View style={styles.pcConfiance}>
                                {product.boiteOriginaleOrdinateur && (
                                    <View style={styles.pcConfianceTag}>
                                        <SafeIcon name="box" size={12} color="#059669" />
                                        <Text style={styles.pcConfianceText}>Boîte origine</Text>
                                    </View>
                                )}
                                {product.factureOrdinateur && (
                                    <View style={styles.pcConfianceTag}>
                                        <SafeIcon name="file-text" size={12} color="#059669" />
                                        <Text style={styles.pcConfianceText}>Facture</Text>
                                    </View>
                                )}
                                {product.garantieConstructeurOrdinateur && (
                                    <View style={styles.pcConfianceTag}>
                                        <SafeIcon name="shield-check" size={12} color="#059669" />
                                        <Text style={styles.pcConfianceText}>Garantie constructeur</Text>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* Logiciels inclus */}
                        {product.logicielsInclus && product.logicielsInclus.length > 0 && (
                            <View style={styles.pcLogiciels}>
                                <Text style={styles.pcLogicielsTitle}>Logiciels inclus :</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                                    {product.logicielsInclus.slice(0, 3).map((logiciel, idx) => (
                                        <View key={idx} style={styles.pcLogicielTag}>
                                            <Text style={styles.pcLogicielText}>{logiciel}</Text>
                                        </View>
                                    ))}
                                    {product.logicielsInclus.length > 3 && (
                                        <View style={styles.pcLogicielTag}>
                                            <Text style={styles.pcLogicielText}>+{product.logicielsInclus.length - 3}</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* ✅ NOUVEAU: Caractéristiques spéciales (toggles) */}
                        {(product.typeSSD || product.touchscreen || product.webcam || product.portUSBC || product.bluetooth || product.wifi) && (
                            <View style={styles.pcFeatures}>
                                <Text style={styles.pcLogicielsTitle}>Caractéristiques :</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                                    {product.typeSSD && (
                                        <View style={styles.pcFeatureTag}>
                                            <SafeIcon name="zap" size={12} color="#6366F1" />
                                            <Text style={styles.pcFeatureText}>SSD Rapide</Text>
                                        </View>
                                    )}
                                    {product.touchscreen && (
                                        <View style={styles.pcFeatureTag}>
                                            <SafeIcon name="touchscreen" size={12} color="#6366F1" />
                                            <Text style={styles.pcFeatureText}>Écran tactile</Text>
                                        </View>
                                    )}
                                    {product.webcam && (
                                        <View style={styles.pcFeatureTag}>
                                            <SafeIcon name="camera" size={12} color="#6366F1" />
                                            <Text style={styles.pcFeatureText}>Webcam</Text>
                                        </View>
                                    )}
                                    {product.portUSBC && (
                                        <View style={styles.pcFeatureTag}>
                                            <SafeIcon name="usb" size={12} color="#6366F1" />
                                            <Text style={styles.pcFeatureText}>USB-C</Text>
                                        </View>
                                    )}
                                    {product.bluetooth && (
                                        <View style={styles.pcFeatureTag}>
                                            <SafeIcon name="radio" size={12} color="#6366F1" />
                                            <Text style={styles.pcFeatureText}>Bluetooth</Text>
                                        </View>
                                    )}
                                    {product.wifi && (
                                        <View style={styles.pcFeatureTag}>
                                            <SafeIcon name="wifi" size={12} color="#6366F1" />
                                            <Text style={styles.pcFeatureText}>WiFi</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        )}
                    </View>
                );
            }

            case 'decoration':
                return (
                    <View style={styles.detailsGrid}>
                        {product.categorieDecoration && (
                            <View style={styles.detailChip}>
                                <Text style={styles.detailText}>🖼️ {product.categorieDecoration}</Text>
                            </View>
                        )}
                        {product.styleDecoration && (
                            <View style={styles.detailChip}>
                                <Text style={styles.detailText}>✨ {product.styleDecoration}</Text>
                            </View>
                        )}
                        {product.pieceDecoration && (
                            <View style={styles.detailChip}>
                                <Text style={styles.detailText}>🏠 {product.pieceDecoration}</Text>
                            </View>
                        )}
                        {product.matiereDecoration && (
                            <View style={styles.detailChip}>
                                <Text style={styles.detailText}>📦 {product.matiereDecoration}</Text>
                            </View>
                        )}
                        {product.couleurDecoration && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="droplet" size={14} color="#6B7280" />
                                <Text style={styles.detailText}>{product.couleurDecoration}</Text>
                            </View>
                        )}
                        {product.tailleDecoration && (
                            <View style={styles.detailChip}>
                                <Text style={styles.detailText}>📏 {product.tailleDecoration}</Text>
                            </View>
                        )}
                        {product.etatDecoration && (
                            <View style={styles.detailChip}>
                                <Text style={styles.detailText}>✅ {product.etatDecoration}</Text>
                            </View>
                        )}
                        {product.marqueDecoration && (
                            <View style={styles.detailChip}>
                                <Text style={styles.detailText}>🏷️ {product.marqueDecoration}</Text>
                            </View>
                        )}
                        {/* Legacy */}
                        {!product.categorieDecoration && product.typeDecoration && (
                            <View style={styles.detailChip}>
                                <Text style={styles.detailText}>🖼️ {product.typeDecoration}</Text>
                            </View>
                        )}
                    </View>
                );

            case 'ustensiles_cuisine': {
                // Couleurs pour l'état
                const getEtatColorUstensile = (etat: string) => {
                    if (etat?.includes('Neuf scellé')) return { bg: '#D1FAE5', text: '#065F46', border: '#10B981', icon: '🆕' };
                    if (etat?.includes('Neuf sans emballage')) return { bg: '#DBEAFE', text: '#1E40AF', border: '#3B82F6', icon: '📦' };
                    if (etat?.includes('Excellent')) return { bg: '#E0F2FE', text: '#075985', border: '#0EA5E9', icon: '⭐' };
                    if (etat?.includes('Bon état')) return { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B', icon: '✔️' };
                    if (etat?.includes('État correct')) return { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B', icon: '👌' };
                    if (etat?.includes('Occasion')) return { bg: '#F3F4F6', text: '#374151', border: '#9CA3AF', icon: '♻️' };
                    return { bg: '#FFEBEE', text: '#FF5722', border: '#FF5722', icon: '🍴' };
                };

                // Couleurs pour les catégories
                const getCategorieColorUstensile = (categorie: string) => {
                    if (categorie?.includes('traditionnel')) return { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B', icon: '🌍' };
                    if (categorie?.includes('Batteries')) return { bg: '#E0F2FE', text: '#075985', border: '#0EA5E9', icon: '🍳' };
                    if (categorie?.includes('cuisson')) return { bg: '#FEE2E2', text: '#991B1B', border: '#EF4444', icon: '🔥' };
                    if (categorie?.includes('Vaisselle')) return { bg: '#F3E5F5', text: '#7B1FA2', border: '#9C27B0', icon: '🍽️' };
                    if (categorie?.includes('électroménagers')) return { bg: '#E0F7FA', text: '#006064', border: '#00BCD4', icon: '⚡' };
                    if (categorie?.includes('Professionnel')) return { bg: '#E8F5E9', text: '#2E7D32', border: '#4CAF50', icon: '👨‍🍳' };
                    return { bg: '#FFEBEE', text: '#FF5722', border: '#FF5722', icon: '🍴' };
                };

                const etatColorUstensile = product.etatUstensile ? getEtatColorUstensile(product.etatUstensile) : null;
                const categorieColorUstensile = product.categorieUstensile ? getCategorieColorUstensile(product.categorieUstensile) : null;

                return (
                    <View style={{ gap: 12 }}>
                        {/* Ligne 1 : Nom du produit (si disponible) */}
                        {product.nomProduitUstensile && (
                            <View style={styles.immoIdentity}>
                                <Text style={styles.immoTypeText}>
                                    🍴 {product.nomProduitUstensile}
                                </Text>
                            </View>
                        )}

                        {/* Ligne 2 : Catégorie + État + Usage */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {product.categorieUstensile && categorieColorUstensile && (
                                <View style={[styles.immoStatutChip, { backgroundColor: categorieColorUstensile.bg, borderColor: categorieColorUstensile.border }]}>
                                    <Text style={[styles.immoStatutText, { color: categorieColorUstensile.text }]}>
                                        {categorieColorUstensile.icon} {product.categorieUstensile}
                                    </Text>
                                </View>
                            )}
                            {product.etatUstensile && etatColorUstensile && (
                                <View style={[styles.immoEtatChip, { backgroundColor: etatColorUstensile.bg, borderColor: etatColorUstensile.border }]}>
                                    <Text style={[styles.immoEtatText, { color: etatColorUstensile.text }]}>
                                        {etatColorUstensile.icon} {product.etatUstensile}
                                    </Text>
                                </View>
                            )}
                            {product.usageUstensile && (
                                <View style={[styles.immoStandingChip, { backgroundColor: '#F3E8FF', borderColor: '#A855F7' }]}>
                                    <Text style={[styles.immoStandingText, { color: '#6B21A8' }]}>
                                        {product.usageUstensile?.includes('Professionnel') ? '👨‍🍳' :
                                            product.usageUstensile?.includes('traditionnel') ? '🌍' :
                                                product.usageUstensile?.includes('Événementiel') ? '🎪' : '🏠'} {product.usageUstensile}
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Ligne 3 : Caractéristiques principales */}
                        <View style={styles.immoMainInfo}>
                            {product.typeUstensile && (
                                <View style={styles.immoInfoItem}>
                                    <SafeIcon name="coffee" size={16} color="#6B7280" />
                                    <Text style={styles.immoInfoLabel}>{product.typeUstensile}</Text>
                                </View>
                            )}
                            {product.materiauUstensile && (
                                <View style={styles.immoInfoItem}>
                                    <SafeIcon name="box" size={16} color="#6B7280" />
                                    <Text style={styles.immoInfoLabel}>{product.materiauUstensile}</Text>
                                </View>
                            )}
                            {product.capaciteUstensile && (
                                <View style={styles.immoInfoItem}>
                                    <SafeIcon name="maximize-2" size={16} color="#6B7280" />
                                    <Text style={styles.immoInfoLabel}>{product.capaciteUstensile}</Text>
                                </View>
                            )}
                            {product.piecesDansSet && product.piecesDansSet !== '1 pièce (ustensile unique)' && (
                                <View style={styles.immoInfoItem}>
                                    <SafeIcon name="layers" size={16} color="#6B7280" />
                                    <Text style={styles.immoInfoLabel}>{product.piecesDansSet}</Text>
                                </View>
                            )}
                        </View>

                        {/* Ligne 4 : Marque */}
                        {product.marqueUstensile && (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                <View style={{
                                    backgroundColor: '#FFEBEE',
                                    borderColor: '#FF5722',
                                    borderWidth: 1.5,
                                    borderRadius: 12,
                                    paddingHorizontal: 12,
                                    paddingVertical: 6,
                                }}>
                                    <Text style={{
                                        color: '#FF5722',
                                        fontSize: 13,
                                        fontWeight: '600',
                                    }}>
                                        🏷️ {product.marqueUstensile}
                                    </Text>
                                </View>
                            </View>
                        )}

                        {/* Ligne 5 : Compatibilités */}
                        {product.compatibiliteUstensile && product.compatibiliteUstensile.length > 0 && (
                            <View style={{ gap: 4 }}>
                                <Text style={{ fontSize: 11, color: '#6B7280', fontWeight: '600' }}>
                                    Compatibilités :
                                </Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                                    {product.compatibiliteUstensile.map((compatibilite, index) => (
                                        <View
                                            key={index}
                                            style={{
                                                backgroundColor: '#F3F4F6',
                                                borderRadius: 8,
                                                paddingHorizontal: 8,
                                                paddingVertical: 3,
                                            }}
                                        >
                                            <Text style={{ fontSize: 10, color: '#4B5563' }}>
                                                {compatibilite === 'Tous feux' ? '🔥' :
                                                    compatibilite === 'Gaz' ? '🔥' :
                                                        compatibilite === 'Induction' ? '⚡' :
                                                            compatibilite === 'Four' ? '🔥' :
                                                                compatibilite === 'Micro-ondes' ? '📡' :
                                                                    compatibilite === 'Lave-vaisselle' ? '💧' : '✓'} {compatibilite}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}
                    </View>
                );
            }

            case 'telephone':
                // Couleurs pour l'état
                const getEtatColorTelephone = (etat: string) => {
                    if (etat?.includes('Neuf scellé')) return { bg: '#D1FAE5', text: '#065F46', border: '#10B981', icon: '🆕' };
                    if (etat?.includes('Neuf déballé')) return { bg: '#DBEAFE', text: '#1E40AF', border: '#3B82F6', icon: '📦' };
                    if (etat?.includes('Grade A+')) return { bg: '#E0F2FE', text: '#075985', border: '#0EA5E9', icon: '⭐' };
                    if (etat?.includes('Grade A')) return { bg: '#E0F2FE', text: '#075985', border: '#0EA5E9', icon: '✨' };
                    if (etat?.includes('Grade B')) return { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B', icon: '♻️' };
                    if (etat?.includes('Excellent')) return { bg: '#D1FAE5', text: '#065F46', border: '#10B981', icon: '👍' };
                    if (etat?.includes('Très bon')) return { bg: '#DBEAFE', text: '#1E40AF', border: '#3B82F6', icon: '👌' };
                    if (etat?.includes('Bon état')) return { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B', icon: '✔️' };
                    if (etat?.includes('moyen')) return { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B', icon: '⚠️' };
                    return { bg: '#F3F4F6', text: '#374151', border: '#9CA3AF', icon: '📱' };
                };

                const etatColorTelephone = product.etatTelephone
                    ? getEtatColorTelephone(product.etatTelephone)
                    : null;

                return (
                    <View style={{ gap: 12 }}>
                        {/* Ligne 1 : Marque + Modèle */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {product.marqueTelephone && (
                                <View style={{
                                    backgroundColor: '#FFF3E0',
                                    borderColor: '#FF9800',
                                    borderWidth: 1.5,
                                    borderRadius: 12,
                                    paddingHorizontal: 12,
                                    paddingVertical: 5,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 5
                                }}>
                                    <Text style={{ fontSize: 15 }}>📱</Text>
                                    <Text style={{ color: '#E65100', fontSize: 13, fontWeight: '700' }}>
                                        {product.marqueTelephone}
                                    </Text>
                                </View>
                            )}
                            {product.modeleTelephone && (
                                <View style={{
                                    backgroundColor: '#E3F2FD',
                                    borderColor: '#2196F3',
                                    borderWidth: 1,
                                    borderRadius: 12,
                                    paddingHorizontal: 10,
                                    paddingVertical: 5,
                                }}>
                                    <Text style={{ color: '#0D47A1', fontSize: 12, fontWeight: '600' }}>
                                        {product.modeleTelephone}
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Ligne 2 : Stockage + RAM */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {product.stockage && (
                                <View style={{
                                    backgroundColor: '#E8F5E9',
                                    borderColor: '#4CAF50',
                                    borderWidth: 1.5,
                                    borderRadius: 12,
                                    paddingHorizontal: 10,
                                    paddingVertical: 4,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 4
                                }}>
                                    <Text style={{ fontSize: 14 }}>💾</Text>
                                    <Text style={{ color: '#2E7D32', fontSize: 12, fontWeight: '700' }}>
                                        {product.stockage}
                                    </Text>
                                </View>
                            )}
                            {product.ram && (
                                <View style={{
                                    backgroundColor: '#F3E5F5',
                                    borderColor: '#9C27B0',
                                    borderWidth: 1,
                                    borderRadius: 12,
                                    paddingHorizontal: 10,
                                    paddingVertical: 4,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 4
                                }}>
                                    <Text style={{ fontSize: 14 }}>⚡</Text>
                                    <Text style={{ color: '#6A1B9A', fontSize: 12, fontWeight: '600' }}>
                                        RAM {product.ram}
                                    </Text>
                                </View>
                            )}
                            {product.couleurTelephone && (
                                <View style={{
                                    backgroundColor: '#FCE7F3',
                                    borderColor: '#EC4899',
                                    borderWidth: 1,
                                    borderRadius: 12,
                                    paddingHorizontal: 10,
                                    paddingVertical: 4,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 4
                                }}>
                                    <Text style={{ fontSize: 14 }}>🎨</Text>
                                    <Text style={{ color: '#9F1239', fontSize: 11, fontWeight: '500' }}>
                                        {product.couleurTelephone}
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Ligne 3 : État + Garantie */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {product.etatTelephone && etatColorTelephone && (
                                <View style={{
                                    backgroundColor: etatColorTelephone.bg,
                                    borderColor: etatColorTelephone.border,
                                    borderWidth: 1.5,
                                    borderRadius: 12,
                                    paddingHorizontal: 10,
                                    paddingVertical: 4,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 4
                                }}>
                                    <Text style={{ fontSize: 14 }}>{etatColorTelephone.icon}</Text>
                                    <Text style={{ color: etatColorTelephone.text, fontSize: 12, fontWeight: '600' }}>
                                        {product.etatTelephone}
                                    </Text>
                                </View>
                            )}
                            {product.garantieTelephone && product.garantieTelephone !== 'Aucune garantie' && (
                                <View style={{
                                    backgroundColor: '#E8F5E9',
                                    borderColor: '#4CAF50',
                                    borderWidth: 1,
                                    borderRadius: 12,
                                    paddingHorizontal: 10,
                                    paddingVertical: 4,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 4
                                }}>
                                    <Text style={{ fontSize: 14 }}>🛡️</Text>
                                    <Text style={{ color: '#2E7D32', fontSize: 11, fontWeight: '500' }}>
                                        {product.garantieTelephone}
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Ligne 4 : Caractéristiques techniques */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {product.tailleEcran && (
                                <View style={{
                                    backgroundColor: '#FFF8E1',
                                    borderColor: '#FFA000',
                                    borderWidth: 1,
                                    borderRadius: 10,
                                    paddingHorizontal: 8,
                                    paddingVertical: 3
                                }}>
                                    <Text style={{ color: '#F57F17', fontSize: 11, fontWeight: '600' }}>
                                        📐 {product.tailleEcran}
                                    </Text>
                                </View>
                            )}
                            {product.numeroCameraPrincipale && (
                                <View style={{
                                    backgroundColor: '#E1F5FE',
                                    borderColor: '#039BE5',
                                    borderWidth: 1,
                                    borderRadius: 10,
                                    paddingHorizontal: 8,
                                    paddingVertical: 3
                                }}>
                                    <Text style={{ color: '#01579B', fontSize: 11, fontWeight: '600' }}>
                                        📸 {product.numeroCameraPrincipale}
                                    </Text>
                                </View>
                            )}
                            {product.connectivite5G && (
                                <View style={{
                                    backgroundColor: '#E8EAF6',
                                    borderColor: '#5C6BC0',
                                    borderWidth: 1,
                                    borderRadius: 10,
                                    paddingHorizontal: 8,
                                    paddingVertical: 3,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 3
                                }}>
                                    <Text style={{ fontSize: 11 }}>⚡</Text>
                                    <Text style={{ color: '#283593', fontSize: 11, fontWeight: '700' }}>
                                        5G
                                    </Text>
                                </View>
                            )}
                            {product.dualSim && (
                                <View style={{
                                    backgroundColor: '#F3E5F5',
                                    borderColor: '#AB47BC',
                                    borderWidth: 1,
                                    borderRadius: 10,
                                    paddingHorizontal: 8,
                                    paddingVertical: 3
                                }}>
                                    <Text style={{ color: '#6A1B9A', fontSize: 10, fontWeight: '600' }}>
                                        📶 Dual SIM
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Ligne 5 : Opérateur + Info batterie/IMEI */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {product.operateur && !product.operateur?.includes('Débloqué') && (
                                <View style={{
                                    backgroundColor: product.operateur?.includes('Bloqué') ? '#FEE2E2' : '#E0F2FE',
                                    borderColor: product.operateur?.includes('Bloqué') ? '#EF4444' : '#0EA5E9',
                                    borderWidth: 1,
                                    borderRadius: 10,
                                    paddingHorizontal: 8,
                                    paddingVertical: 3,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 3
                                }}>
                                    <Text style={{ fontSize: 11 }}>
                                        {product.operateur?.includes('Bloqué') ? '🔒' : '📡'}
                                    </Text>
                                    <Text style={{
                                        color: product.operateur?.includes('Bloqué') ? '#991B1B' : '#075985',
                                        fontSize: 10,
                                        fontWeight: '600'
                                    }}>
                                        {product.operateur}
                                    </Text>
                                </View>
                            )}
                            {product.operateur?.includes('Débloqué') && (
                                <View style={{
                                    backgroundColor: '#D1FAE5',
                                    borderColor: '#10B981',
                                    borderWidth: 1.5,
                                    borderRadius: 10,
                                    paddingHorizontal: 8,
                                    paddingVertical: 3,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 3
                                }}>
                                    <Text style={{ fontSize: 11 }}>🔓</Text>
                                    <Text style={{ color: '#065F46', fontSize: 11, fontWeight: '700' }}>
                                        Débloqué
                                    </Text>
                                </View>
                            )}
                            {product.batterieSante && (
                                <View style={{
                                    backgroundColor: '#FFF8E1',
                                    borderColor: '#FFA000',
                                    borderWidth: 1,
                                    borderRadius: 10,
                                    paddingHorizontal: 8,
                                    paddingVertical: 3
                                }}>
                                    <Text style={{ color: '#F57F17', fontSize: 10, fontWeight: '600' }}>
                                        🔋 {product.batterieSante}% santé
                                    </Text>
                                </View>
                            )}
                            {product.boiteOriginale && (
                                <View style={{
                                    backgroundColor: '#E1F5FE',
                                    borderColor: '#0277BD',
                                    borderWidth: 1,
                                    borderRadius: 10,
                                    paddingHorizontal: 8,
                                    paddingVertical: 3
                                }}>
                                    <Text style={{ color: '#01579B', fontSize: 10, fontWeight: '500' }}>
                                        📦 Boîte originale
                                    </Text>
                                </View>
                            )}
                            {product.factureTelephone && (
                                <View style={{
                                    backgroundColor: '#E8F5E9',
                                    borderColor: '#4CAF50',
                                    borderWidth: 1,
                                    borderRadius: 10,
                                    paddingHorizontal: 8,
                                    paddingVertical: 3
                                }}>
                                    <Text style={{ color: '#2E7D32', fontSize: 10, fontWeight: '500' }}>
                                        🧾 Avec facture
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Ligne 6 : Accessoires inclus (si présents) */}
                        {product.accessoiresTelephone && product.accessoiresTelephone.length > 0 && (
                            <View style={{
                                backgroundColor: '#F9FAFB',
                                borderColor: '#D1D5DB',
                                borderWidth: 1,
                                borderRadius: 10,
                                padding: 8,
                                gap: 4
                            }}>
                                <Text style={{ color: '#4B5563', fontSize: 10, fontWeight: '700' }}>
                                    📦 Accessoires inclus :
                                </Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                                    {product.accessoiresTelephone.slice(0, 4).map((acc, index) => (
                                        <Text key={index} style={{ color: '#6B7280', fontSize: 10 }}>
                                            • {acc}
                                        </Text>
                                    ))}
                                    {product.accessoiresTelephone.length > 4 && (
                                        <Text style={{ color: '#9CA3AF', fontSize: 10, fontStyle: 'italic' }}>
                                            +{product.accessoiresTelephone.length - 4} autres
                                        </Text>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* Ligne 7 : IMEI / Sécurité (optionnel) */}
                        {(product.imei || product.ecranOriginal === false) && (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                {product.imei && (
                                    <View style={{
                                        backgroundColor: '#FFF3E0',
                                        borderColor: '#FB8C00',
                                        borderWidth: 1,
                                        borderRadius: 8,
                                        paddingHorizontal: 8,
                                        paddingVertical: 3
                                    }}>
                                        <Text style={{ color: '#E65100', fontSize: 10, fontWeight: '600' }}>
                                            🔢 IMEI: {product.imei.substring(0, 8)}***
                                        </Text>
                                    </View>
                                )}
                                {product.ecranOriginal === false && (
                                    <View style={{
                                        backgroundColor: '#FEE2E2',
                                        borderColor: '#EF4444',
                                        borderWidth: 1,
                                        borderRadius: 8,
                                        paddingHorizontal: 8,
                                        paddingVertical: 3
                                    }}>
                                        <Text style={{ color: '#991B1B', fontSize: 10, fontWeight: '600' }}>
                                            ⚠️ Écran non original
                                        </Text>
                                    </View>
                                )}
                            </View>
                        )}
                    </View>
                );

            case 'pieces_auto': {
                // Couleurs pour l'état
                const getEtatColorAuto = (etat: string) => {
                    if (etat?.includes('Neuf scellé') || etat?.includes('Neuf')) return { bg: '#D1FAE5', text: '#065F46', border: '#10B981', icon: '✨' };
                    if (etat?.includes('Excellent état')) return { bg: '#DBEAFE', text: '#1E40AF', border: '#3B82F6', icon: '🆕' };
                    if (etat?.includes('Bon état')) return { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B', icon: '👍' };
                    if (etat?.includes('Reconditionné')) return { bg: '#E0F2FE', text: '#075985', border: '#0EA5E9', icon: '♻️' };
                    if (etat?.includes('À réparer')) return { bg: '#FEE2E2', text: '#991B1B', border: '#EF4444', icon: '⚠️' };
                    return { bg: '#F3F4F6', text: '#374151', border: '#9CA3AF', icon: '📦' };
                };

                const getGarantieColor = (garantie: string) => {
                    if (garantie?.includes('2 ans') || garantie?.includes('1 an')) return { bg: '#E8F5E9', text: '#2E7D32', border: '#4CAF50', icon: '🛡️' };
                    if (garantie?.includes('6 mois') || garantie?.includes('3 mois')) return { bg: '#FFF3E0', text: '#E65100', border: '#FF9800', icon: '🛡️' };
                    if (garantie?.includes('Sans garantie') || garantie?.includes('Aucune')) return { bg: '#F3F4F6', text: '#6B7280', border: '#9CA3AF', icon: '❌' };
                    return { bg: '#E8F5E9', text: '#2E7D32', border: '#4CAF50', icon: '🛡️' };
                };

                const getOrigineColor = (origine: string) => {
                    if (origine?.includes('Allemagne') || origine?.includes('Europe (UE)')) return { bg: '#DBEAFE', text: '#1E40AF', border: '#3B82F6', icon: '🇪🇺' };
                    if (origine?.includes('France')) return { bg: '#E0F7FA', text: '#006064', border: '#00ACC1', icon: '🇫🇷' };
                    if (origine?.includes('Japon') || origine?.includes('Asie')) return { bg: '#F3E5F5', text: '#4A148C', border: '#7B1FA2', icon: '🇯🇵' };
                    if (origine?.includes('Chine')) return { bg: '#FFF3E0', text: '#E65100', border: '#FF6F00', icon: '🇨🇳' };
                    if (origine?.includes('Nigeria')) return { bg: '#E8F5E9', text: '#2E7D32', border: '#4CAF50', icon: '🇳🇬' };
                    if (origine?.includes('Cameroun')) return { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B', icon: '🇨🇲' };
                    return { bg: '#F3F4F6', text: '#374151', border: '#9CA3AF', icon: '🌍' };
                };

                const etatColorAuto = product.etatPieceAuto ? getEtatColorAuto(product.etatPieceAuto) : null;
                const garantieColor = product.garantiePiece ? getGarantieColor(product.garantiePiece) : null;
                const origineColor = product.originePiece ? getOrigineColor(product.originePiece) : null;

                return (
                    <View style={{ gap: 12 }}>
                        {/* Ligne 1 : Type + Catégorie */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {product.typePieceAuto && (
                                <View style={{
                                    backgroundColor: '#FFE5E5',
                                    borderColor: '#EF4444',
                                    borderWidth: 1,
                                    borderRadius: 12,
                                    paddingHorizontal: 10,
                                    paddingVertical: 4,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 4
                                }}>
                                    <Text style={{ fontSize: 14 }}>🔧</Text>
                                    <Text style={{ color: '#DC2626', fontSize: 12, fontWeight: '600' }}>
                                        {product.typePieceAuto}
                                    </Text>
                                </View>
                            )}
                            {product.categoriePieceAuto && (
                                <View style={{
                                    backgroundColor: '#FEF3C7',
                                    borderColor: '#F59E0B',
                                    borderWidth: 1,
                                    borderRadius: 12,
                                    paddingHorizontal: 10,
                                    paddingVertical: 4,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 4
                                }}>
                                    <Text style={{ fontSize: 14 }}>🚗</Text>
                                    <Text style={{ color: '#92400E', fontSize: 11, fontWeight: '500' }}>
                                        {product.categoriePieceAuto}
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Ligne 2 : Marque pièce + Marque véhicule */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {product.marquePieceAuto && (
                                <View style={{
                                    backgroundColor: '#E3F2FD',
                                    borderColor: '#1976D2',
                                    borderWidth: 1,
                                    borderRadius: 12,
                                    paddingHorizontal: 10,
                                    paddingVertical: 4,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 4
                                }}>
                                    <Text style={{ fontSize: 14 }}>🏭</Text>
                                    <Text style={{ color: '#0D47A1', fontSize: 12, fontWeight: '600' }}>
                                        {product.marquePieceAuto}
                                    </Text>
                                </View>
                            )}
                            {product.marqueVehiculeCompatible && (
                                <View style={{
                                    backgroundColor: '#F3E8FF',
                                    borderColor: '#8B5CF6',
                                    borderWidth: 1,
                                    borderRadius: 12,
                                    paddingHorizontal: 10,
                                    paddingVertical: 4,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 4
                                }}>
                                    <Text style={{ fontSize: 14 }}>🚙</Text>
                                    <Text style={{ color: '#6B21A8', fontSize: 11, fontWeight: '500' }}>
                                        {product.marqueVehiculeCompatible}
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Ligne 3 : Modèle véhicule + Compatibilité */}
                        {(product.modeleVehicule || product.niveauCompatibilite) && (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                {product.modeleVehicule && (
                                    <View style={{
                                        backgroundColor: '#E0F2FE',
                                        borderColor: '#0EA5E9',
                                        borderWidth: 1,
                                        borderRadius: 12,
                                        paddingHorizontal: 10,
                                        paddingVertical: 4,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 4
                                    }}>
                                        <Text style={{ fontSize: 14 }}>🚗</Text>
                                        <Text style={{ color: '#075985', fontSize: 11, fontWeight: '500' }}>
                                            {product.modeleVehicule}
                                        </Text>
                                    </View>
                                )}
                                {product.niveauCompatibilite && (
                                    <View style={{
                                        backgroundColor: '#ECFDF5',
                                        borderColor: '#10B981',
                                        borderWidth: 1,
                                        borderRadius: 12,
                                        paddingHorizontal: 10,
                                        paddingVertical: 4,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 4
                                    }}>
                                        <Text style={{ fontSize: 14 }}>✓</Text>
                                        <Text style={{ color: '#047857', fontSize: 11, fontWeight: '500' }}>
                                            {product.niveauCompatibilite}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* Ligne 4 : État + Garantie */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {product.etatPieceAuto && etatColorAuto && (
                                <View style={{
                                    backgroundColor: etatColorAuto.bg,
                                    borderColor: etatColorAuto.border,
                                    borderWidth: 1,
                                    borderRadius: 12,
                                    paddingHorizontal: 10,
                                    paddingVertical: 4,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 4
                                }}>
                                    <Text style={{ fontSize: 14 }}>{etatColorAuto.icon}</Text>
                                    <Text style={{ color: etatColorAuto.text, fontSize: 12, fontWeight: '600' }}>
                                        {product.etatPieceAuto}
                                    </Text>
                                </View>
                            )}
                            {product.garantiePiece && garantieColor && (
                                <View style={{
                                    backgroundColor: garantieColor.bg,
                                    borderColor: garantieColor.border,
                                    borderWidth: 1,
                                    borderRadius: 12,
                                    paddingHorizontal: 10,
                                    paddingVertical: 4,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 4
                                }}>
                                    <Text style={{ fontSize: 14 }}>{garantieColor.icon}</Text>
                                    <Text style={{ color: garantieColor.text, fontSize: 11, fontWeight: '500' }}>
                                        {product.garantiePiece}
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Ligne 5 : Origine + Matériau */}
                        {(product.originePiece || product.materiauPiece) && (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                {product.originePiece && origineColor && (
                                    <View style={{
                                        backgroundColor: origineColor.bg,
                                        borderColor: origineColor.border,
                                        borderWidth: 1,
                                        borderRadius: 12,
                                        paddingHorizontal: 10,
                                        paddingVertical: 4,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 4
                                    }}>
                                        <Text style={{ fontSize: 14 }}>{origineColor.icon}</Text>
                                        <Text style={{ color: origineColor.text, fontSize: 11, fontWeight: '500' }}>
                                            {product.originePiece}
                                        </Text>
                                    </View>
                                )}
                                {product.materiauPiece && (
                                    <View style={{
                                        backgroundColor: '#F3E5F5',
                                        borderColor: '#8E24AA',
                                        borderWidth: 1,
                                        borderRadius: 12,
                                        paddingHorizontal: 10,
                                        paddingVertical: 4,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 4
                                    }}>
                                        <Text style={{ fontSize: 14 }}>🧱</Text>
                                        <Text style={{ color: '#6A1B9A', fontSize: 11, fontWeight: '500' }}>
                                            {product.materiauPiece}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* Ligne 6 : Badges spéciaux */}
                        {(product.typeFournisseur || product.referencePieceAuto || product.livraisonDisponible === true) && (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                {product.typeFournisseur && (
                                    <View style={{
                                        backgroundColor: '#FFF8E1',
                                        borderColor: '#FFA000',
                                        borderWidth: 1,
                                        borderRadius: 8,
                                        paddingHorizontal: 8,
                                        paddingVertical: 4
                                    }}>
                                        <Text style={{ color: '#E65100', fontSize: 10, fontWeight: '500' }}>
                                            🏪 {product.typeFournisseur}
                                        </Text>
                                    </View>
                                )}
                                {product.referencePieceAuto && (
                                    <View style={{
                                        backgroundColor: '#E3F2FD',
                                        borderColor: '#1976D2',
                                        borderWidth: 1,
                                        borderRadius: 8,
                                        paddingHorizontal: 8,
                                        paddingVertical: 4
                                    }}>
                                        <Text style={{ color: '#0D47A1', fontSize: 10, fontWeight: '500' }}>
                                            📋 Ref: {product.referencePieceAuto}
                                        </Text>
                                    </View>
                                )}
                                {product.livraisonDisponible === true && (
                                    <View style={{
                                        backgroundColor: '#E8F5E9',
                                        borderColor: '#4CAF50',
                                        borderWidth: 1,
                                        borderRadius: 8,
                                        paddingHorizontal: 8,
                                        paddingVertical: 4
                                    }}>
                                        <Text style={{ color: '#2E7D32', fontSize: 10, fontWeight: '600' }}>
                                            🚚 Livraison disponible
                                        </Text>
                                    </View>
                                )}
                                {product.avecReference === true && (
                                    <View style={{
                                        backgroundColor: '#E8F5E9',
                                        borderColor: '#4CAF50',
                                        borderWidth: 1,
                                        borderRadius: 8,
                                        paddingHorizontal: 8,
                                        paddingVertical: 4
                                    }}>
                                        <Text style={{ color: '#2E7D32', fontSize: 10, fontWeight: '600' }}>
                                            ✅ Référence constructeur
                                        </Text>
                                    </View>
                                )}
                            </View>
                        )}
                    </View>
                );
            }

            case 'pieces_industrielles':
                // Couleurs pour l'état
                const getEtatColorIndustriel = (etat: string) => {
                    if (etat?.includes('Neuf d\'origine')) return { bg: '#D1FAE5', text: '#065F46', border: '#10B981', icon: '✨' };
                    if (etat?.includes('Neuf équivalent')) return { bg: '#DBEAFE', text: '#1E40AF', border: '#3B82F6', icon: '🆕' };
                    if (etat?.includes('Reconditionné')) return { bg: '#E0F2FE', text: '#075985', border: '#0EA5E9', icon: '♻️' };
                    if (etat?.includes('Révisé')) return { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B', icon: '🔧' };
                    if (etat?.includes('Bon état')) return { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B', icon: '👍' };
                    return { bg: '#F3F4F6', text: '#374151', border: '#9CA3AF', icon: '📦' };
                };

                const etatColorIndustriel = product.etatPieceIndustrielle
                    ? getEtatColorIndustriel(product.etatPieceIndustrielle)
                    : null;

                return (
                    <View style={{ gap: 12 }}>
                        {/* Ligne 1 : Type + Marque */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {product.typePieceIndustrielle && (
                                <View style={{
                                    backgroundColor: '#ECEFF1',
                                    borderColor: '#455A64',
                                    borderWidth: 1,
                                    borderRadius: 12,
                                    paddingHorizontal: 10,
                                    paddingVertical: 4,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 4
                                }}>
                                    <Text style={{ fontSize: 14 }}>⚙️</Text>
                                    <Text style={{ color: '#263238', fontSize: 12, fontWeight: '600' }}>
                                        {product.typePieceIndustrielle}
                                    </Text>
                                </View>
                            )}
                            {product.marquePieceIndustrielle && (
                                <View style={{
                                    backgroundColor: '#E3F2FD',
                                    borderColor: '#1976D2',
                                    borderWidth: 1,
                                    borderRadius: 12,
                                    paddingHorizontal: 10,
                                    paddingVertical: 4,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 4
                                }}>
                                    <Text style={{ fontSize: 14 }}>🏭</Text>
                                    <Text style={{ color: '#0D47A1', fontSize: 12, fontWeight: '600' }}>
                                        {product.marquePieceIndustrielle}
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Ligne 2 : Applications + Matériau */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {/* ✅ Applications industrielles (multi-select) */}
                            {(() => {
                                const applications = Array.isArray(product.applicationIndustrielle)
                                    ? product.applicationIndustrielle
                                    : typeof product.applicationIndustrielle === 'string'
                                        ? (product.applicationIndustrielle.includes(',')
                                            ? product.applicationIndustrielle.split(',').map(a => a.trim())
                                            : [product.applicationIndustrielle])
                                        : [];

                                return applications.slice(0, 2).map((app: string, idx: number) => (
                                    <View key={idx} style={{
                                        backgroundColor: '#FFF3E0',
                                        borderColor: '#F57C00',
                                        borderWidth: 1,
                                        borderRadius: 12,
                                        paddingHorizontal: 10,
                                        paddingVertical: 4,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 4
                                    }}>
                                        <Text style={{ fontSize: 14 }}>🏗️</Text>
                                        <Text style={{ color: '#E65100', fontSize: 11, fontWeight: '500' }}>
                                            {app}
                                        </Text>
                                    </View>
                                ));
                            })()}
                            {product.materielPiece && (
                                <View style={{
                                    backgroundColor: '#F3E5F5',
                                    borderColor: '#8E24AA',
                                    borderWidth: 1,
                                    borderRadius: 12,
                                    paddingHorizontal: 10,
                                    paddingVertical: 4,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 4
                                }}>
                                    <Text style={{ fontSize: 14 }}>🧱</Text>
                                    <Text style={{ color: '#6A1B9A', fontSize: 11, fontWeight: '500' }}>
                                        {product.materielPiece}
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Ligne 3 : État + Garantie */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {product.etatPieceIndustrielle && etatColorIndustriel && (
                                <View style={{
                                    backgroundColor: etatColorIndustriel.bg,
                                    borderColor: etatColorIndustriel.border,
                                    borderWidth: 1,
                                    borderRadius: 12,
                                    paddingHorizontal: 10,
                                    paddingVertical: 4,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 4
                                }}>
                                    <Text style={{ fontSize: 14 }}>{etatColorIndustriel.icon}</Text>
                                    <Text style={{ color: etatColorIndustriel.text, fontSize: 12, fontWeight: '600' }}>
                                        {product.etatPieceIndustrielle}
                                    </Text>
                                </View>
                            )}
                            {product.garantiePieceIndustrielle && product.garantiePieceIndustrielle !== 'Aucune garantie' && (
                                <View style={{
                                    backgroundColor: '#E8F5E9',
                                    borderColor: '#4CAF50',
                                    borderWidth: 1,
                                    borderRadius: 12,
                                    paddingHorizontal: 10,
                                    paddingVertical: 4,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 4
                                }}>
                                    <Text style={{ fontSize: 14 }}>🛡️</Text>
                                    <Text style={{ color: '#2E7D32', fontSize: 11, fontWeight: '500' }}>
                                        Garantie {product.garantiePieceIndustrielle}
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Ligne 4 : Référence (si présente) */}
                        {product.referencePiece && (
                            <View style={{
                                backgroundColor: '#FFF8E1',
                                borderColor: '#FFA000',
                                borderWidth: 1,
                                borderRadius: 8,
                                paddingHorizontal: 10,
                                paddingVertical: 6
                            }}>
                                <Text style={{ color: '#F57F17', fontSize: 11, fontWeight: '700' }}>
                                    📋 Réf: {product.referencePiece}
                                </Text>
                            </View>
                        )}

                        {/* Ligne 5 : Norme/Certification (si présente) */}
                        {product.normePieceIndustrielle && product.normePieceIndustrielle !== 'Sans certification' && (
                            <View style={{
                                backgroundColor: '#E1F5FE',
                                borderColor: '#0277BD',
                                borderWidth: 1,
                                borderRadius: 8,
                                paddingHorizontal: 10,
                                paddingVertical: 4,
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 4
                            }}>
                                <Text style={{ fontSize: 12 }}>✅</Text>
                                <Text style={{ color: '#01579B', fontSize: 11, fontWeight: '500' }}>
                                    Norme {product.normePieceIndustrielle}
                                </Text>
                            </View>
                        )}
                    </View>
                );

            case 'assurance':
                return (
                    <View style={styles.detailsGrid}>
                        {product.typeAssurance && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="shield" size={14} color="#14B8A6" />
                                <Text style={styles.detailText}>{product.typeAssurance}</Text>
                            </View>
                        )}
                        {product.compagnie && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="briefcase" size={14} color="#6B7280" />
                                <Text style={styles.detailText}>{product.compagnie}</Text>
                            </View>
                        )}
                        {product.couverture && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="check-circle" size={14} color="#10B981" />
                                <Text style={styles.detailText}>{product.couverture}</Text>
                            </View>
                        )}
                    </View>
                );

            case 'couturier':
                return (
                    <View style={styles.detailsSection}>
                        {/* Type de service de couture */}
                        {product.typeCouture && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="scissors" size={14} color="#EC4899" />
                                <Text style={styles.detailText}>{product.typeCouture}</Text>
                            </View>
                        )}

                        {/* Tissu et Style */}
                        <View style={styles.detailsGrid}>
                            {product.tissuCouture && (
                                <View style={styles.detailChip}>
                                    <SafeIcon name="package" size={14} color="#10B981" />
                                    <Text style={styles.detailText}>{product.tissuCouture}</Text>
                                </View>
                            )}
                            {product.styleCouture && (
                                <View style={styles.detailChip}>
                                    <SafeIcon name="sparkle" size={14} color="#F59E0B" />
                                    <Text style={styles.detailText}>{product.styleCouture}</Text>
                                </View>
                            )}
                        </View>

                        {/* Genre et Occasion */}
                        <View style={styles.detailsGrid}>
                            {product.genreCouture && (
                                <View style={styles.detailChip}>
                                    <SafeIcon name="user" size={14} color="#6366F1" />
                                    <Text style={styles.detailText}>{product.genreCouture}</Text>
                                </View>
                            )}
                            {product.occasionCouture && (
                                <View style={styles.detailChip}>
                                    <SafeIcon name="calendar" size={14} color="#EC4899" />
                                    <Text style={styles.detailText}>{product.occasionCouture}</Text>
                                </View>
                            )}
                        </View>

                        {/* Délai et Finition */}
                        <View style={styles.detailsGrid}>
                            {product.delaiCouture && (
                                <View style={styles.detailChip}>
                                    <SafeIcon name="clock" size={14} color="#3B82F6" />
                                    <Text style={styles.detailText}>{product.delaiCouture}</Text>
                                </View>
                            )}
                            {product.finitionCouture && (
                                <View style={styles.detailChip}>
                                    <SafeIcon name="star" size={14} color="#F59E0B" />
                                    <Text style={styles.detailText}>{product.finitionCouture}</Text>
                                </View>
                            )}
                        </View>

                        {/* Spécialité et Expérience */}
                        <View style={styles.detailsGrid}>
                            {product.specialiteCouturier && (
                                <View style={styles.detailChip}>
                                    <SafeIcon name="award" size={14} color="#10B981" />
                                    <Text style={styles.detailText}>{product.specialiteCouturier}</Text>
                                </View>
                            )}
                            {product.experienceCouturier && (
                                <View style={styles.detailChip}>
                                    <SafeIcon name="trending-up" size={14} color="#8B5CF6" />
                                    <Text style={styles.detailText}>{product.experienceCouturier}</Text>
                                </View>
                            )}
                        </View>
                    </View>
                );

            case 'prestation_service':
                return (
                    <View style={styles.detailsSection}>
                        {/* Catégorie et Type */}
                        <View style={styles.detailsGrid}>
                            {product.categoriePrestation && (
                                <View style={styles.detailChip}>
                                    <Text style={styles.detailText}>{product.categoriePrestation}</Text>
                                </View>
                            )}
                            {product.typePrestation && (
                                <View style={styles.detailChip}>
                                    <SafeIcon name="tag" size={14} color="#8B5CF6" />
                                    <Text style={styles.detailText}>{product.typePrestation}</Text>
                                </View>
                            )}
                        </View>

                        {/* ⚠️ NOTE : Matières, Niveaux scolaires, Préparation Concours → Catégorie "Formation & Éducation" 
                            Ces sections ont été RETIRÉES de prestation_service pour éviter toute confusion.
                            Elles sont maintenant EXCLUSIVES au case 'formation_education'. */}

                        {/* Zones d'intervention (affichage intelligent) */}
                        {(product.zonesMultiples && product.zonesMultiples.length > 0) ? (
                            <View style={styles.detailsGrid}>
                                {product.zonesMultiples.slice(0, 3).map((zone, index) => (
                                    <View key={index} style={styles.detailChip}>
                                        <SafeIcon name="map-pin" size={14} color="#10B981" />
                                        <Text style={styles.detailText}>{zone}</Text>
                                    </View>
                                ))}
                                {product.zonesMultiples.length > 3 && (
                                    <View style={styles.detailChip}>
                                        <Text style={styles.detailText}>+{product.zonesMultiples.length - 3} zones</Text>
                                    </View>
                                )}
                            </View>
                        ) : product.zoneIntervention && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="map-pin" size={14} color="#10B981" />
                                <Text style={styles.detailText}>{product.zoneIntervention}</Text>
                            </View>
                        )}

                        {/* Modalité de déplacement */}
                        {product.modaliteDeplacement && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="truck" size={14} color="#6B7280" />
                                <Text style={styles.detailText}>{product.modaliteDeplacement}</Text>
                            </View>
                        )}

                        {/* Expérience et Certifications */}
                        <View style={styles.detailsGrid}>
                            {product.niveauExperience && (
                                <View style={styles.detailChip}>
                                    <SafeIcon name="award" size={14} color="#F59E0B" />
                                    <Text style={styles.detailText}>{product.niveauExperience}</Text>
                                </View>
                            )}
                            {product.certification && (
                                <View style={styles.detailChip}>
                                    <SafeIcon name="check-circle" size={14} color="#10B981" />
                                    <Text style={styles.detailText}>{product.certification}</Text>
                                </View>
                            )}
                        </View>

                        {/* Disponibilités */}
                        <View style={styles.detailsGrid}>
                            {product.disponibilitePrestation && (
                                <View style={styles.detailChip}>
                                    <SafeIcon name="clock" size={14} color="#3B82F6" />
                                    <Text style={styles.detailText}>{product.disponibilitePrestation}</Text>
                                </View>
                            )}
                            {product.urgencesAcceptees && (
                                <View style={styles.detailChip}>
                                    <Text style={styles.detailText}>🚨 Urgences acceptées</Text>
                                </View>
                            )}
                            {product.service24h && (
                                <View style={styles.detailChip}>
                                    <Text style={styles.detailText}>⏰ 24h/24</Text>
                                </View>
                            )}
                        </View>

                        {/* Tarification */}
                        <View style={styles.detailsGrid}>
                            {product.modeTarification && (
                                <View style={styles.detailChip}>
                                    <SafeIcon name="dollar-sign" size={14} color="#10B981" />
                                    <Text style={styles.detailText}>{product.modeTarification}</Text>
                                </View>
                            )}
                            {product.prixHoraire && (
                                <View style={styles.detailChip}>
                                    <Text style={styles.detailText}>💵 {parseFloat(product.prixHoraire).toLocaleString()} FCFA/h</Text>
                                </View>
                            )}
                            {product.prixJournalier && (
                                <View style={styles.detailChip}>
                                    <Text style={styles.detailText}>💰 {parseFloat(product.prixJournalier).toLocaleString()} FCFA/jour</Text>
                                </View>
                            )}
                            {product.devisGratuit && (
                                <View style={styles.detailChip}>
                                    <Text style={styles.detailText}>📋 Devis gratuit</Text>
                                </View>
                            )}
                            {product.prixNegociable && (
                                <View style={styles.detailChip}>
                                    <Text style={styles.detailText}>💬 Prix négociable</Text>
                                </View>
                            )}
                        </View>

                        {/* Modes de paiement */}
                        {product.modesPaiement && product.modesPaiement.length > 0 && (
                            <View style={styles.detailsGrid}>
                                {product.modesPaiement.slice(0, 3).map((mode, index) => (
                                    <View key={index} style={styles.detailChip}>
                                        <SafeIcon name="credit-card" size={14} color="#6B7280" />
                                        <Text style={styles.detailText}>{mode}</Text>
                                    </View>
                                ))}
                                {product.modesPaiement.length > 3 && (
                                    <View style={styles.detailChip}>
                                        <Text style={styles.detailText}>+{product.modesPaiement.length - 3} autres</Text>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* Garanties et Assurances */}
                        <View style={styles.detailsGrid}>
                            {product.garantiePrestation && (
                                <View style={styles.detailChip}>
                                    <SafeIcon name="shield" size={14} color="#10B981" />
                                    <Text style={styles.detailText}>{product.garantiePrestation}</Text>
                                </View>
                            )}
                            {product.assuranceProfessionnelle && (
                                <View style={styles.detailChip}>
                                    <SafeIcon name="shield-check" size={14} color="#3B82F6" />
                                    <Text style={styles.detailText}>{product.assuranceProfessionnelle}</Text>
                                </View>
                            )}
                        </View>

                        {/* Équipements */}
                        {product.equipementsPrestation && product.equipementsPrestation.length > 0 && (
                            <View style={styles.detailsGrid}>
                                {product.equipementsPrestation.slice(0, 2).map((equip, index) => (
                                    <View key={index} style={styles.detailChip}>
                                        <SafeIcon name="tool" size={14} color="#6B7280" />
                                        <Text style={styles.detailText}>{equip}</Text>
                                    </View>
                                ))}
                                {product.equipementsPrestation.length > 2 && (
                                    <View style={styles.detailChip}>
                                        <Text style={styles.detailText}>+{product.equipementsPrestation.length - 2} équipements</Text>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* Langues parlées */}
                        {product.languesParlees && product.languesParlees.length > 0 && (
                            <View style={styles.detailsGrid}>
                                {product.languesParlees.slice(0, 3).map((langue, index) => (
                                    <View key={index} style={styles.detailChip}>
                                        <SafeIcon name="message-circle" size={14} color="#6B7280" />
                                        <Text style={styles.detailText}>{langue}</Text>
                                    </View>
                                ))}
                            </View>
                        )}

                        {/* Contact */}
                        <View style={styles.detailsGrid}>
                            {product.telephonePrestation && (
                                <View style={styles.detailChip}>
                                    <SafeIcon name="phone" size={14} color="#3B82F6" />
                                    <Text style={styles.detailText}>{product.telephonePrestation}</Text>
                                </View>
                            )}
                            {product.whatsappPrestation && (
                                <View style={styles.detailChip}>
                                    <SafeIcon name="message-square" size={14} color="#10B981" />
                                    <Text style={styles.detailText}>{product.whatsappPrestation}</Text>
                                </View>
                            )}
                        </View>

                        {/* Offres de service détaillées */}
                        {product.prestations && product.prestations.length > 0 && (
                            <View style={styles.prestationsContainer}>
                                <Text style={styles.prestationsSectionTitle}>💼 Offres de service :</Text>
                                {product.prestations.map((prestation, index) => (
                                    <View key={index} style={styles.prestationItem}>
                                        <View style={styles.prestationHeader}>
                                            <SafeIcon name="check-circle" size={16} color="#8B5CF6" />
                                            <Text style={styles.prestationName}>{prestation.nom}</Text>
                                        </View>
                                        {prestation.prixAPartirDe && (
                                            <Text style={styles.prestationPrice}>
                                                À partir de : {parseFloat(prestation.prixAPartirDe).toLocaleString()} FCFA
                                            </Text>
                                        )}
                                        {prestation.description && (
                                            <Text style={styles.prestationDescription} numberOfLines={2}>
                                                {prestation.description}
                                            </Text>
                                        )}
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>
                );

            case 'demenagement':
                return (
                    <View style={styles.detailsSection}>
                        {/* Type de déménagement */}
                        {product.typeDemenagement && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="truck" size={14} color="#F97316" />
                                <Text style={styles.detailText}>{product.typeDemenagement}</Text>
                            </View>
                        )}

                        {/* Trajet ou Villes */}
                        {product.trajetDemenagement && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="map-pin" size={14} color="#F97316" />
                                <Text style={styles.detailText}>{product.trajetDemenagement}</Text>
                            </View>
                        )}
                        {!product.trajetDemenagement && product.villeDepartDemenagement && product.villeArriveeDemenagement && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="map-pin" size={14} color="#F97316" />
                                <Text style={styles.detailText}>{product.villeDepartDemenagement} → {product.villeArriveeDemenagement}</Text>
                            </View>
                        )}

                        <View style={styles.detailsGrid}>
                            {/* Volume */}
                            {product.volumeDemenagement && (
                                <View style={styles.detailChip}>
                                    <SafeIcon name="package" size={14} color="#6B7280" />
                                    <Text style={styles.detailText}>{product.volumeDemenagement}</Text>
                                </View>
                            )}

                            {/* Distance */}
                            {product.distanceDemenagement && (
                                <View style={styles.detailChip}>
                                    <SafeIcon name="map" size={14} color="#6B7280" />
                                    <Text style={styles.detailText}>{product.distanceDemenagement}</Text>
                                </View>
                            )}

                            {/* Véhicule */}
                            {product.typeVehiculeDemenagement && (
                                <View style={styles.detailChip}>
                                    <Text style={styles.detailText}>🚛 {product.typeVehiculeDemenagement}</Text>
                                </View>
                            )}

                            {/* Déménageurs */}
                            {product.nbDemenageurs && (
                                <View style={styles.detailChip}>
                                    <SafeIcon name="users" size={14} color="#6B7280" />
                                    <Text style={styles.detailText}>{product.nbDemenageurs}</Text>
                                </View>
                            )}

                            {/* Durée */}
                            {product.dureeDemenagement && (
                                <View style={styles.detailChip}>
                                    <SafeIcon name="clock" size={14} color="#6B7280" />
                                    <Text style={styles.detailText}>{product.dureeDemenagement}</Text>
                                </View>
                            )}

                            {/* Disponibilité */}
                            {product.disponibiliteDemenagement && (
                                <View style={styles.detailChip}>
                                    <SafeIcon name="calendar" size={14} color="#059669" />
                                    <Text style={styles.detailText}>{product.disponibiliteDemenagement}</Text>
                                </View>
                            )}
                        </View>

                        {/* Compagnie */}
                        {product.compagnieDemenagement && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="building" size={14} color="#059669" />
                                <Text style={styles.detailText}>{product.compagnieDemenagement}</Text>
                            </View>
                        )}

                        {/* Assurance */}
                        {product.typeAssuranceDemenagement && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="shield" size={14} color="#3B82F6" />
                                <Text style={styles.detailText}>{product.typeAssuranceDemenagement}</Text>
                            </View>
                        )}

                        {/* Accessibilité */}
                        {product.accessibiliteDemenagement && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="home" size={14} color="#6B7280" />
                                <Text style={styles.detailText}>{product.accessibiliteDemenagement}</Text>
                            </View>
                        )}

                        {/* Services inclus (nouveau format) */}
                        {product.servicesDemenagement && Array.isArray(product.servicesDemenagement) && product.servicesDemenagement.length > 0 && (
                            <View style={styles.servicesInclus}>
                                <Text style={styles.prestationLabel}>Services inclus:</Text>
                                <View style={styles.servicesGrid}>
                                    {product.servicesDemenagement.map((service, idx) => (
                                        <View key={idx} style={styles.serviceTag}>
                                            <Text style={styles.serviceTagText}>✓ {service}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}

                        {/* Services inclus (ancien format - compatibilité) */}
                        {!product.servicesDemenagement && (product.assuranceMarchandise || product.serviceManutention || product.montageDemontage ||
                            product.emballageCartons || product.gardeMeuble || product.debarras) && (
                                <View style={styles.servicesInclus}>
                                    <Text style={styles.prestationLabel}>Services inclus:</Text>
                                    <View style={styles.servicesGrid}>
                                        {product.assuranceMarchandise && (
                                            <View style={styles.serviceTag}><Text style={styles.serviceTagText}>✓ Assurance</Text></View>
                                        )}
                                        {product.serviceManutention && (
                                            <View style={styles.serviceTag}><Text style={styles.serviceTagText}>✓ Manutention</Text></View>
                                        )}
                                        {product.montageDemontage && (
                                            <View style={styles.serviceTag}><Text style={styles.serviceTagText}>✓ Montage</Text></View>
                                        )}
                                        {product.emballageCartons && (
                                            <View style={styles.serviceTag}><Text style={styles.serviceTagText}>✓ Emballage</Text></View>
                                        )}
                                        {product.gardeMeuble && (
                                            <View style={styles.serviceTag}><Text style={styles.serviceTagText}>✓ Garde-meuble</Text></View>
                                        )}
                                        {product.debarras && (
                                            <View style={styles.serviceTag}><Text style={styles.serviceTagText}>✓ Débarras</Text></View>
                                        )}
                                    </View>
                                </View>
                            )}
                    </View>
                );

            case 'cosmetique_parfum':
                return (
                    <View style={styles.detailsSection}>
                        {/* Type de cosmétique (compatibilité ancien/nouveau format) */}
                        {(product.types || product.typeCosmetique) && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="sparkle" size={14} color="#EC4899" />
                                <Text style={styles.detailText}>{product.types || product.typeCosmetique}</Text>
                            </View>
                        )}

                        <View style={styles.detailsGrid}>
                            {/* Marque */}
                            {(product.marques || product.marqueCosmetique) && (
                                <View style={styles.detailChip}>
                                    <Text style={styles.detailText}>🏷️ {product.marques || product.marqueCosmetique}</Text>
                                </View>
                            )}

                            {/* Genre/Cible */}
                            {(product.genres || product.genreCosmetique) && (
                                <View style={styles.detailChip}>
                                    <SafeIcon name="users" size={14} color="#6B7280" />
                                    <Text style={styles.detailText}>{product.genres || product.genreCosmetique}</Text>
                                </View>
                            )}

                            {/* Volume */}
                            {(product.unites || (product.volumeCosmetique && product.uniteCosmetique)) && (
                                <View style={styles.detailChip}>
                                    <SafeIcon name="droplet" size={14} color="#6B7280" />
                                    <Text style={styles.detailText}>
                                        {product.unites || `${product.volumeCosmetique}${product.uniteCosmetique}`}
                                    </Text>
                                </View>
                            )}

                            {/* Concentration (parfums) */}
                            {(product.concentrations || product.concentrationCosmetique) &&
                                (product.concentrations || product.concentrationCosmetique) !== 'Non applicable' && (
                                    <View style={styles.detailChip}>
                                        <Text style={styles.detailText}>💧 {product.concentrations || product.concentrationCosmetique}</Text>
                                    </View>
                                )}

                            {/* Type de peau */}
                            {(product.types_peau || product.typePeau) && (
                                <View style={styles.detailChip}>
                                    <SafeIcon name="user" size={14} color="#6B7280" />
                                    <Text style={styles.detailText}>{product.types_peau || product.typePeau}</Text>
                                </View>
                            )}

                            {/* Type de cheveux (produits capillaires) */}
                            {(product.types_cheveux || product.typeCheveuxCosmetique) && (
                                <View style={styles.detailChip}>
                                    <Text style={styles.detailText}>💇 {product.types_cheveux || product.typeCheveuxCosmetique}</Text>
                                </View>
                            )}

                            {/* Teinte (maquillage) */}
                            {(product.teintes || product.teinteCosmetique) && (
                                <View style={styles.detailChip}>
                                    <Text style={styles.detailText}>🎨 {product.teintes || product.teinteCosmetique}</Text>
                                </View>
                            )}

                            {/* Finition (maquillage) */}
                            {(product.finitions || product.finitionCosmetique) && (
                                <View style={styles.detailChip}>
                                    <Text style={styles.detailText}>✨ {product.finitions || product.finitionCosmetique}</Text>
                                </View>
                            )}
                        </View>

                        {/* Origine */}
                        {(product.origines || product.origineCosmetique) && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="globe" size={14} color="#10B981" />
                                <Text style={styles.detailText}>Origine: {product.origines || product.origineCosmetique}</Text>
                            </View>
                        )}

                        {/* Ingrédients principaux */}
                        {(product.ingredients_principaux || product.ingredientsCosmetique) &&
                            Array.isArray(product.ingredients_principaux || product.ingredientsCosmetique) &&
                            (product.ingredients_principaux || product.ingredientsCosmetique).length > 0 && (
                                <View style={styles.ingredientsContainer}>
                                    <Text style={styles.prestationLabel}>Ingrédients:</Text>
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                                        {(product.ingredients_principaux || product.ingredientsCosmetique).map((ingredient, idx) => (
                                            <View key={idx} style={[styles.detailChip, { backgroundColor: '#F0FDF4', borderColor: '#86EFAC' }]}>
                                                <Text style={[styles.detailText, { color: '#15803D', fontSize: 11 }]}>
                                                    {ingredient}
                                                </Text>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            )}

                        {/* Certifications */}
                        {(product.certifications || product.certificationsCosmetique) &&
                            Array.isArray(product.certifications || product.certificationsCosmetique) &&
                            (product.certifications || product.certificationsCosmetique).length > 0 && (
                                <View style={styles.ingredientsContainer}>
                                    <Text style={styles.prestationLabel}>Certifications:</Text>
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                                        {(product.certifications || product.certificationsCosmetique).map((cert, idx) => (
                                            <View key={idx} style={[styles.detailChip, { backgroundColor: '#EFF6FF', borderColor: '#93C5FD' }]}>
                                                <Text style={[styles.detailText, { color: '#1E40AF', fontSize: 11 }]}>
                                                    ✓ {cert}
                                                </Text>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            )}
                    </View>
                );

            case 'jouets_enfants': {
                // Couleurs par état
                const getEtatColor = (etat: string) => {
                    if (etat?.includes('Neuf')) return { bg: '#D1FAE5', text: '#065F46', border: '#10B981' };
                    if (etat?.includes('Comme neuf') || etat?.includes('Très bon')) return { bg: '#DBEAFE', text: '#1E40AF', border: '#3B82F6' };
                    if (etat?.includes('Bon état')) return { bg: '#E0F2FE', text: '#075985', border: '#0EA5E9' };
                    if (etat?.includes('Occasion')) return { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B' };
                    return { bg: '#F3F4F6', text: '#374151', border: '#9CA3AF' };
                };

                const etatColor = product.etatJouet ? getEtatColor(product.etatJouet) : null;

                return (
                    <View style={{ gap: 12 }}>
                        {/* Badges principaux */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {/* Âge recommandé - PRIORITAIRE */}
                            {product.ageRecommande && (
                                <View style={[styles.jouetAgeBadge, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B', borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }]}>
                                    <Text style={[styles.jouetAgeText, { color: '#92400E', fontSize: 12, fontWeight: '600' }]}>
                                        🎂 {product.ageRecommande}
                                    </Text>
                                </View>
                            )}
                            {/* État */}
                            {product.etatJouet && etatColor && (
                                <View style={{ backgroundColor: etatColor.bg, borderColor: etatColor.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }}>
                                    <Text style={{ color: etatColor.text, fontSize: 12, fontWeight: '600' }}>
                                        {product.etatJouet}
                                    </Text>
                                </View>
                            )}
                            {/* Genre */}
                            {product.genreJouet && product.genreJouet !== 'Mixte/Unisexe' && (
                                <View style={{
                                    backgroundColor: product.genreJouet?.includes('fille') ? '#FCE7F3' : product.genreJouet?.includes('garçon') ? '#DBEAFE' : '#F3F4F6',
                                    borderColor: product.genreJouet?.includes('fille') ? '#EC4899' : product.genreJouet?.includes('garçon') ? '#3B82F6' : '#9CA3AF',
                                    borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4
                                }}>
                                    <Text style={{
                                        color: product.genreJouet?.includes('fille') ? '#9F1239' : product.genreJouet?.includes('garçon') ? '#1E40AF' : '#374151',
                                        fontSize: 12, fontWeight: '600'
                                    }}>
                                        {product.genreJouet}
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Type de jouet + Marque */}
                        <View style={{ gap: 6 }}>
                            {product.typeJouet && (
                                <View style={styles.jouetBadge}>
                                    <Text style={styles.jouetText}>
                                        🧸 {product.typeJouet}
                                        {product.marqueJouet ? ` • ${product.marqueJouet}` : ''}
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Catégories éducatives (top 3) */}
                        {product.categoriesEducatives && product.categoriesEducatives.length > 0 && (
                            <View style={{ gap: 6 }}>
                                <Text style={{ fontSize: 12, fontWeight: '600', color: '#6B7280' }}>📚 Développement :</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                    {product.categoriesEducatives.slice(0, 3).map((cat, idx) => (
                                        <View key={idx} style={{ backgroundColor: '#EDE9FE', borderColor: '#8B5CF6', borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                                            <Text style={{ color: '#5B21B6', fontSize: 11 }}>{cat}</Text>
                                        </View>
                                    ))}
                                    {product.categoriesEducatives.length > 3 && (
                                        <View style={{ backgroundColor: '#EDE9FE', borderColor: '#8B5CF6', borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                                            <Text style={{ color: '#5B21B6', fontSize: 11 }}>+{product.categoriesEducatives.length - 3}</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* Normes de sécurité */}
                        {product.normesSecurite && product.normesSecurite.length > 0 && (
                            <View style={{ gap: 6 }}>
                                <Text style={{ fontSize: 12, fontWeight: '600', color: '#6B7280' }}>🛡️ Sécurité :</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                    {product.normesSecurite.slice(0, 4).map((norme, idx) => (
                                        <View key={idx} style={{ backgroundColor: '#D1FAE5', borderColor: '#10B981', borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                                            <Text style={{ color: '#065F46', fontSize: 10 }}>✓ {norme}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}

                        {/* Fonctionnalités (top 4) */}
                        {product.fonctionnalitesJouet && product.fonctionnalitesJouet.length > 0 && (
                            <View style={{ gap: 6 }}>
                                <Text style={{ fontSize: 12, fontWeight: '600', color: '#6B7280' }}>⚡ Fonctionnalités :</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                    {product.fonctionnalitesJouet.slice(0, 4).map((func, idx) => (
                                        <View key={idx} style={{ backgroundColor: '#E0F2FE', borderColor: '#0EA5E9', borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                                            <Text style={{ color: '#075985', fontSize: 11 }}>{func}</Text>
                                        </View>
                                    ))}
                                    {product.fonctionnalitesJouet.length > 4 && (
                                        <View style={{ backgroundColor: '#E0F2FE', borderColor: '#0EA5E9', borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                                            <Text style={{ color: '#075985', fontSize: 11 }}>+{product.fonctionnalitesJouet.length - 4}</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* Matériau + Couleurs */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                            {product.materiauJouet && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                    <SafeIcon name="box" size={14} color="#6B7280" />
                                    <Text style={{ fontSize: 12, color: '#6B7280' }}>{product.materiauJouet}</Text>
                                </View>
                            )}
                            {product.couleursJouet && product.couleursJouet.length > 0 && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                    <SafeIcon name="palette" size={14} color="#6B7280" />
                                    <Text style={{ fontSize: 12, color: '#6B7280' }}>
                                        {product.couleursJouet.slice(0, 2).join(', ')}
                                        {product.couleursJouet.length > 2 && ` +${product.couleursJouet.length - 2}`}
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Alimentation + Lieu */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                            {product.alimentationJouet && product.alimentationJouet !== 'Manuel (sans pile)' && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                    <SafeIcon name="battery-charging" size={14} color="#6B7280" />
                                    <Text style={{ fontSize: 12, color: '#6B7280' }}>{product.alimentationJouet}</Text>
                                </View>
                            )}
                            {product.lieuUtilisation && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                    <SafeIcon name="map-pin" size={14} color="#6B7280" />
                                    <Text style={{ fontSize: 12, color: '#6B7280' }}>{product.lieuUtilisation}</Text>
                                </View>
                            )}
                        </View>

                        {/* Jeux de société : Joueurs + Durée */}
                        {(product.nombreJoueurs || product.dureeJeu) && (
                            <View style={{ backgroundColor: '#F3E8FF', borderRadius: 8, padding: 8, gap: 4 }}>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                                    {product.nombreJoueurs && (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                            <SafeIcon name="users" size={14} color="#6B21A8" />
                                            <Text style={{ fontSize: 12, color: '#6B21A8', fontWeight: '600' }}>{product.nombreJoueurs}</Text>
                                        </View>
                                    )}
                                    {product.dureeJeu && (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                            <SafeIcon name="clock" size={14} color="#6B21A8" />
                                            <Text style={{ fontSize: 12, color: '#6B21A8', fontWeight: '600' }}>{product.dureeJeu}</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* Emballage + Garantie */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                            {product.emballageJouet && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                    <SafeIcon name="package" size={14} color="#6B7280" />
                                    <Text style={{ fontSize: 12, color: '#6B7280' }}>{product.emballageJouet}</Text>
                                </View>
                            )}
                            {product.garantieJouet && product.garantieJouet !== 'Sans garantie' && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                    <SafeIcon name="shield" size={14} color="#059669" />
                                    <Text style={{ fontSize: 12, color: '#059669', fontWeight: '600' }}>Garantie {product.garantieJouet}</Text>
                                </View>
                            )}
                        </View>

                        {/* Accessoires inclus (résumé) */}
                        {product.accessoiresInclus && product.accessoiresInclus.length > 0 && !product.accessoiresInclus.includes('Aucun accessoire') && (
                            <View style={{ gap: 4 }}>
                                <Text style={{ fontSize: 12, fontWeight: '600', color: '#6B7280' }}>📦 Inclus :</Text>
                                <Text style={{ fontSize: 12, color: '#6B7280' }}>
                                    {product.accessoiresInclus.slice(0, 3).join(' • ')}
                                    {product.accessoiresInclus.length > 3 && ` • +${product.accessoiresInclus.length - 3}`}
                                </Text>
                            </View>
                        )}

                        {/* Localisation - Boutique/Vendeur */}
                        {(product.quartier || product.ville || displayGPS) && (
                            <View style={{ gap: 6 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <SafeIcon name="map-pin" size={14} color="#FF69B4" />
                                    <View style={{ flex: 1, gap: 2 }}>
                                        {(product.quartier || product.ville) && (
                                            <Text style={{ fontSize: 12, color: '#6B7280' }}>
                                                {product.quartier && product.ville ? `${product.quartier}, ${product.ville}` : product.quartier || product.ville}
                                            </Text>
                                        )}
                                        {displayGPS && (
                                            <Text style={{ fontSize: 11, color: '#9CA3AF' }}>
                                                📍 {displayGPS}
                                            </Text>
                                        )}
                                    </View>
                                    {displayGPS && (
                                        <TouchableOpacity
                                            onPress={() => {
                                                if (displayGPS) {
                                                    const [lat, lng] = displayGPS.split(', ').map(Number);
                                                    if (!isNaN(lat) && !isNaN(lng)) {
                                                        const url = `https://www.google.com/maps?q=${lat},${lng}`;
                                                        Linking.openURL(url);
                                                    }
                                                }
                                            }}
                                        >
                                            <SafeIcon name="external-link" size={16} color="#FF69B4" />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                        )}
                    </View>
                );
            }

            case 'sante_beaute': {
                return (
                    <View style={{ gap: 12 }}>
                        {product.typeProduitBeaute && (
                            <View style={styles.beauteBadge}>
                                <Text style={styles.beauteText}>💄 {product.typeProduitBeaute}</Text>
                            </View>
                        )}
                        {product.marqueBeaute && (
                            <View style={styles.beauteMarqueBadge}>
                                <Text style={styles.beauteMarqueText}>🏷️ {product.marqueBeaute}</Text>
                            </View>
                        )}
                        {product.bio && (
                            <View style={styles.beauteBioBadge}>
                                <Text style={styles.beauteBioText}>🌱 Bio</Text>
                            </View>
                        )}
                    </View>
                );
            }

            case 'bien_etre': {
                return (
                    <View style={{ gap: 12 }}>
                        {product.typeBienEtre && (
                            <View style={styles.bienEtreBadge}>
                                <Text style={styles.bienEtreText}>🧘 {product.typeBienEtre}</Text>
                            </View>
                        )}
                        {product.dureeSoins && (
                            <Text style={styles.bienEtreDuree}>⏱️ {product.dureeSoins}</Text>
                        )}
                        {product.tarifsSpeciaux && (
                            <Text style={styles.bienEtreTarif}>💰 {product.tarifsSpeciaux}</Text>
                        )}
                    </View>
                );
            }

            case 'bijoux': {
                return (
                    <View style={{ gap: 12 }}>
                        {/* Type + Pour qui */}
                        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                            {product.typeBijou && (
                                <View style={styles.bijouxBadge}>
                                    <Text style={styles.bijouxText}>💍 {product.typeBijou}</Text>
                                </View>
                            )}
                            {product.pourQuiBijou && (
                                <View style={[styles.bijouxBadge, { backgroundColor: '#E0F2FE' }]}>
                                    <Text style={[styles.bijouxText, { color: '#0369A1' }]}>
                                        {product.pourQuiBijou}
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Matière + Carats/Pureté */}
                        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            {product.matiereBijou && (
                                <View style={styles.bijouxMateriauBadge}>
                                    <Text style={styles.bijouxMateriauText}>✨ {product.matiereBijou}</Text>
                                </View>
                            )}
                            {product.caratsBijou && (
                                <Text style={[styles.bijouxMateriauText, { fontSize: 11 }]}>
                                    ({product.caratsBijou})
                                </Text>
                            )}
                            {product.pureteArgent && (
                                <Text style={[styles.bijouxMateriauText, { fontSize: 11 }]}>
                                    ({product.pureteArgent})
                                </Text>
                            )}
                        </View>

                        {/* Marque */}
                        {product.marqueBijou && (
                            <Text style={{ fontSize: 12, fontWeight: '600', color: '#111827' }}>
                                🏷️ {product.marqueBijou}
                            </Text>
                        )}

                        {/* Taille/Longueur + Poids */}
                        <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
                            {product.tailleBijou && (
                                <Text style={styles.bijouxPoids}>📏 {product.tailleBijou}</Text>
                            )}
                            {product.longueurBijou && (
                                <Text style={styles.bijouxPoids}>📏 {product.longueurBijou}</Text>
                            )}
                            {product.diametreMontre && (
                                <Text style={styles.bijouxPoids}>⌚ {product.diametreMontre}</Text>
                            )}
                            {(product.poidsApproxBijou || product.poidsBijou) && (
                                <Text style={styles.bijouxPoids}>
                                    ⚖️ {product.poidsApproxBijou || `${product.poidsBijou}g`}
                                </Text>
                            )}
                        </View>

                        {/* État + Certification */}
                        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                            {product.etatBijou && (
                                <View style={[styles.bijouxBadge, { backgroundColor: '#F0FDF4' }]}>
                                    <Text style={[styles.bijouxText, { color: '#15803D' }]}>
                                        ✓ {product.etatBijou}
                                    </Text>
                                </View>
                            )}
                            {(product.certificationBijou || product.certificat) && (
                                <Text style={styles.bijouxCertif}>
                                    🏅 {product.certificationBijou || 'Certifié'}
                                </Text>
                            )}
                        </View>

                        {/* Style + Occasion */}
                        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                            {product.styleBijou && (
                                <Text style={{ fontSize: 11, color: '#6B7280', fontStyle: 'italic' }}>
                                    🎨 {product.styleBijou}
                                </Text>
                            )}
                            {product.occasionBijou && (
                                <Text style={{ fontSize: 11, color: '#6B7280', fontStyle: 'italic' }}>
                                    🎉 {product.occasionBijou}
                                </Text>
                            )}
                        </View>

                        {/* Garantie + Origine */}
                        {(product.garantieBijou || product.origineBijou) && (
                            <Text style={{ fontSize: 10, color: '#9CA3AF' }}>
                                {product.garantieBijou && `⏱️ Garantie ${product.garantieBijou}`}
                                {product.garantieBijou && product.origineBijou && ' • '}
                                {product.origineBijou && `🌍 ${product.origineBijou}`}
                            </Text>
                        )}
                    </View>
                );
            }

            case 'juridique': {
                return (
                    <View style={{ gap: 12 }}>
                        {product.typeServiceJuridique && (
                            <View style={styles.juridiqueBadge}>
                                <Text style={styles.juridiqueText}>⚖️ {product.typeServiceJuridique}</Text>
                            </View>
                        )}
                        {product.domaineJuridique && (
                            <Text style={styles.juridiqueDomaine}>{product.domaineJuridique}</Text>
                        )}
                        {product.tarificationJuridique && (
                            <Text style={styles.juridiqueTarif}>💰 {product.tarificationJuridique}</Text>
                        )}
                    </View>
                );
            }

            case 'photographie': {
                return (
                    <View style={{ gap: 12 }}>
                        {product.typePhotoService && (
                            <View style={styles.photoBadge}>
                                <Text style={styles.photoText}>📷 {product.typePhotoService}</Text>
                            </View>
                        )}
                        {product.stylePhoto && (
                            <Text style={styles.photoStyle}>{product.stylePhoto}</Text>
                        )}
                        {product.equipementPhoto && (
                            <Text style={styles.photoEquipement}>📸 {product.equipementPhoto}</Text>
                        )}
                    </View>
                );
            }

            case 'entreprise_industrie': {
                return (
                    <View style={{ gap: 12 }}>
                        {product.typeEntreprise && (
                            <View style={styles.entrepriseBadge}>
                                <Text style={styles.entrepriseText}>🏭 {product.typeEntreprise}</Text>
                            </View>
                        )}
                        {product.secteurActivite && (
                            <Text style={styles.entrepriseSecteur}>{product.secteurActivite}</Text>
                        )}
                        {product.certification && (
                            <Text style={styles.entrepriseCertif}>✓ {product.certification}</Text>
                        )}
                    </View>
                );
            }

            case 'musique': {
                return (
                    <View style={{ gap: 12 }}>
                        {product.typeServiceMusical && (
                            <View style={styles.musiqueServiceBadge}>
                                <Text style={styles.musiqueServiceText}>🎵 {product.typeServiceMusical}</Text>
                            </View>
                        )}
                        {product.genreMusical && (
                            <Text style={styles.musiqueServiceGenre}>{product.genreMusical}</Text>
                        )}
                        {product.dureePrestation && (
                            <Text style={styles.musiqueServiceDuree}>⏱️ {product.dureePrestation}</Text>
                        )}
                    </View>
                );
            }

            case 'reparation': {
                return (
                    <View style={{ gap: 12 }}>
                        {product.typeReparation && (
                            <View style={styles.reparationBadge}>
                                <Text style={styles.reparationText}>🛠️ {product.typeReparation}</Text>
                            </View>
                        )}
                        {product.specialiteReparation && (
                            <Text style={styles.reparationSpec}>{product.specialiteReparation}</Text>
                        )}
                        {product.garantieReparation && (
                            <Text style={styles.reparationGarantie}>✓ Garantie {product.garantieReparation}</Text>
                        )}
                    </View>
                );
            }

            case 'carrelage': {
                return (
                    <View style={{ gap: 12 }}>
                        {product.typeCarrelage && (
                            <View style={styles.carrelageBadge}>
                                <Text style={styles.carrelageText}>🏗️ {product.typeCarrelage}</Text>
                            </View>
                        )}
                        {product.materiauCarrelage && (
                            <View style={styles.carrelageMateriauBadge}>
                                <Text style={styles.carrelageMateriauText}>{product.materiauCarrelage}</Text>
                            </View>
                        )}
                        {product.dimensionsCarrelage && (
                            <Text style={styles.carrelageDimensions}>📏 {product.dimensionsCarrelage}</Text>
                        )}
                        {product.finitionCarrelage && (
                            <Text style={styles.carrelageFinition}>✨ {product.finitionCarrelage}</Text>
                        )}
                        {product.usageCarrelage && (
                            <Text style={styles.carrelageUsage}>🏠 {product.usageCarrelage}</Text>
                        )}
                    </View>
                );
            }

            case 'plomberie_sanitaire': {
                const getEtatPlomberieColor = (etat: string) => {
                    if (etat?.includes('Neuf')) return { bg: '#D1FAE5', text: '#065F46', border: '#10B981' };
                    if (etat?.includes('Très bon')) return { bg: '#E0E7FF', text: '#3730A3', border: '#6366F1' };
                    if (etat?.includes('Bon')) return { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B' };
                    return { bg: '#F3F4F6', text: '#374151', border: '#9CA3AF' };
                };
                // ✅ FIX: Gestion des noms de champs multiples (avec fallback)
                const etatPlomberie = product.etatPlomberie || product.etatPlomberieSanitaire;
                const etatColors = getEtatPlomberieColor(etatPlomberie || '');
                const categorieProduit = product.categorieProduit || product.categorieProduitPlomberie;
                const marquePlomberie = product.marquePlomberie || product.marquePlomberieSanitaire;
                const materiauPlomberie = product.materiauPlomberie || product.materiauPlomberieSanitaire;
                const finitionPlomberie = product.finitionPlomberie || product.finitionPlomberieSanitaire;
                const garantiePlomberie = product.garantiePlomberie || product.garantiePlomberieSanitaire;
                const livraisonPlomberie = product.livraisonPlomberie || product.livraisonPlomberieSanitaire;
                const installationPlomberie = product.installationPlomberie || product.installationPlomberieSanitaire;

                return (
                    <View style={{ gap: 12 }}>
                        {/* Badges principaux */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {categorieProduit && (
                                <View style={styles.plomberieCategorieBadge}>
                                    <Text style={styles.plomberieCategorieText}>🚰 {categorieProduit}</Text>
                                </View>
                            )}
                            {etatPlomberie && (
                                <View style={[styles.plomberieEtatBadge, { backgroundColor: etatColors.bg, borderColor: etatColors.border }]}>
                                    <Text style={[styles.plomberieEtatText, { color: etatColors.text }]}>{etatPlomberie}</Text>
                                </View>
                            )}
                        </View>

                        {/* Marque et Matériau */}
                        {marquePlomberie && (
                            <View style={styles.plomberieMarqueBadge}>
                                <Text style={styles.plomberieMarqueText}>🏷️ {marquePlomberie}</Text>
                            </View>
                        )}
                        {materiauPlomberie && (
                            <View style={styles.plomberieMateriauBadge}>
                                <Text style={styles.plomberieMateriauText}>🔧 {materiauPlomberie}</Text>
                            </View>
                        )}

                        {/* Finition et Garantie */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                            {finitionPlomberie && (
                                <Text style={styles.plomberieFinition}>✨ {finitionPlomberie}</Text>
                            )}
                            {garantiePlomberie && (
                                <Text style={styles.plomberieGarantie}>🛡️ {garantiePlomberie}</Text>
                            )}
                        </View>

                        {/* Services */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                            {livraisonPlomberie && (
                                <Text style={styles.plomberieService}>🚚 {livraisonPlomberie}</Text>
                            )}
                            {installationPlomberie && (
                                <Text style={styles.plomberieService}>🔧 {installationPlomberie}</Text>
                            )}
                        </View>
                    </View>
                );
            }

            case 'menuisier_aluminium':
            case 'menuiserie_aluminium':
            case 'menuisier_alu':
            case 'menuiserie_alu': {
                // ✅ MENUISIER ALUMINIUM - Rendu spécialisé menuiserie alu et verre
                const getDelaiColor = (delai: string) => {
                    if (delai?.includes('3-5') || delai?.includes('jours')) return { bg: '#D1FAE5', text: '#065F46', border: '#10B981' };
                    if (delai?.includes('semaine')) return { bg: '#DBEAFE', text: '#1E40AF', border: '#3B82F6' };
                    if (delai?.includes('2-3') || delai?.includes('1-2')) return { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B' };
                    return { bg: '#F3F4F6', text: '#374151', border: '#9CA3AF' };
                };

                const getGarantieColor = (garantie: string) => {
                    if (garantie?.includes('10 ans')) return { bg: '#D1FAE5', text: '#065F46', border: '#10B981' };
                    if (garantie?.includes('5 ans')) return { bg: '#DBEAFE', text: '#1E40AF', border: '#3B82F6' };
                    if (garantie?.includes('3 ans') || garantie?.includes('2 ans') || garantie?.includes('1 an')) return { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B' };
                    return { bg: '#F3F4F6', text: '#374151', border: '#9CA3AF' };
                };

                const delaiColor = product.delaiRealisation ? getDelaiColor(product.delaiRealisation) : null;
                const garantieColor = product.garantie ? getGarantieColor(product.garantie) : null;

                // Extraire les types de réalisation (multiselect)
                let typesRealisation = [];
                if (Array.isArray(product.typeRealisation)) {
                    typesRealisation = product.typeRealisation;
                } else if (typeof product.typeRealisation === 'string') {
                    try {
                        typesRealisation = JSON.parse(product.typeRealisation);
                    } catch {
                        typesRealisation = [product.typeRealisation];
                    }
                }

                // Extraire les certifications
                let certifications = [];
                if (Array.isArray(product.certifications)) {
                    certifications = product.certifications;
                } else if (typeof product.certifications === 'string') {
                    try {
                        certifications = JSON.parse(product.certifications);
                    } catch {
                        certifications = [product.certifications];
                    }
                }

                return (
                    <View style={{ gap: 12 }}>
                        {/* Badges Délai + Garantie + Services */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {product.delaiRealisation && delaiColor && (
                                <View style={[styles.menuisierAluBadge, { backgroundColor: delaiColor.bg, borderColor: delaiColor.border }]}>
                                    <SafeIcon name="clock" size={12} color={delaiColor.text} />
                                    <Text style={[styles.menuisierAluBadgeText, { color: delaiColor.text }]}>
                                        {product.delaiRealisation}
                                    </Text>
                                </View>
                            )}
                            {product.garantie && garantieColor && (
                                <View style={[styles.menuisierAluBadge, { backgroundColor: garantieColor.bg, borderColor: garantieColor.border }]}>
                                    <SafeIcon name="shield" size={12} color={garantieColor.text} />
                                    <Text style={[styles.menuisierAluBadgeText, { color: garantieColor.text }]}>
                                        {product.garantie}
                                    </Text>
                                </View>
                            )}
                            {product.devisGratuit && (
                                <View style={styles.menuisierAluFreeBadge}>
                                    <SafeIcon name="check-circle" size={12} color="#059669" />
                                    <Text style={styles.menuisierAluFreeText}>Devis gratuit</Text>
                                </View>
                            )}
                            {product.motorisationDisponible && (
                                <View style={styles.menuisierAluMotorBadge}>
                                    <SafeIcon name="zap" size={12} color="#F59E0B" />
                                    <Text style={styles.menuisierAluMotorText}>Motorisation dispo</Text>
                                </View>
                            )}
                        </View>

                        {/* Nom de l'atelier */}
                        {product.nomAtelier && (
                            <View style={styles.menuisierAluName}>
                                <SafeIcon name="square" size={16} color="#607D8B" />
                                <Text style={styles.menuisierAluNameText}>{product.nomAtelier}</Text>
                            </View>
                        )}

                        {/* Types de réalisations */}
                        {typesRealisation.length > 0 && (
                            <View style={styles.menuisierAluRealisations}>
                                <Text style={styles.menuisierAluSectionTitle}>🪟 Réalisations proposées :</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                                    {typesRealisation.slice(0, 5).map((type, idx) => (
                                        <View key={idx} style={styles.menuisierAluRealisationTag}>
                                            <Text style={styles.menuisierAluRealisationText}>{type}</Text>
                                        </View>
                                    ))}
                                    {typesRealisation.length > 5 && (
                                        <View style={styles.menuisierAluRealisationTag}>
                                            <Text style={styles.menuisierAluRealisationText}>+{typesRealisation.length - 5} autres</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* Type Aluminium, Couleur & Vitrage */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                            {product.typeAluminium && (
                                <View style={styles.menuisierAluTypeTag}>
                                    <SafeIcon name="layers" size={12} color="#546E7A" />
                                    <Text style={styles.menuisierAluTypeText}>{product.typeAluminium}</Text>
                                </View>
                            )}
                            {product.couleurAluminium && (
                                <View style={styles.menuisierAluCouleurTag}>
                                    <SafeIcon name="droplet" size={12} color="#607D8B" />
                                    <Text style={styles.menuisierAluCouleurText}>{product.couleurAluminium}</Text>
                                </View>
                            )}
                            {product.typeVitrage && (
                                <View style={styles.menuisierAluVitrageTag}>
                                    <SafeIcon name="eye" size={12} color="#78909C" />
                                    <Text style={styles.menuisierAluVitrageText}>{product.typeVitrage}</Text>
                                </View>
                            )}
                        </View>

                        {/* Certifications & Expérience */}
                        {certifications.length > 0 && (
                            <View style={styles.menuisierAluCertifications}>
                                <Text style={styles.menuisierAluSectionTitle}>🎓 Compétences :</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                                    {certifications.slice(0, 4).map((cert, idx) => (
                                        <View key={idx} style={styles.menuisierAluCertTag}>
                                            <SafeIcon name="award" size={10} color="#6B21A8" />
                                            <Text style={styles.menuisierAluCertText}>{cert}</Text>
                                        </View>
                                    ))}
                                    {certifications.length > 4 && (
                                        <View style={styles.menuisierAluCertTag}>
                                            <Text style={styles.menuisierAluCertText}>+{certifications.length - 4}</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* Prix estimatif */}
                        {product.prixEstimatif && (
                            <View style={styles.menuisierAluPrice}>
                                <SafeIcon name="tag" size={14} color="#6B7280" />
                                <Text style={styles.menuisierAluPriceText}>Tarif estimatif : {product.prixEstimatif}</Text>
                            </View>
                        )}

                        {/* Services inclus */}
                        {(product.devisGratuit || product.installationIncluse || product.paiementEchelonne) && (
                            <View style={styles.menuisierAluExtras}>
                                {product.devisGratuit && (
                                    <View style={styles.menuisierAluExtraTag}>
                                        <SafeIcon name="check-circle" size={10} color="#059669" />
                                        <Text style={styles.menuisierAluExtraText}>Devis gratuit</Text>
                                    </View>
                                )}
                                {product.installationIncluse && (
                                    <View style={styles.menuisierAluExtraTag}>
                                        <SafeIcon name="tool" size={10} color="#059669" />
                                        <Text style={styles.menuisierAluExtraText}>Installation incluse</Text>
                                    </View>
                                )}
                                {product.paiementEchelonne && (
                                    <View style={styles.menuisierAluExtraTag}>
                                        <SafeIcon name="calendar" size={10} color="#059669" />
                                        <Text style={styles.menuisierAluExtraText}>Paiement échelonné</Text>
                                    </View>
                                )}
                            </View>
                        )}
                    </View>
                );
            }

            case 'forgeron':
            case 'ferronnerie':
            case 'ferronnerie_art':
            case 'fer_forge': {
                // ✅ FORGERON / FERRONNERIE - Rendu spécialisé artisanat métallique
                const getDelaiColor = (delai: string) => {
                    if (delai?.includes('3-5') || delai?.includes('jours')) return { bg: '#D1FAE5', text: '#065F46', border: '#10B981' };
                    if (delai?.includes('semaine')) return { bg: '#DBEAFE', text: '#1E40AF', border: '#3B82F6' };
                    if (delai?.includes('2-3') || delai?.includes('3-4')) return { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B' };
                    return { bg: '#F3F4F6', text: '#374151', border: '#9CA3AF' };
                };

                const getGarantieColor = (garantie: string) => {
                    if (garantie?.includes('5 ans')) return { bg: '#D1FAE5', text: '#065F46', border: '#10B981' };
                    if (garantie?.includes('2 ans')) return { bg: '#DBEAFE', text: '#1E40AF', border: '#3B82F6' };
                    if (garantie?.includes('1 an') || garantie?.includes('6 mois')) return { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B' };
                    return { bg: '#F3F4F6', text: '#374151', border: '#9CA3AF' };
                };

                const delaiColor = product.delaiRealisation ? getDelaiColor(product.delaiRealisation) : null;
                const garantieColor = product.garantie ? getGarantieColor(product.garantie) : null;

                // Extraire les types de réalisation (multiselect)
                let typesRealisation = [];
                if (Array.isArray(product.typeRealisation)) {
                    typesRealisation = product.typeRealisation;
                } else if (typeof product.typeRealisation === 'string') {
                    try {
                        typesRealisation = JSON.parse(product.typeRealisation);
                    } catch {
                        typesRealisation = [product.typeRealisation];
                    }
                }

                // Extraire les certifications
                let certifications = [];
                if (Array.isArray(product.certifications)) {
                    certifications = product.certifications;
                } else if (typeof product.certifications === 'string') {
                    try {
                        certifications = JSON.parse(product.certifications);
                    } catch {
                        certifications = [product.certifications];
                    }
                }

                return (
                    <View style={{ gap: 12 }}>
                        {/* Badges Délai + Garantie */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {product.delaiRealisation && delaiColor && (
                                <View style={[styles.forgeronBadge, { backgroundColor: delaiColor.bg, borderColor: delaiColor.border }]}>
                                    <SafeIcon name="clock" size={12} color={delaiColor.text} />
                                    <Text style={[styles.forgeronBadgeText, { color: delaiColor.text }]}>
                                        {product.delaiRealisation}
                                    </Text>
                                </View>
                            )}
                            {product.garantie && garantieColor && (
                                <View style={[styles.forgeronBadge, { backgroundColor: garantieColor.bg, borderColor: garantieColor.border }]}>
                                    <SafeIcon name="shield" size={12} color={garantieColor.text} />
                                    <Text style={[styles.forgeronBadgeText, { color: garantieColor.text }]}>
                                        {product.garantie}
                                    </Text>
                                </View>
                            )}
                            {product.devisGratuit && (
                                <View style={styles.forgeronFreeBadge}>
                                    <SafeIcon name="check-circle" size={12} color="#059669" />
                                    <Text style={styles.forgeronFreeText}>Devis gratuit</Text>
                                </View>
                            )}
                            {product.motorisationDisponible && (
                                <View style={styles.forgeronMotorBadge}>
                                    <SafeIcon name="zap" size={12} color="#F59E0B" />
                                    <Text style={styles.forgeronMotorText}>Motorisation dispo</Text>
                                </View>
                            )}
                        </View>

                        {/* Nom de l'atelier */}
                        {product.nomAtelier && (
                            <View style={styles.forgeronName}>
                                <SafeIcon name="hammer" size={16} color="#78909C" />
                                <Text style={styles.forgeronNameText}>{product.nomAtelier}</Text>
                            </View>
                        )}

                        {/* Types de réalisations */}
                        {typesRealisation.length > 0 && (
                            <View style={styles.forgeronRealisations}>
                                <Text style={styles.forgeronSectionTitle}>🔨 Réalisations proposées :</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                                    {typesRealisation.slice(0, 5).map((type, idx) => (
                                        <View key={idx} style={styles.forgeronRealisationTag}>
                                            <Text style={styles.forgeronRealisationText}>{type}</Text>
                                        </View>
                                    ))}
                                    {typesRealisation.length > 5 && (
                                        <View style={styles.forgeronRealisationTag}>
                                            <Text style={styles.forgeronRealisationText}>+{typesRealisation.length - 5} autres</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* Matériau & Style */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                            {product.materiau && (
                                <View style={styles.forgeronMateriauTag}>
                                    <SafeIcon name="layers" size={12} color="#546E7A" />
                                    <Text style={styles.forgeronMateriauText}>{product.materiau}</Text>
                                </View>
                            )}
                            {product.style && (
                                <View style={styles.forgeronStyleTag}>
                                    <SafeIcon name="star" size={12} color="#78909C" />
                                    <Text style={styles.forgeronStyleText}>{product.style}</Text>
                                </View>
                            )}
                            {product.finition && (
                                <View style={styles.forgeronFinitionTag}>
                                    <SafeIcon name="droplet" size={12} color="#607D8B" />
                                    <Text style={styles.forgeronFinitionText}>{product.finition}</Text>
                                </View>
                            )}
                        </View>

                        {/* Certifications & Expérience */}
                        {certifications.length > 0 && (
                            <View style={styles.forgeronCertifications}>
                                <Text style={styles.forgeronSectionTitle}>🎓 Compétences :</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                                    {certifications.slice(0, 4).map((cert, idx) => (
                                        <View key={idx} style={styles.forgeronCertTag}>
                                            <SafeIcon name="award" size={10} color="#6B21A8" />
                                            <Text style={styles.forgeronCertText}>{cert}</Text>
                                        </View>
                                    ))}
                                    {certifications.length > 4 && (
                                        <View style={styles.forgeronCertTag}>
                                            <Text style={styles.forgeronCertText}>+{certifications.length - 4}</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* Prix estimatif */}
                        {product.prixEstimatif && (
                            <View style={styles.forgeronPrice}>
                                <SafeIcon name="tag" size={14} color="#6B7280" />
                                <Text style={styles.forgeronPriceText}>Tarif estimatif : {product.prixEstimatif}</Text>
                            </View>
                        )}

                        {/* Services inclus */}
                        {(product.devisGratuit || product.installationIncluse || product.paiementEchelonne) && (
                            <View style={styles.forgeronExtras}>
                                {product.devisGratuit && (
                                    <View style={styles.forgeronExtraTag}>
                                        <SafeIcon name="check-circle" size={10} color="#059669" />
                                        <Text style={styles.forgeronExtraText}>Devis gratuit</Text>
                                    </View>
                                )}
                                {product.installationIncluse && (
                                    <View style={styles.forgeronExtraTag}>
                                        <SafeIcon name="tool" size={10} color="#059669" />
                                        <Text style={styles.forgeronExtraText}>Installation incluse</Text>
                                    </View>
                                )}
                                {product.paiementEchelonne && (
                                    <View style={styles.forgeronExtraTag}>
                                        <SafeIcon name="calendar" size={10} color="#059669" />
                                        <Text style={styles.forgeronExtraText}>Paiement échelonné</Text>
                                    </View>
                                )}
                            </View>
                        )}
                    </View>
                );
            }

            case 'sport_fitness': {
                return (
                    <View style={{ gap: 12 }}>
                        {/* Badges principaux */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {product.typeSport && (
                                <View style={[styles.sportTypeBadge, { backgroundColor: '#FEE2E2', borderColor: '#EF4444' }]}>
                                    <Text style={[styles.sportTypeText, { color: '#DC2626' }]}>💪 {product.typeSport}</Text>
                                </View>
                            )}
                            {product.niveauSport && (
                                <View style={styles.sportNiveauBadge}>
                                    <Text style={styles.sportNiveauText}>📊 {product.niveauSport}</Text>
                                </View>
                            )}
                            {product.dureeSport && (
                                <View style={styles.sportDureeBadge}>
                                    <Text style={styles.sportDureeText}>⏱️ {product.dureeSport}</Text>
                                </View>
                            )}
                        </View>

                        {/* Informations complémentaires */}
                        <View style={{ gap: 8 }}>
                            {product.serviceSport && (
                                <View style={styles.sportInfoRow}>
                                    <SafeIcon name="tag" size={14} color="#EF4444" />
                                    <Text style={styles.sportInfoLabel}>Service : </Text>
                                    <Text style={styles.sportInfoValue}>{product.serviceSport}</Text>
                                </View>
                            )}
                            {product.objectifSport && (
                                <View style={styles.sportInfoRow}>
                                    <SafeIcon name="target" size={14} color="#EF4444" />
                                    <Text style={styles.sportInfoLabel}>Objectif : </Text>
                                    <Text style={styles.sportInfoValue}>{product.objectifSport}</Text>
                                </View>
                            )}
                            {product.horairesSport && (
                                <View style={styles.sportInfoRow}>
                                    <SafeIcon name="clock" size={14} color="#EF4444" />
                                    <Text style={styles.sportInfoLabel}>Horaires : </Text>
                                    <Text style={styles.sportInfoValue}>{product.horairesSport}</Text>
                                </View>
                            )}
                            {product.joursSport && product.joursSport.length > 0 && (
                                <View style={styles.sportInfoRow}>
                                    <SafeIcon name="calendar" size={14} color="#EF4444" />
                                    <Text style={styles.sportInfoLabel}>Jours : </Text>
                                    <Text style={styles.sportInfoValue}>{product.joursSport.join(', ')}</Text>
                                </View>
                            )}
                            {product.equipementsSport && product.equipementsSport.length > 0 && (
                                <View style={{ marginTop: 4 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                        <SafeIcon name="check-circle" size={14} color="#10B981" />
                                        <Text style={[styles.sportInfoLabel, { fontWeight: '600' }]}>Équipements disponibles :</Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                                        {product.equipementsSport.slice(0, 5).map((equipement: string, index: number) => (
                                            <View key={index} style={styles.sportEquipBadge}>
                                                <Text style={styles.sportEquipText}>✓ {equipement}</Text>
                                            </View>
                                        ))}
                                        {product.equipementsSport.length > 5 && (
                                            <View style={[styles.sportEquipBadge, { backgroundColor: '#F3F4F6' }]}>
                                                <Text style={[styles.sportEquipText, { color: '#6B7280' }]}>
                                                    +{product.equipementsSport.length - 5}
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            )}
                        </View>
                    </View>
                );
            }

            // ✅ BIEN-ÊTRE & SPA
            case 'bien_etre_spa': {
                return (
                    <View style={{ gap: 12 }}>
                        {/* Badges principaux */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {product.typeBienEtre && (
                                <View style={[styles.sportTypeBadge, { backgroundColor: '#CCFBF1', borderColor: '#14B8A6' }]}>
                                    <Text style={[styles.sportTypeText, { color: '#0D9488' }]}>🧘 {product.typeBienEtre}</Text>
                                </View>
                            )}
                            {product.dureeBienEtre && (
                                <View style={[styles.sportDureeBadge, { backgroundColor: '#DBEAFE', borderColor: '#3B82F6' }]}>
                                    <Text style={[styles.sportDureeText, { color: '#1E40AF' }]}>⏱️ {product.dureeBienEtre}</Text>
                                </View>
                            )}
                            {product.tarifsParCategorie && (
                                <View style={[styles.sportNiveauBadge, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }]}>
                                    <Text style={[styles.sportNiveauText, { color: '#D97706' }]}>💰 {product.tarifsParCategorie}</Text>
                                </View>
                            )}
                        </View>

                        {/* Services & équipements */}
                        <View style={{ gap: 8 }}>
                            {product.servicesBienEtre && Array.isArray(product.servicesBienEtre) && product.servicesBienEtre.length > 0 && (
                                <View style={{ marginTop: 4 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                        <SafeIcon name="check-circle" size={14} color="#14B8A6" />
                                        <Text style={[styles.sportInfoLabel, { fontWeight: '600', color: '#0D9488' }]}>Services disponibles :</Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                                        {product.servicesBienEtre.slice(0, 5).map((service: string, index: number) => (
                                            <View key={index} style={[styles.sportEquipBadge, { backgroundColor: '#CCFBF1', borderColor: '#99F6E4' }]}>
                                                <Text style={[styles.sportEquipText, { color: '#0F766E' }]}>✓ {service}</Text>
                                            </View>
                                        ))}
                                        {product.servicesBienEtre.length > 5 && (
                                            <View style={[styles.sportEquipBadge, { backgroundColor: '#F3F4F6' }]}>
                                                <Text style={[styles.sportEquipText, { color: '#6B7280' }]}>
                                                    +{product.servicesBienEtre.length - 5}
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            )}

                            {/* Spécialités */}
                            {product.specialitesBienEtre && Array.isArray(product.specialitesBienEtre) && product.specialitesBienEtre.length > 0 && (
                                <View style={{ marginTop: 4 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                        <SafeIcon name="star" size={14} color="#14B8A6" />
                                        <Text style={[styles.sportInfoLabel, { fontWeight: '600', color: '#0D9488' }]}>Spécialités :</Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                                        {product.specialitesBienEtre.slice(0, 4).map((specialite: string, index: number) => (
                                            <View key={index} style={[styles.sportEquipBadge, { backgroundColor: '#E0F2FE', borderColor: '#BAE6FD' }]}>
                                                <Text style={[styles.sportEquipText, { color: '#0369A1' }]}>✨ {specialite}</Text>
                                            </View>
                                        ))}
                                        {product.specialitesBienEtre.length > 4 && (
                                            <View style={[styles.sportEquipBadge, { backgroundColor: '#F3F4F6' }]}>
                                                <Text style={[styles.sportEquipText, { color: '#6B7280' }]}>
                                                    +{product.specialitesBienEtre.length - 4}
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            )}

                            {/* Informations complémentaires */}
                            {product.clienteleBienEtre && (
                                <View style={styles.sportInfoRow}>
                                    <SafeIcon name="users" size={14} color="#14B8A6" />
                                    <Text style={styles.sportInfoLabel}>Clientèle : </Text>
                                    <Text style={styles.sportInfoValue}>{product.clienteleBienEtre}</Text>
                                </View>
                            )}
                            {product.formulesSpa && (
                                <View style={styles.sportInfoRow}>
                                    <SafeIcon name="package" size={14} color="#14B8A6" />
                                    <Text style={styles.sportInfoLabel}>Formule : </Text>
                                    <Text style={styles.sportInfoValue}>{product.formulesSpa}</Text>
                                </View>
                            )}
                            {product.horairesSpa && (
                                <View style={styles.sportInfoRow}>
                                    <SafeIcon name="clock" size={14} color="#14B8A6" />
                                    <Text style={styles.sportInfoLabel}>Horaires : </Text>
                                    <Text style={styles.sportInfoValue}>{product.horairesSpa}</Text>
                                </View>
                            )}
                            {product.centresSpaRenommes && (
                                <View style={styles.sportInfoRow}>
                                    <SafeIcon name="map-pin" size={14} color="#14B8A6" />
                                    <Text style={styles.sportInfoLabel}>Centre : </Text>
                                    <Text style={styles.sportInfoValue}>{product.centresSpaRenommes}</Text>
                                </View>
                            )}

                            {/* Produits utilisés */}
                            {product.produits && Array.isArray(product.produits) && product.produits.length > 0 && (
                                <View style={{ marginTop: 4 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                        <SafeIcon name="droplet" size={14} color="#059669" />
                                        <Text style={[styles.sportInfoLabel, { fontWeight: '600', color: '#047857' }]}>Produits :</Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                                        {product.produits.slice(0, 3).map((produit: string, index: number) => (
                                            <View key={index} style={[styles.sportEquipBadge, { backgroundColor: '#D1FAE5', borderColor: '#A7F3D0' }]}>
                                                <Text style={[styles.sportEquipText, { color: '#065F46' }]}>🌿 {produit}</Text>
                                            </View>
                                        ))}
                                        {product.produits.length > 3 && (
                                            <View style={[styles.sportEquipBadge, { backgroundColor: '#F3F4F6' }]}>
                                                <Text style={[styles.sportEquipText, { color: '#6B7280' }]}>
                                                    +{product.produits.length - 3}
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            )}
                        </View>
                    </View>
                );
            }

            // 🛡️ SÉCURITÉ & SURVEILLANCE
            case 'securite_surveillance':
            case 'securite':
            case 'surveillance': {
                return (
                    <View style={{ gap: 12 }}>
                        {/* Type de service sécurité (prioritaire) */}
                        {product.typeServiceSecurite && (
                            <View style={{
                                backgroundColor: '#FEE2E2',
                                paddingHorizontal: 12,
                                paddingVertical: 8,
                                borderRadius: 8,
                                borderLeftWidth: 3,
                                borderLeftColor: '#DC2626'
                            }}>
                                <Text style={{ fontSize: 13, fontWeight: '700', color: '#991B1B' }}>
                                    🛡️ {product.typeServiceSecurite}
                                </Text>
                            </View>
                        )}

                        {/* Type de client */}
                        {product.typeClientSecurite && (
                            <Text style={{ fontSize: 12, color: '#4B5563', fontWeight: '500' }}>
                                👥 {product.typeClientSecurite}
                            </Text>
                        )}

                        {/* Disponibilité (très important) */}
                        {product.disponibiliteSecurite && (
                            <View style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                backgroundColor: '#DBEAFE',
                                paddingHorizontal: 10,
                                paddingVertical: 6,
                                borderRadius: 6,
                                alignSelf: 'flex-start'
                            }}>
                                <Text style={{ fontSize: 12, fontWeight: '600', color: '#1E40AF' }}>
                                    ⏰ {product.disponibiliteSecurite}
                                </Text>
                            </View>
                        )}

                        {/* Service 24h/24 - 7j/7 (toggle) */}
                        {product.service24h7j && (
                            <View style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                backgroundColor: '#D1FAE5',
                                paddingHorizontal: 10,
                                paddingVertical: 6,
                                borderRadius: 6,
                                alignSelf: 'flex-start'
                            }}>
                                <Text style={{ fontSize: 12, fontWeight: '700', color: '#065F46' }}>
                                    🌙 Service 24h/24 - 7j/7
                                </Text>
                            </View>
                        )}

                        {/* Nombre d'agents (gardiennage) */}
                        {product.nombreAgents && (
                            <Text style={{ fontSize: 12, color: '#374151', fontWeight: '500' }}>
                                👮 {product.nombreAgents}
                            </Text>
                        )}

                        {/* Armement agents */}
                        {product.armementAgents && (
                            <Text style={{ fontSize: 11, color: '#6B7280' }}>
                                🔫 {product.armementAgents}
                            </Text>
                        )}

                        {/* Type de caméra + Résolution (vidéosurveillance) */}
                        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                            {product.typeCameraSecurite && (
                                <Text style={{
                                    fontSize: 11,
                                    color: '#374151',
                                    backgroundColor: '#F3F4F6',
                                    paddingHorizontal: 8,
                                    paddingVertical: 4,
                                    borderRadius: 4
                                }}>
                                    📹 {product.typeCameraSecurite}
                                </Text>
                            )}
                            {product.resolutionCamera && (
                                <Text style={{
                                    fontSize: 11,
                                    color: '#7C3AED',
                                    backgroundColor: '#F5F3FF',
                                    paddingHorizontal: 8,
                                    paddingVertical: 4,
                                    borderRadius: 4,
                                    fontWeight: '600'
                                }}>
                                    🎬 {product.resolutionCamera}
                                </Text>
                            )}
                        </View>

                        {/* Stockage vidéo */}
                        {product.stockageVideo && (
                            <Text style={{ fontSize: 11, color: '#6B7280' }}>
                                💾 {product.stockageVideo}
                            </Text>
                        )}

                        {/* Type alarme */}
                        {product.typeAlarme && (
                            <Text style={{ fontSize: 12, color: '#374151' }}>
                                🚨 {product.typeAlarme}
                            </Text>
                        )}

                        {/* Contrôle d'accès */}
                        {product.controleAcces && (
                            <Text style={{ fontSize: 12, color: '#374151' }}>
                                🔐 {product.controleAcces}
                            </Text>
                        )}

                        {/* Certifications (important pour crédibilité) */}
                        {product.certificationsSecurite && (
                            <View style={{
                                backgroundColor: '#FEF3C7',
                                paddingHorizontal: 10,
                                paddingVertical: 6,
                                borderRadius: 6,
                                alignSelf: 'flex-start'
                            }}>
                                <Text style={{ fontSize: 11, fontWeight: '600', color: '#92400E' }}>
                                    ✅ {product.certificationsSecurite}
                                </Text>
                            </View>
                        )}

                        {/* Marques équipements */}
                        {product.marquesEquipements && (
                            <Text style={{ fontSize: 11, color: '#6B7280' }}>
                                🏷️ {product.marquesEquipements}
                            </Text>
                        )}

                        {/* Durée contrat */}
                        {product.dureeContratSecurite && (
                            <Text style={{ fontSize: 11, color: '#6B7280' }}>
                                📅 Contrat : {product.dureeContratSecurite}
                            </Text>
                        )}

                        {/* Garantie équipement */}
                        {product.garantieEquipement && (
                            <Text style={{ fontSize: 11, color: '#6B7280' }}>
                                🛡️ Garantie : {product.garantieEquipement}
                            </Text>
                        )}

                        {/* Services inclus (badges multiples) */}
                        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                            {product.interventionRapide && (
                                <View style={{
                                    backgroundColor: '#FEF2F2',
                                    paddingHorizontal: 8,
                                    paddingVertical: 4,
                                    borderRadius: 4
                                }}>
                                    <Text style={{ fontSize: 10, fontWeight: '600', color: '#DC2626' }}>
                                        ⚡ Intervention rapide
                                    </Text>
                                </View>
                            )}
                            {product.telesurveillance && (
                                <View style={{
                                    backgroundColor: '#EFF6FF',
                                    paddingHorizontal: 8,
                                    paddingVertical: 4,
                                    borderRadius: 4
                                }}>
                                    <Text style={{ fontSize: 10, fontWeight: '600', color: '#1E40AF' }}>
                                        📡 Télésurveillance
                                    </Text>
                                </View>
                            )}
                            {product.installationIncluse && (
                                <View style={{
                                    backgroundColor: '#F0FDF4',
                                    paddingHorizontal: 8,
                                    paddingVertical: 4,
                                    borderRadius: 4
                                }}>
                                    <Text style={{ fontSize: 10, fontWeight: '600', color: '#15803D' }}>
                                        🔧 Installation incluse
                                    </Text>
                                </View>
                            )}
                            {product.maintenanceIncluse && (
                                <View style={{
                                    backgroundColor: '#F0FDF4',
                                    paddingHorizontal: 8,
                                    paddingVertical: 4,
                                    borderRadius: 4
                                }}>
                                    <Text style={{ fontSize: 10, fontWeight: '600', color: '#15803D' }}>
                                        🛠️ Maintenance
                                    </Text>
                                </View>
                            )}
                            {product.devisGratuit && (
                                <View style={{
                                    backgroundColor: '#FEF3C7',
                                    paddingHorizontal: 8,
                                    paddingVertical: 4,
                                    borderRadius: 4
                                }}>
                                    <Text style={{ fontSize: 10, fontWeight: '600', color: '#92400E' }}>
                                        📋 Devis gratuit
                                    </Text>
                                </View>
                            )}
                            {product.applicationMobile && (
                                <View style={{
                                    backgroundColor: '#F5F3FF',
                                    paddingHorizontal: 8,
                                    paddingVertical: 4,
                                    borderRadius: 4
                                }}>
                                    <Text style={{ fontSize: 10, fontWeight: '600', color: '#6B21A8' }}>
                                        📱 App mobile
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>
                );
            }

            // 💇‍♀️ COIFFURE & BEAUTÉ - 🌍 CONTEXTE AFRIQUE FRANCOPHONE
            case 'coiffure_beaute': {
                return (
                    <View style={{ gap: 12 }}>
                        {/* Type de coiffure/service */}
                        {product.typeCoiffure && (
                            <View style={{
                                backgroundColor: '#FCE4EC',
                                paddingHorizontal: 12,
                                paddingVertical: 8,
                                borderRadius: 8,
                                borderLeftWidth: 3,
                                borderLeftColor: '#E91E63'
                            }}>
                                <Text style={{ fontSize: 14, fontWeight: '700', color: '#E91E63' }}>
                                    💇‍♀️ {product.typeCoiffure}
                                </Text>
                            </View>
                        )}

                        {/* Informations principales (grille) */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                            {/* Longueur */}
                            {product.longueurMech && (
                                <View style={styles.detailChip}>
                                    <SafeIcon name="ruler" size={14} color="#6B7280" />
                                    <Text style={styles.detailText}>{product.longueurMech}</Text>
                                </View>
                            )}

                            {/* Texture */}
                            {product.textureMech && (
                                <View style={styles.detailChip}>
                                    <Text style={styles.detailText}>✨ {product.textureMech}</Text>
                                </View>
                            )}

                            {/* Couleur */}
                            {product.couleurMech && (
                                <View style={styles.detailChip}>
                                    <SafeIcon name="droplet" size={14} color="#6B7280" />
                                    <Text style={styles.detailText}>{product.couleurMech}</Text>
                                </View>
                            )}
                        </View>

                        {/* Informations secondaires */}
                        {(product.typeCheveux || product.typePose || product.origineMech || product.marqueCoiffure) && (
                            <View style={{ gap: 8 }}>
                                {/* Type de cheveux */}
                                {product.typeCheveux && (
                                    <View style={{
                                        backgroundColor: '#D1FAE5',
                                        paddingHorizontal: 10,
                                        paddingVertical: 6,
                                        borderRadius: 6,
                                        flexDirection: 'row',
                                        alignItems: 'center'
                                    }}>
                                        <SafeIcon name="check-circle" size={14} color="#10B981" />
                                        <Text style={{ fontSize: 12, color: '#065F46', marginLeft: 6 }}>
                                            {product.typeCheveux}
                                        </Text>
                                    </View>
                                )}

                                {/* Type de pose */}
                                {product.typePose && (
                                    <View style={{
                                        backgroundColor: '#F3E8FF',
                                        paddingHorizontal: 10,
                                        paddingVertical: 6,
                                        borderRadius: 6,
                                        flexDirection: 'row',
                                        alignItems: 'center'
                                    }}>
                                        <SafeIcon name="scissors" size={14} color="#8B5CF6" />
                                        <Text style={{ fontSize: 12, color: '#6B21A8', marginLeft: 6 }}>
                                            {product.typePose}
                                        </Text>
                                    </View>
                                )}

                                {/* Origine */}
                                {product.origineMech && (
                                    <View style={{
                                        backgroundColor: '#E0F2FE',
                                        paddingHorizontal: 10,
                                        paddingVertical: 6,
                                        borderRadius: 6,
                                        flexDirection: 'row',
                                        alignItems: 'center'
                                    }}>
                                        <SafeIcon name="globe" size={14} color="#0EA5E9" />
                                        <Text style={{ fontSize: 12, color: '#075985', marginLeft: 6 }}>
                                            Origine: {product.origineMech}
                                        </Text>
                                    </View>
                                )}

                                {/* Marque */}
                                {product.marqueCoiffure && (
                                    <View style={{
                                        backgroundColor: '#FEF3C7',
                                        paddingHorizontal: 10,
                                        paddingVertical: 6,
                                        borderRadius: 6,
                                        flexDirection: 'row',
                                        alignItems: 'center'
                                    }}>
                                        <SafeIcon name="tag" size={14} color="#F59E0B" />
                                        <Text style={{ fontSize: 12, color: '#92400E', marginLeft: 6 }}>
                                            {product.marqueCoiffure}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* Durée de vie (produits) */}
                        {product.dureeVie && (
                            <View style={{
                                backgroundColor: '#F5F3FF',
                                paddingHorizontal: 10,
                                paddingVertical: 6,
                                borderRadius: 6,
                                flexDirection: 'row',
                                alignItems: 'center'
                            }}>
                                <SafeIcon name="clock" size={14} color="#8B5CF6" />
                                <Text style={{ fontSize: 12, color: '#6B21A8', marginLeft: 6 }}>
                                    Durée: {product.dureeVie}
                                </Text>
                            </View>
                        )}

                        {/* Durée service (salons) */}
                        {product.dureeService && (
                            <View style={{
                                backgroundColor: '#F0FDF4',
                                paddingHorizontal: 10,
                                paddingVertical: 6,
                                borderRadius: 6,
                                flexDirection: 'row',
                                alignItems: 'center'
                            }}>
                                <SafeIcon name="clock" size={14} color="#10B981" />
                                <Text style={{ fontSize: 12, color: '#065F46', marginLeft: 6 }}>
                                    ⏱️ {product.dureeService}
                                </Text>
                            </View>
                        )}

                        {/* Badges spéciaux */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {product.coiffureADomicile && (
                                <View style={{
                                    backgroundColor: '#DBEAFE',
                                    paddingHorizontal: 8,
                                    paddingVertical: 4,
                                    borderRadius: 4
                                }}>
                                    <Text style={{ fontSize: 10, fontWeight: '600', color: '#1E40AF' }}>
                                        🏠 À domicile
                                    </Text>
                                </View>
                            )}
                            {product.urgenceDisponible && (
                                <View style={{
                                    backgroundColor: '#FEE2E2',
                                    paddingHorizontal: 8,
                                    paddingVertical: 4,
                                    borderRadius: 4
                                }}>
                                    <Text style={{ fontSize: 10, fontWeight: '600', color: '#991B1B' }}>
                                        ⚡ Urgence
                                    </Text>
                                </View>
                            )}
                            {product.reservationRecommandee && (
                                <View style={{
                                    backgroundColor: '#FEF3C7',
                                    paddingHorizontal: 8,
                                    paddingVertical: 4,
                                    borderRadius: 4
                                }}>
                                    <Text style={{ fontSize: 10, fontWeight: '600', color: '#92400E' }}>
                                        📅 Sur RDV
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>
                );
            }

            // 🪵 MENUISERIE & ÉBÉNISTERIE
            case 'menuiserie':
            case 'ebenisterie':
            case 'menuiser':
            case 'menuiserie_bois': {
                // Déterminer le type principal de service
                const getServiceType = () => {
                    if (product.services && product.services.length > 0) {
                        const firstService = product.services[0];
                        if (firstService?.includes('🪑')) return 'Meuble';
                        if (firstService?.includes('🚪')) return 'Porte';
                        if (firstService?.includes('🪟')) return 'Fenêtre';
                        if (firstService?.includes('🏠')) return 'Intérieur';
                        if (firstService?.includes('🌳')) return 'Extérieur';
                        if (firstService?.includes('🔨')) return 'Réparation';
                        if (firstService?.includes('🎨')) return 'Ébénisterie';
                    }
                    return 'Menuiserie';
                };

                const serviceType = getServiceType();

                return (
                    <View style={{ gap: 12 }}>
                        {/* Badge type de service principal */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            <View style={{
                                backgroundColor: '#FFF5F2',
                                borderWidth: 1,
                                borderColor: '#EA580C',
                                paddingHorizontal: 10,
                                paddingVertical: 6,
                                borderRadius: 6
                            }}>
                                <Text style={{ fontSize: 12, fontWeight: '600', color: '#EA580C' }}>
                                    🪵 {serviceType}
                                </Text>
                            </View>

                            {/* Expérience/Niveau */}
                            {(product.niveaux_experience || product.experience) && (
                                <View style={{
                                    backgroundColor: '#DBEAFE',
                                    borderWidth: 1,
                                    borderColor: '#3B82F6',
                                    paddingHorizontal: 10,
                                    paddingVertical: 6,
                                    borderRadius: 6
                                }}>
                                    <Text style={{ fontSize: 11, color: '#1E40AF' }}>
                                        ⭐ {product.niveaux_experience || product.experience}
                                    </Text>
                                </View>
                            )}

                            {/* Certification */}
                            {product.certifications && product.certifications.length > 0 && (
                                <View style={{
                                    backgroundColor: '#F0FDF4',
                                    borderWidth: 1,
                                    borderColor: '#10B981',
                                    paddingHorizontal: 10,
                                    paddingVertical: 6,
                                    borderRadius: 6
                                }}>
                                    <Text style={{ fontSize: 11, color: '#065F46' }}>
                                        🎓 {product.certifications[0]}
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Services proposés */}
                        {product.services && product.services.length > 0 && (
                            <View style={{ gap: 4 }}>
                                <Text style={{ fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 4 }}>
                                    Services proposés:
                                </Text>
                                {product.services.slice(0, 3).map((service: string, idx: number) => (
                                    <View key={idx} style={{
                                        backgroundColor: '#F9FAFB',
                                        paddingHorizontal: 8,
                                        paddingVertical: 4,
                                        borderRadius: 4
                                    }}>
                                        <Text style={{ fontSize: 11, color: '#6B7280' }}>{service}</Text>
                                    </View>
                                ))}
                                {product.services.length > 3 && (
                                    <Text style={{ fontSize: 10, color: '#9CA3AF', fontStyle: 'italic' }}>
                                        +{product.services.length - 3} autres services
                                    </Text>
                                )}
                            </View>
                        )}

                        {/* Type de bois utilisé */}
                        {(product.bois || product.typeBois) && (
                            <View style={{ gap: 4 }}>
                                <Text style={{ fontSize: 12, fontWeight: '600', color: '#374151' }}>
                                    Type de bois:
                                </Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                                    {[product.bois || product.typeBois].flat().slice(0, 3).map((bois: string, idx: number) => (
                                        <View key={idx} style={{
                                            backgroundColor: '#FEF3C7',
                                            borderWidth: 1,
                                            borderColor: '#F59E0B',
                                            paddingHorizontal: 8,
                                            paddingVertical: 4,
                                            borderRadius: 4
                                        }}>
                                            <Text style={{ fontSize: 10, color: '#92400E' }}>🌲 {bois}</Text>
                                        </View>
                                    ))}
                                    {[product.bois || product.typeBois].flat().length > 3 && (
                                        <View style={{
                                            backgroundColor: '#FEF3C7',
                                            borderWidth: 1,
                                            borderColor: '#F59E0B',
                                            paddingHorizontal: 8,
                                            paddingVertical: 4,
                                            borderRadius: 4
                                        }}>
                                            <Text style={{ fontSize: 10, color: '#92400E' }}>
                                                +{([product.bois || product.typeBois].flat().length - 3)} autres
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* Finitions */}
                        {product.finitions && product.finitions.length > 0 && (
                            <View style={{ gap: 4 }}>
                                <Text style={{ fontSize: 12, fontWeight: '600', color: '#374151' }}>
                                    Finitions:
                                </Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                                    {product.finitions.slice(0, 4).map((finition: string, idx: number) => (
                                        <View key={idx} style={{
                                            backgroundColor: '#F3E8FF',
                                            borderWidth: 1,
                                            borderColor: '#A855F7',
                                            paddingHorizontal: 8,
                                            paddingVertical: 4,
                                            borderRadius: 4
                                        }}>
                                            <Text style={{ fontSize: 10, color: '#6B21A8' }}>✨ {finition}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}

                        {/* Informations complémentaires */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {/* Délai */}
                            {product.delais && (
                                <View style={{
                                    backgroundColor: '#F0FDF4',
                                    paddingHorizontal: 8,
                                    paddingVertical: 6,
                                    borderRadius: 6,
                                    flexDirection: 'row',
                                    alignItems: 'center'
                                }}>
                                    <SafeIcon name="clock" size={14} color="#10B981" />
                                    <Text style={{ fontSize: 11, color: '#065F46', marginLeft: 4 }}>
                                        {product.delais}
                                    </Text>
                                </View>
                            )}

                            {/* Garantie */}
                            {product.garanties && product.garanties.length > 0 && (
                                <View style={{
                                    backgroundColor: '#EFF6FF',
                                    paddingHorizontal: 8,
                                    paddingVertical: 6,
                                    borderRadius: 6,
                                    flexDirection: 'row',
                                    alignItems: 'center'
                                }}>
                                    <SafeIcon name="shield-check" size={14} color="#3B82F6" />
                                    <Text style={{ fontSize: 11, color: '#1E40AF', marginLeft: 4 }}>
                                        {product.garanties[0]}
                                    </Text>
                                </View>
                            )}

                            {/* Atelier */}
                            {product.marques_ateliers && (
                                <View style={{
                                    backgroundColor: '#FFF7ED',
                                    paddingHorizontal: 8,
                                    paddingVertical: 6,
                                    borderRadius: 6
                                }}>
                                    <Text style={{ fontSize: 11, color: '#9A3412' }}>
                                        🏭 {product.marques_ateliers}
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Modes de paiement */}
                        {product.modes_paiement && product.modes_paiement.length > 0 && (
                            <View style={{ gap: 4 }}>
                                <Text style={{ fontSize: 11, color: '#6B7280' }}>
                                    💳 {product.modes_paiement.slice(0, 3).join(' • ')}
                                    {product.modes_paiement.length > 3 && ` +${product.modes_paiement.length - 3}`}
                                </Text>
                            </View>
                        )}
                    </View>
                );
            }

            // ✅ PRODUCTEURS LOCAUX (Agriculture & Élevage)
            case 'producteurs_locaux':
            case 'agriculture':
            case 'agriculture_elevage':
            case 'elevage':
            case 'élevage':
            case 'producteur': {
                return (
                    <View style={styles.detailsSection}>
                        {/* Catégorie principale */}
                        {product.categorie_principale && (
                            <View style={styles.mecanicienIdentity}>
                                <Text style={styles.mecanicienIdentityText}>
                                    {product.categorie_principale}
                                </Text>
                            </View>
                        )}

                        {/* Type de produit agricole */}
                        {product.typeProduitAgricole && (
                            <View style={styles.mecanicienSpecialites}>
                                <Text style={styles.mecanicienSpecialitesTitle}>Produit :</Text>
                                <View style={styles.tagsContainer}>
                                    <View style={styles.mecanicienSpecTag}>
                                        <Text style={styles.mecanicienSpecText}>{product.typeProduitAgricole}</Text>
                                    </View>
                                </View>
                            </View>
                        )}

                        {/* Type d'animal d'élevage */}
                        {product.typeAnimalElevage && (
                            <View style={styles.mecanicienSpecialites}>
                                <Text style={styles.mecanicienSpecialitesTitle}>Animal :</Text>
                                <View style={styles.tagsContainer}>
                                    <View style={styles.mecanicienSpecTag}>
                                        <Text style={styles.mecanicienSpecText}>{product.typeAnimalElevage}</Text>
                                    </View>
                                </View>
                            </View>
                        )}

                        {/* Unité de mesure */}
                        {product.uniteMesureAgricole && (
                            <View style={styles.mecanicienServices}>
                                <Text style={styles.prestationLabel}>Unité :</Text>
                                <View style={styles.tagsContainer}>
                                    <View style={styles.serviceTag}>
                                        <Text style={styles.serviceText}>{product.uniteMesureAgricole}</Text>
                                    </View>
                                </View>
                            </View>
                        )}

                        {/* Type de vente */}
                        {product.typeVenteCommercial && Array.isArray(product.typeVenteCommercial) && product.typeVenteCommercial.length > 0 && (
                            <View style={styles.mecanicienMarques}>
                                <Text style={styles.prestationLabel}>Type de vente :</Text>
                                <View style={styles.tagsContainer}>
                                    {product.typeVenteCommercial.slice(0, 3).map((type: string, idx: number) => (
                                        <View key={idx} style={styles.serviceTag}>
                                            <Text style={styles.serviceText}>{type}</Text>
                                        </View>
                                    ))}
                                    {product.typeVenteCommercial.length > 3 && (
                                        <View style={styles.serviceTag}>
                                            <Text style={styles.serviceText}>+{product.typeVenteCommercial.length - 3}</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* Origine géographique */}
                        {product.origineGeo && (
                            <View style={styles.mecanicienServices}>
                                <Text style={styles.prestationLabel}>Origine :</Text>
                                <View style={styles.tagsContainer}>
                                    <View style={styles.serviceTag}>
                                        <SafeIcon name="map-pin" size={12} color="#059669" />
                                        <Text style={styles.serviceText}>{product.origineGeo}</Text>
                                    </View>
                                </View>
                            </View>
                        )}

                        {/* Qualité & Labels */}
                        {product.qualiteLabels && Array.isArray(product.qualiteLabels) && product.qualiteLabels.length > 0 && (
                            <View style={styles.mecanicienMarques}>
                                <Text style={styles.prestationLabel}>Qualité & Labels :</Text>
                                <View style={styles.tagsContainer}>
                                    {product.qualiteLabels.slice(0, 4).map((label: string, idx: number) => (
                                        <View key={idx} style={[styles.serviceTag, { backgroundColor: '#D1FAE5' }]}>
                                            <SafeIcon name="check-circle" size={12} color="#059669" />
                                            <Text style={[styles.serviceText, { color: '#065F46' }]}>{label}</Text>
                                        </View>
                                    ))}
                                    {product.qualiteLabels.length > 4 && (
                                        <View style={styles.serviceTag}>
                                            <Text style={styles.serviceText}>+{product.qualiteLabels.length - 4}</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        )}
                    </View>
                );
            }

            case 'creche_garderie': {
                return (
                    <View style={{ gap: 12 }}>
                        {/* Type d'établissement */}
                        {product.typeEtablissement && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="building" size={14} color="#EC4899" />
                                <Text style={styles.detailText}>{product.typeEtablissement}</Text>
                            </View>
                        )}

                        {/* Tranches d'âge */}
                        {product.tranchesAge && Array.isArray(product.tranchesAge) && product.tranchesAge.length > 0 && (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                {product.tranchesAge.slice(0, 3).map((tranche: string, idx: number) => (
                                    <View key={idx} style={[styles.detailChip, { backgroundColor: '#FCE7F3' }]}>
                                        <Text style={[styles.detailText, { color: '#EC4899', fontSize: 12 }]}>{tranche}</Text>
                                    </View>
                                ))}
                                {product.tranchesAge.length > 3 && (
                                    <View style={styles.detailChip}>
                                        <Text style={styles.detailText}>+{product.tranchesAge.length - 3} tranches</Text>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* Capacité */}
                        {product.capaciteAccueil && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="users" size={14} color="#6B7280" />
                                <Text style={styles.detailText}>{product.capaciteAccueil}</Text>
                            </View>
                        )}

                        {/* Horaires de garde */}
                        {product.horairesGarde && Array.isArray(product.horairesGarde) && product.horairesGarde.length > 0 && (
                            <View style={{ gap: 6 }}>
                                <Text style={{ fontSize: 12, fontWeight: '600', color: '#374151' }}>⏰ Horaires de garde :</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                    {product.horairesGarde.slice(0, 2).map((horaire: string, idx: number) => (
                                        <View key={idx} style={[styles.detailChip, { backgroundColor: '#FEF3C7' }]}>
                                            <Text style={[styles.detailText, { color: '#92400E', fontSize: 11 }]}>{horaire}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}

                        {/* Services proposés */}
                        {product.servicesProproses && Array.isArray(product.servicesProproses) && product.servicesProproses.length > 0 && (
                            <View style={{ gap: 6 }}>
                                <Text style={{ fontSize: 12, fontWeight: '600', color: '#374151' }}>✨ Services :</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                    {product.servicesProproses.slice(0, 4).map((service: string, idx: number) => (
                                        <View key={idx} style={[styles.detailChip, { backgroundColor: '#ECFCCB' }]}>
                                            <Text style={[styles.detailText, { color: '#365314', fontSize: 11 }]}>{service}</Text>
                                        </View>
                                    ))}
                                    {product.servicesProproses.length > 4 && (
                                        <View style={styles.detailChip}>
                                            <Text style={styles.detailText}>+{product.servicesProproses.length - 4} services</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* Langues parlées */}
                        {product.languesParlees && Array.isArray(product.languesParlees) && product.languesParlees.length > 0 && (
                            <View style={{ gap: 6 }}>
                                <Text style={{ fontSize: 12, fontWeight: '600', color: '#374151' }}>🗣️ Langues :</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                    {product.languesParlees.slice(0, 3).map((langue: string, idx: number) => (
                                        <View key={idx} style={[styles.detailChip, { backgroundColor: '#DBEAFE' }]}>
                                            <Text style={[styles.detailText, { color: '#1E40AF', fontSize: 11 }]}>{langue}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}

                        {/* Certifications & Agréments */}
                        {product.certificationsAgrements && Array.isArray(product.certificationsAgrements) && product.certificationsAgrements.length > 0 && (
                            <View style={{ gap: 6 }}>
                                <Text style={{ fontSize: 12, fontWeight: '600', color: '#374151' }}>✅ Agréments :</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                    {product.certificationsAgrements.slice(0, 3).map((cert: string, idx: number) => (
                                        <View key={idx} style={[styles.detailChip, { backgroundColor: '#D1FAE5' }]}>
                                            <SafeIcon name="check-circle" size={12} color="#059669" />
                                            <Text style={[styles.detailText, { color: '#065F46', fontSize: 11 }]}>{cert}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}

                        {/* Places disponibles */}
                        {product.placesDisponibles && (
                            <View style={[styles.detailChip, { backgroundColor: '#ECFDF5' }]}>
                                <SafeIcon name="zap" size={14} color="#059669" />
                                <Text style={[styles.detailText, { color: '#047857' }]}>Places disponibles immédiatement</Text>
                            </View>
                        )}
                    </View>
                );
            }

            // ════════════════════════════════════════════════════════════
            // 📐 INGÉNIEUR / ARCHITECTE - ULTRA-SPÉCIALISÉ BTP
            // ════════════════════════════════════════════════════════════
            case 'ingenieur_archi': {
                return (
                    <View style={{ gap: 12 }}>
                        {/* ✅ NOUVEAU: Type de prestation principal */}
                        {product.typePrestation && (
                            <View style={styles.ingenieurBadge}>
                                <SafeIcon name="compass" size={14} color="#0891B2" />
                                <Text style={styles.ingenieurText}>📐 {product.typePrestation}</Text>
                            </View>
                        )}

                        {/* ✅ NOUVEAU: Services proposés (badges colorés) */}
                        {product.services && product.services.length > 0 && (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                {product.services.slice(0, 3).map((service: string, idx: number) => (
                                    <View key={idx} style={styles.ingenieurServiceBadge}>
                                        <Text style={styles.ingenieurServiceText}>{service}</Text>
                                    </View>
                                ))}
                                {product.services.length > 3 && (
                                    <View style={styles.ingenieurServiceBadge}>
                                        <Text style={styles.ingenieurServiceText}>+{product.services.length - 3}</Text>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* ✅ NOUVEAU: Domaines de compétence */}
                        {product.domaines && product.domaines.length > 0 && (
                            <View style={{ gap: 4 }}>
                                <Text style={{ fontSize: 11, fontWeight: '600', color: '#374151' }}>🎯 Domaines:</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                                    {product.domaines.slice(0, 4).map((domaine: string, idx: number) => (
                                        <View key={idx} style={styles.ingenieurDomaineBadge}>
                                            <Text style={styles.ingenieurDomaineText}>{domaine}</Text>
                                        </View>
                                    ))}
                                    {product.domaines.length > 4 && (
                                        <View style={styles.ingenieurDomaineBadge}>
                                            <Text style={styles.ingenieurDomaineText}>+{product.domaines.length - 4}</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* ✅ NOUVEAU: Logiciels maîtrisés */}
                        {product.logiciels && product.logiciels.length > 0 && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <SafeIcon name="monitor" size={14} color="#8B5CF6" />
                                <Text style={styles.ingenieurLogiciels}>
                                    💻 {product.logiciels.slice(0, 3).join(', ')}
                                    {product.logiciels.length > 3 && ` +${product.logiciels.length - 3}`}
                                </Text>
                            </View>
                        )}

                        {/* ✅ NOUVEAU: Types de projets */}
                        {product.types_projet && product.types_projet.length > 0 && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <SafeIcon name="home" size={14} color="#F59E0B" />
                                <Text style={styles.ingenieurProjets}>
                                    🏗️ {product.types_projet.slice(0, 2).join(' • ')}
                                    {product.types_projet.length > 2 && ` +${product.types_projet.length - 2}`}
                                </Text>
                            </View>
                        )}

                        {/* ✅ NOUVEAU: Certifications professionnelles */}
                        {product.certifications && product.certifications.length > 0 && (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                {product.certifications.slice(0, 2).map((cert: string, idx: number) => (
                                    <View key={idx} style={styles.ingenieurCertBadge}>
                                        <SafeIcon name="award" size={12} color="#059669" />
                                        <Text style={styles.ingenieurCertText}>✅ {cert}</Text>
                                    </View>
                                ))}
                                {product.certifications.length > 2 && (
                                    <View style={styles.ingenieurCertBadge}>
                                        <Text style={styles.ingenieurCertText}>+{product.certifications.length - 2}</Text>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* ✅ NOUVEAU: Disponibilité et tarification */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {product.disponibilitePrestation && (
                                <View style={styles.ingenieurDispoBadge}>
                                    <SafeIcon name="clock" size={12} color="#6B7280" />
                                    <Text style={styles.ingenieurDispoText}>{product.disponibilitePrestation}</Text>
                                </View>
                            )}
                            {product.modeTarification && (
                                <View style={styles.ingenieurTarifBadge}>
                                    <SafeIcon name="dollar-sign" size={12} color="#10B981" />
                                    <Text style={styles.ingenieurTarifText}>{product.modeTarification}</Text>
                                </View>
                            )}
                            {product.devisGratuit && (
                                <View style={styles.ingenieurDevisBadge}>
                                    <SafeIcon name="file-text" size={12} color="#059669" />
                                    <Text style={styles.ingenieurDevisText}>Devis gratuit</Text>
                                </View>
                            )}
                        </View>

                        {/* ✅ NOUVEAU: Zones d'intervention */}
                        {product.zonesIntervention && product.zonesIntervention.length > 0 && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <SafeIcon name="map-pin" size={14} color="#6366F1" />
                                <Text style={styles.ingenieurZones}>
                                    📍 {product.zonesIntervention.slice(0, 2).join(', ')}
                                    {product.zonesIntervention.length > 2 && ` +${product.zonesIntervention.length - 2}`}
                                </Text>
                            </View>
                        )}

                        {/* ✅ NOUVEAU: Livrables proposés */}
                        {product.livrables && product.livrables.length > 0 && (
                            <View style={{ gap: 4 }}>
                                <Text style={{ fontSize: 11, fontWeight: '600', color: '#374151' }}>📋 Livrables:</Text>
                                <Text style={{ fontSize: 11, color: '#6B7280' }}>
                                    {product.livrables.slice(0, 3).join(' • ')}
                                    {product.livrables.length > 3 && ` +${product.livrables.length - 3}`}
                                </Text>
                            </View>
                        )}
                    </View>
                );
            }

            default:
                return null;
        }
    };

    // ========== ANCIEN CODE COIFFURE_BEAUTE (conservé pour référence) ========== //
    const renderCoiffureBeauteDetails = () => {
        if (product.type !== 'coiffure_beaute') return null;
        return (
            <View style={styles.detailsSection}>
                {product.typeCoiffure && (
                    <View style={styles.detailChip}>
                        <Text style={styles.detailText}>💇 {product.typeCoiffure}</Text>
                    </View>
                )}
            </View>
        );
    };

    const renderOldBijouxDetails = () => {
        if (product.type !== 'bijoux_old') return null;
        return (
            <View style={styles.detailsGrid}>
                {product.matiereBijou && (
                    <View style={styles.detailChip}>
                        <Text style={styles.detailText}>💎 {product.matiereBijou}</Text>
                    </View>
                )}
                {product.poidsBijou && product.unitePoids && (
                    <View style={styles.detailChip}>
                        <SafeIcon name="scale" size={14} color="#6B7280" />
                        <Text style={styles.detailText}>{product.poidsBijou} {product.unitePoids}</Text>
                    </View>
                )}
                {product.tailleBijou && (
                    <View style={styles.detailChip}>
                        <SafeIcon name="maximize" size={14} color="#6B7280" />
                        <Text style={styles.detailText}>Taille: {product.tailleBijou}</Text>
                    </View>
                )}
                {product.styleBijou && (
                    <View style={styles.detailChip}>
                        <Text style={styles.detailText}>✨ {product.styleBijou}</Text>
                    </View>
                )}
                {product.origineBijou && (
                    <View style={styles.detailChip}>
                        <SafeIcon name="globe" size={14} color="#10B981" />
                        <Text style={styles.detailText}>Origine: {product.origineBijou}</Text>
                    </View>
                )}
                {product.certificatBijou && (
                    <View style={[styles.detailChip, styles.certificateChip]}>
                        <SafeIcon name="award" size={14} color="#10B981" />
                        <Text style={[styles.detailText, styles.certificateText]}>
                            Certifié: {product.certificatBijou}
                        </Text>
                    </View>
                )}
            </View>
        );
    };

    // ========== FONCTION PRINCIPALE renderCategoryDetails ========== //
    const renderOldCategoryDetails = () => {
        switch (product.type) {
            case 'coiffure_beaute':
                return (
                    <View style={styles.detailsSection}>
                        {/* Type de coiffure */}
                        {product.typeCoiffure && (
                            <View style={styles.detailChip}>
                                <Text style={styles.detailText}>💇‍♀️ {product.typeCoiffure}</Text>
                            </View>
                        )}

                        <View style={styles.detailsGrid}>
                            {/* Longueur */}
                            {product.longueurMech && (
                                <View style={styles.detailChip}>
                                    <SafeIcon name="ruler" size={14} color="#6B7280" />
                                    <Text style={styles.detailText}>{product.longueurMech}</Text>
                                </View>
                            )}

                            {/* Texture */}
                            {product.textureMech && (
                                <View style={styles.detailChip}>
                                    <Text style={styles.detailText}>✨ {product.textureMech}</Text>
                                </View>
                            )}

                            {/* Couleur */}
                            {product.couleurMech && (
                                <View style={styles.detailChip}>
                                    <SafeIcon name="droplet" size={14} color="#6B7280" />
                                    <Text style={styles.detailText}>{product.couleurMech}</Text>
                                </View>
                            )}
                        </View>

                        {/* Type de cheveux */}
                        {product.typeCheveux && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="check-circle" size={14} color="#10B981" />
                                <Text style={styles.detailText}>{product.typeCheveux}</Text>
                            </View>
                        )}

                        {/* Origine */}
                        {product.origineMech && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="globe" size={14} color="#10B981" />
                                <Text style={styles.detailText}>Origine: {product.origineMech}</Text>
                            </View>
                        )}

                        {/* Marque */}
                        {product.marqueCoiffure && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="tag" size={14} color="#EC4899" />
                                <Text style={styles.detailText}>{product.marqueCoiffure}</Text>
                            </View>
                        )}

                        {/* Durée de vie */}
                        {product.dureeVie && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="clock" size={14} color="#8B5CF6" />
                                <Text style={styles.detailText}>Durée: {product.dureeVie}</Text>
                            </View>
                        )}
                    </View>
                );

            case 'couturier':
                return (
                    <View style={styles.detailsSection}>
                        {/* Type de service de couture */}
                        {product.typeCouture && (
                            <View style={styles.detailChip}>
                                <Text style={styles.detailText}>🪡 {product.typeCouture}</Text>
                            </View>
                        )}

                        <View style={styles.detailsGrid}>
                            {/* Tissu */}
                            {product.tissuCouture && (
                                <View style={styles.detailChip}>
                                    <SafeIcon name="tag" size={14} color="#9C27B0" />
                                    <Text style={styles.detailText}>{product.tissuCouture}</Text>
                                </View>
                            )}

                            {/* Style */}
                            {product.styleCouture && (
                                <View style={styles.detailChip}>
                                    <Text style={styles.detailText}>✨ {product.styleCouture}</Text>
                                </View>
                            )}

                            {/* Genre */}
                            {product.genreCouture && (
                                <View style={styles.detailChip}>
                                    <SafeIcon name="user" size={14} color="#6B7280" />
                                    <Text style={styles.detailText}>{product.genreCouture}</Text>
                                </View>
                            )}
                        </View>

                        {/* Occasion */}
                        {product.occasionCouture && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="calendar" size={14} color="#EC4899" />
                                <Text style={styles.detailText}>Occasion: {product.occasionCouture}</Text>
                            </View>
                        )}

                        {/* Délai */}
                        {product.delaiCouture && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="clock" size={14} color="#F59E0B" />
                                <Text style={styles.detailText}>Délai: {product.delaiCouture}</Text>
                            </View>
                        )}

                        {/* Spécialité */}
                        {product.specialiteCouturier && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="star" size={14} color="#10B981" />
                                <Text style={styles.detailText}>{product.specialiteCouturier}</Text>
                            </View>
                        )}

                        {/* Expérience */}
                        {product.experienceCouturier && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="award" size={14} color="#8B5CF6" />
                                <Text style={styles.detailText}>{product.experienceCouturier}</Text>
                            </View>
                        )}

                        {/* Finition */}
                        {product.finitionCouture && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="check-circle" size={14} color="#10B981" />
                                <Text style={styles.detailText}>Finition: {product.finitionCouture}</Text>
                            </View>
                        )}

                        {/* Lieu de travail */}
                        {product.lieuTravailCouturier && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="map-pin" size={14} color="#3B82F6" />
                                <Text style={styles.detailText}>{product.lieuTravailCouturier}</Text>
                            </View>
                        )}
                    </View>
                );

            default:
                return null;
        }
    };

    return (
        <TouchableOpacity
            style={styles.card}
            onPress={onPress}
            activeOpacity={0.95}
        >
            <View style={styles.cardContent}>
                {/* Image principale avec vidéo overlay - ✅ OPTIMISATION 3 */}
                <View style={styles.imageContainer}>
                    {mainImage ? (
                        <OptimizedImage
                            uri={mainImage}
                            style={styles.mainImage}
                            resizeMode="cover"
                            placeholderIcon="package"
                            placeholderColor="#D1D5DB"
                            showLoadingIndicator={true}
                        />
                    ) : (
                        <View style={[styles.mainImage, styles.noImageContainer]}>
                            <SafeIcon name="package" size={48} color="#D1D5DB" />
                        </View>
                    )}

                    {/* Badge type de produit */}
                    <View style={[styles.typeBadge, { backgroundColor: typeStyle.bg }]}>
                        <SafeIcon name={typeStyle.icon} size={14} color={typeStyle.color} />
                        <Text style={[styles.typeText, { color: typeStyle.color }]}>{typeStyle.label}</Text>
                    </View>

                    {/* ✅ Badge PROMOTION si produit en promotion */}
                    {(product.en_promotion || product.promotion_active) && (
                        <View style={styles.promoBadge}>
                            <LinearGradient
                                colors={['#F59E0B', '#EF4444']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.promoBadgeGradient}
                            >
                                <SafeIcon name="zap" size={12} color="#FFFFFF" />
                                <Text style={styles.promoText}>PROMO</Text>
                            </LinearGradient>
                        </View>
                    )}

                    {/* Indicateur vidéo si présente */}
                    {hasVideo && (
                        <View style={styles.videoIndicator}>
                            <SafeIcon name="play-circle" size={20} color="#FFFFFF" />
                        </View>
                    )}

                    {/* Galerie miniature si plusieurs images - Clickable */}
                    {images.length > 1 && (
                        <TouchableOpacity
                            style={styles.imageCountBadge}
                            onPress={onGalleryPress}
                            activeOpacity={0.8}
                        >
                            <SafeIcon name="image" size={12} color="#FFFFFF" />
                            <Text style={styles.imageCountText}>{images.length}</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Informations du produit */}
                <View style={styles.infoContainer}>
                    {/* Nom du produit */}
                    <Text style={styles.productName} numberOfLines={2}>
                        {product.nom || product.name || product.titre || 'Produit'}
                    </Text>

                    {/* Description courte */}
                    {product.description && (
                        <Text style={styles.productDescription} numberOfLines={2}>
                            {product.description}
                        </Text>
                    )}

                    {/* Détails spécifiques par type */}
                    {renderProductDetails()}

                    {/* Prix */}
                    {formatPrice() && (
                        <View style={styles.priceContainer}>
                            <LinearGradient
                                colors={['#3B82F6', '#1D4ED8']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.priceGradient}
                            >
                                <SafeIcon name="tag" size={16} color="#FFFFFF" />
                                <Text style={styles.priceText}>{formatPrice()}</Text>
                            </LinearGradient>
                        </View>
                    )}

                    {/* Localisation intelligente avec drapeau du pays 🇨🇲 - ✅ CLIQUABLE POUR NAVIGATION */}
                    {locationData && !locationLoading ? (
                        <TouchableOpacity
                            style={styles.locationContainer}
                            onPress={async () => {
                                if (!displayGPS) {
                                    Alert.alert('Localisation', locationData.location || 'Localisation non disponible');
                                    return;
                                }
                                try {
                                    // Parser les coordonnées GPS
                                    const coords = displayGPS.split(',').map((c: string) => parseFloat(c.trim()));
                                    if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
                                        const [lat, lng] = coords;
                                        const label = product.nom || product.name || 'Destination';

                                        // URL universelle compatible iOS et Android
                                        const url = Platform.OS === 'ios'
                                            ? `maps://app?daddr=${lat},${lng}&q=${encodeURIComponent(label)}`
                                            : `geo:${lat},${lng}?q=${lat},${lng}(${encodeURIComponent(label)})`;

                                        const canOpen = await Linking.canOpenURL(url);
                                        if (canOpen) {
                                            await Linking.openURL(url);
                                        } else {
                                            // Fallback : Google Maps web
                                            const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
                                            await Linking.openURL(webUrl);
                                        }
                                    } else {
                                        Alert.alert('Info', 'Coordonnées GPS non valides');
                                    }
                                } catch (error) {
                                    console.error('Erreur ouverture navigation:', error);
                                    Alert.alert('Erreur', 'Impossible d\'ouvrir la navigation');
                                }
                            }}
                            activeOpacity={0.7}
                        >
                            <SafeIcon name="map-pin" size={14} color="#10B981" />
                            <Text style={[styles.locationText, { color: '#10B981', fontWeight: '600' }]} numberOfLines={1}>
                                {locationData.location || product.quartier || product.ville || 'Localisation'}
                            </Text>
                            {locationData.countryFlag && (
                                <Text style={styles.countryFlagText}>{locationData.countryFlag}</Text>
                            )}
                            {product.distance && (
                                <>
                                    <Text style={styles.distanceText}>• {product.distance.toFixed(1)} km</Text>
                                    <Text style={styles.travelTimeText}>
                                        (~{Math.ceil(product.distance / 30 * 60)} min)
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>
                    ) : displayGPS ? (
                        // Fallback : Affichage GPS classique si locationData indisponible
                        <TouchableOpacity
                            style={styles.locationContainer}
                            onPress={async () => {
                                try {
                                    const coords = displayGPS.split(',').map((c: string) => parseFloat(c.trim()));
                                    if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
                                        const [lat, lng] = coords;
                                        const label = product.nom || product.name || 'Destination';
                                        const url = Platform.OS === 'ios'
                                            ? `maps://app?daddr=${lat},${lng}&q=${encodeURIComponent(label)}`
                                            : `geo:${lat},${lng}?q=${lat},${lng}(${encodeURIComponent(label)})`;
                                        const canOpen = await Linking.canOpenURL(url);
                                        if (canOpen) {
                                            await Linking.openURL(url);
                                        } else {
                                            const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
                                            await Linking.openURL(webUrl);
                                        }
                                    }
                                } catch (error) {
                                    console.error('Erreur navigation:', error);
                                }
                            }}
                            activeOpacity={0.7}
                        >
                            <SafeIcon name="navigation" size={14} color="#10B981" />
                            <Text style={[styles.locationText, { color: '#10B981', fontWeight: '600' }]} numberOfLines={1}>
                                {product.quartier || product.ville || 'Ouvrir navigation'}
                            </Text>
                            {product.distance && (
                                <>
                                    <Text style={styles.distanceText}>• {product.distance.toFixed(1)} km</Text>
                                    <Text style={styles.travelTimeText}>
                                        (~{Math.ceil(product.distance / 30 * 60)} min)
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>
                    ) : null}

                    {/* Statistiques */}
                    <View style={styles.statsContainer}>
                        <View style={styles.statItem}>
                            <SafeIcon name="eye" size={12} color="#6B7280" />
                            <Text style={styles.statText}>{product.views || service.views || 0}</Text>
                        </View>
                        <View style={styles.statItem}>
                            <SafeIcon name="share-2" size={12} color="#6B7280" />
                            <Text style={styles.statText}>{product.shares || 0}</Text>
                        </View>
                        <View style={styles.statItem}>
                            <SafeIcon name="star" size={12} color="#F59E0B" />
                            <Text style={styles.statText}>{product.rating || service.rating || '—'}</Text>
                        </View>
                        <View style={styles.statItem}>
                            <SafeIcon name="message-square" size={12} color="#6B7280" />
                            <Text style={styles.statText}>{product.reviews || 0}</Text>
                        </View>
                    </View>

                    {/* Informations prestataire */}
                    {prestataire && (
                        <View style={styles.prestataireInfo}>
                            <View style={styles.prestataireAvatar}>
                                {prestataire.avatar ? (
                                    <Image source={{ uri: prestataire.avatar }} style={styles.avatarImage} />
                                ) : (
                                    <SafeIcon name="user" size={16} color="#6B7280" />
                                )}
                            </View>
                            <Text style={styles.prestataireName} numberOfLines={1}>
                                {prestataire.name || 'Prestataire'}
                            </Text>
                            {prestataire.isOnline && (
                                <View style={styles.onlineIndicator} />
                            )}
                        </View>
                    )}

                    {/* Bouton de réservation pour ticket_voyage */}
                    {product.type === 'ticket_voyage' && product.seatMap && product.busConfiguration && onBookSeat && (() => {
                        const validation = isTicketStillValid(product);
                        const warning = validation.daysUntilDeparture ? getDepartureWarning(validation.daysUntilDeparture) : null;

                        if (!validation.valid) {
                            // Ticket expiré ou complet
                            return (
                                <View style={styles.ticketExpiredBanner}>
                                    <SafeIcon name="alert-circle" size={20} color="#EF4444" />
                                    <Text style={styles.ticketExpiredText}>
                                        {validation.reason}
                                    </Text>
                                </View>
                            );
                        }

                        return (
                            <>
                                {warning && (
                                    <View style={styles.departureWarningBanner}>
                                        <SafeIcon name="clock" size={16} color="#F59E0B" />
                                        <Text style={styles.departureWarningText}>{warning}</Text>
                                    </View>
                                )}
                                <TouchableOpacity
                                    style={styles.bookSeatButton}
                                    onPress={onBookSeat}
                                >
                                    <SafeIcon name="grid" size={20} color="#FFFFFF" />
                                    <Text style={styles.bookSeatButtonText}>🎫 Réserver une place</Text>
                                    <Text style={styles.bookSeatSubtext}>
                                        {validation.availableSeats} place{validation.availableSeats > 1 ? 's' : ''} • Départ dans {validation.daysUntilDeparture}j
                                    </Text>
                                </TouchableOpacity>
                            </>
                        );
                    })()}

                    {/* Actions */}
                    <View style={styles.actions}>
                        {/* Bouton Chat principal - TOUJOURS PRIORITAIRE */}
                        <TouchableOpacity
                            style={[styles.chatButton, { backgroundColor: categoryStyle.primaryColor }]}
                            onPress={onChatPress}
                        >
                            <SafeIcon name="message-square" size={18} color="#FFFFFF" />
                            <Text style={styles.chatButtonText}>Discuter</Text>
                        </TouchableOpacity>

                        <View style={styles.secondaryActions}>
                            {/* Bouton Galerie */}
                            {(images.length > 0 || videos.length > 0) && (
                                <TouchableOpacity
                                    style={styles.actionIconButton}
                                    onPress={onGalleryPress}
                                >
                                    <SafeIcon name="image" size={16} color="#8B5CF6" />
                                </TouchableOpacity>
                            )}

                            {/* Bouton Chat/Messages (ChatModal interne) */}
                            {onChatPress && (
                                <TouchableOpacity
                                    style={styles.actionIconButton}
                                    onPress={onChatPress}
                                >
                                    <SafeIcon name="message-circle" size={16} color="#3B82F6" />
                                </TouchableOpacity>
                            )}

                            {/* Bouton Téléphone */}
                            {prestataire?.telephone && (
                                <TouchableOpacity
                                    style={styles.actionIconButton}
                                    onPress={async () => {
                                        const phoneNumber = prestataire?.telephone;
                                        if (phoneNumber) {
                                            try {
                                                const telUrl = `tel:${phoneNumber.replace(/\s+/g, '')}`;
                                                const canOpen = await Linking.canOpenURL(telUrl);
                                                if (canOpen) {
                                                    await Linking.openURL(telUrl);
                                                } else {
                                                    Alert.alert('Erreur', 'Impossible de passer l\'appel');
                                                }
                                            } catch (error) {
                                                Alert.alert('Erreur', 'Impossible d\'ouvrir l\'application téléphone');
                                            }
                                        }
                                    }}
                                >
                                    <SafeIcon name="phone" size={16} color="#10B981" />
                                </TouchableOpacity>
                            )}


                            <TouchableOpacity
                                style={styles.actionIconButton}
                                onPress={async () => {
                                    try {
                                        // Générer les liens deep link et web
                                        const deepLink = `yukpomnang://product/${product.id}?serviceId=${service.id}`;
                                        const webLink = `https://yukpomnang.com/product/${product.id}`;

                                        const shareMessage = `🛍️ ${product.nom || 'Produit'}\n\n` +
                                            `💰 Prix: ${formatPrice()}\n\n` +
                                            `${product.description || ''}\n\n` +
                                            `📦 Service: ${service.data?.titre_service?.valeur || service.titre || 'Service'}\n` +
                                            `👤 Par: ${prestataire?.nom_structure || prestataire?.username || 'Prestataire'}\n\n` +
                                            `📱 Voir dans l'app: ${deepLink}\n` +
                                            `🌐 Voir en ligne: ${webLink}`;

                                        const result = await Share.share({
                                            message: shareMessage,
                                            title: `Découvrez: ${product.nom || 'Produit'}`,
                                            url: webLink,
                                        });

                                        if (result.action === Share.sharedAction) {
                                            console.log('✅ Produit partagé:', product.nom);
                                        }
                                    } catch (error) {
                                        console.error('Erreur partage:', error);
                                    }
                                }}
                            >
                                <SafeIcon name="share-2" size={16} color="#6B7280" />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    card: {
        marginHorizontal: 16,
        marginVertical: 8,
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 5,
        overflow: 'hidden',
    },
    cardContent: {
        flexDirection: 'row',
    },
    imageContainer: {
        width: width * 0.4,
        height: 180,
        position: 'relative',
    },
    mainImage: {
        width: '100%',
        height: '100%',
    },
    noImageContainer: {
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    typeBadge: {
        position: 'absolute',
        top: 8,
        left: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    typeText: {
        fontSize: 10,
        fontWeight: '600',
    },
    promoBadge: {
        position: 'absolute',
        top: 42,
        left: 8,
        borderRadius: 8,
        overflow: 'hidden',
    },
    promoBadgeGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    promoText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    videoIndicator: {
        position: 'absolute',
        bottom: 8,
        right: 8,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        borderRadius: 20,
        padding: 6,
    },
    imageCountBadge: {
        position: 'absolute',
        bottom: 8,
        left: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    imageCountText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '600',
    },
    infoContainer: {
        flex: 1,
        padding: 12,
        justifyContent: 'space-between',
    },
    productName: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1F2937',
        marginBottom: 4,
    },
    productDescription: {
        fontSize: 12,
        color: '#6B7280',
        lineHeight: 16,
        marginBottom: 8,
    },
    detailsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 8,
    },
    detailChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    detailText: {
        fontSize: 11,
        color: '#4B5563',
        fontWeight: '500',
    },
    priceContainer: {
        marginBottom: 8,
    },
    priceGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        alignSelf: 'flex-start',
    },
    priceText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    locationContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: 8,
    },
    locationText: {
        fontSize: 11,
        color: '#EF4444',
        fontWeight: '500',
        flex: 1,
    },
    distanceText: {
        fontSize: 11,
        color: '#6B7280',
        fontWeight: '600',
    },
    // 🆕 AMÉLIORATION PRODUCTION: Temps de trajet estimé
    travelTimeText: {
        fontSize: 10,
        color: '#9CA3AF',
        fontWeight: '500',
        marginLeft: 4,
    },
    countryFlagText: {
        fontSize: 14,
        marginLeft: 2,
    },
    prestataireInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    prestataireAvatar: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
    },
    prestataireName: {
        fontSize: 11,
        color: '#4B5563',
        fontWeight: '500',
        flex: 1,
    },
    onlineIndicator: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#10B981',
    },
    statsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingVertical: 8,
        marginBottom: 8,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
    },
    statText: {
        fontSize: 11,
        color: '#6B7280',
        fontWeight: '600',
    },
    actions: {
        flexDirection: 'column',
        gap: 8,
    },
    chatButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: '#3B82F6',
        paddingVertical: 10,
        borderRadius: 10,
    },
    chatButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    bookSeatButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#10B981',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 12,
        marginBottom: 12,
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    bookSeatButtonText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    bookSeatSubtext: {
        fontSize: 11,
        fontWeight: '600',
        color: '#D1FAE5',
    },
    ticketExpiredBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        backgroundColor: '#FEE2E2',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 2,
        borderColor: '#EF4444',
    },
    ticketExpiredText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#DC2626',
    },
    departureWarningBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#FEF3C7',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        marginBottom: 8,
    },
    departureWarningText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#92400E',
    },
    secondaryActions: {
        flexDirection: 'row',
        gap: 8,
        justifyContent: 'space-between',
    },
    actionIconButton: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        backgroundColor: '#F3F4F6',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    // Styles pour les prestations de service
    prestationsContainer: {
        gap: 8,
    },
    prestationsSectionTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#6B7280',
        marginBottom: 4,
    },
    prestationItem: {
        backgroundColor: '#F9FAFB',
        padding: 10,
        borderRadius: 8,
        borderLeftWidth: 3,
        borderLeftColor: '#8B5CF6',
        marginBottom: 6,
    },
    prestationHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
    },
    prestationName: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1F2937',
        flex: 1,
    },
    prestationPrice: {
        fontSize: 12,
        fontWeight: '600',
        color: '#8B5CF6',
        marginBottom: 3,
    },
    prestationDescription: {
        fontSize: 11,
        color: '#6B7280',
        lineHeight: 15,
    },
    // Styles pour logo et bannière
    bannerContainer: {
        width: '100%',
        height: 80,
        marginBottom: 8,
        borderRadius: 12,
        overflow: 'hidden',
    },
    bannerImage: {
        width: '100%',
        height: '100%',
    },
    logoOverlay: {
        position: 'absolute',
        bottom: 8,
        left: 8,
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#FFFFFF',
        borderWidth: 2,
        borderColor: '#FFFFFF',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    logoImage: {
        width: '100%',
        height: '100%',
    },
    // ✅ NOUVEAU: Styles pour prestations médicales et déménagement
    detailsSection: {
        marginTop: 12,
    },
    prestationLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 6,
    },
    tagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    tag: {
        backgroundColor: '#EFF6FF',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    tagText: {
        fontSize: 11,
        color: '#3B82F6',
        fontWeight: '500',
    },
    planningPreview: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 6,
    },
    highlightChip: {
        backgroundColor: '#FEF2F2',
        borderColor: '#FCA5A5',
    },
    successChip: {
        backgroundColor: '#F0FDF4',
        borderColor: '#86EFAC',
    },
    successText: {
        color: '#10B981',
    },
    // Styles pour déménagement
    servicesInclus: {
        marginTop: 8,
    },
    servicesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    serviceTag: {
        backgroundColor: '#F0FDF4',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#BBF7D0',
    },
    serviceTagText: {
        fontSize: 11,
        color: '#15803D',
        fontWeight: '500',
    },
    // Styles pour cosmétique & bijoux
    ingredientsContainer: {
        marginTop: 8,
    },
    ingredientsText: {
        fontSize: 11,
        color: '#6B7280',
        lineHeight: 15,
        fontStyle: 'italic',
    },
    certificateChip: {
        backgroundColor: '#F0FDF4',
        borderColor: '#BBF7D0',
    },
    certificateText: {
        color: '#15803D',
        fontWeight: '600',
    },
    // ✅ NOUVEAUX STYLES - Pharmacies
    statusChip: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        fontWeight: '600',
    },
    openChip: {
        backgroundColor: '#D1FAE5',
        borderColor: '#10B981',
        borderWidth: 1.5,
    },
    closedChip: {
        backgroundColor: '#FEE2E2',
        borderColor: '#EF4444',
        borderWidth: 1.5,
    },
    openText: {
        color: '#047857',
        fontWeight: '700',
    },
    closedText: {
        color: '#B91C1C',
        fontWeight: '700',
    },
    servicesContainer: {
        marginTop: 10,
        width: '100%',
    },
    // ✅ NOUVEAUX STYLES - Cliniques/Hôpitaux
    bloodBankChip: {
        backgroundColor: '#FEF2F2',
        borderColor: '#FCA5A5',
        borderWidth: 1.5,
    },
    bloodBankText: {
        color: '#B91C1C',
        fontWeight: '700',
    },
    emergencyChip: {
        backgroundColor: '#FEF2F2',
        borderColor: '#DC2626',
        borderWidth: 1.5,
    },
    emergencyText: {
        color: '#DC2626',
        fontWeight: '700',
    },
    prestationsFullContainer: {
        marginTop: 12,
        width: '100%',
        backgroundColor: '#F9FAFB',
        padding: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    prestationLabelMain: {
        fontSize: 13,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 10,
    },
    prestationItemFull: {
        marginBottom: 10,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    prestationSchedule: {
        fontSize: 11,
        color: '#6B7280',
        marginLeft: 10,
        fontStyle: 'italic',
    },
    prestationScheduleDefault: {
        fontSize: 11,
        color: '#9CA3AF',
        marginLeft: 10,
        fontStyle: 'italic',
    },
    serviceText: {
        fontSize: 11,
        color: '#1D4ED8',
        fontWeight: '500',
    },
    // ✅ NOUVEAUX STYLES - Automobile
    neufChip: {
        backgroundColor: '#D1FAE5',
        borderColor: '#10B981',
        borderWidth: 1.5,
    },
    neufText: {
        color: '#047857',
        fontWeight: '700',
    },
    occasionChip: {
        backgroundColor: '#DBEAFE',
        borderColor: '#3B82F6',
        borderWidth: 1.5,
    },
    occasionText: {
        color: '#1D4ED8',
        fontWeight: '700',
    },
    accidenteChip: {
        backgroundColor: '#FEE2E2',
        borderColor: '#EF4444',
        borderWidth: 1.5,
    },
    accidenteText: {
        color: '#B91C1C',
        fontWeight: '700',
    },
    recentChip: {
        backgroundColor: '#D1FAE5',
        borderColor: '#10B981',
        borderWidth: 1.5,
    },
    recentText: {
        color: '#047857',
        fontWeight: '700',
    },
    premierMainChip: {
        backgroundColor: '#FEF3C7',
        borderColor: '#F59E0B',
        borderWidth: 1.5,
    },
    premierMainText: {
        color: '#92400E',
        fontWeight: '700',
    },
    vehicleIdentity: {
        marginVertical: 8,
        padding: 10,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        borderLeftWidth: 3,
        borderLeftColor: '#EF4444',
    },
    vehicleIdentityText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#111827',
    },
    technicalInfoContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 6,
    },
    technicalGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 6,
    },
    kmLowChip: {
        backgroundColor: '#D1FAE5',
        borderColor: '#10B981',
        borderWidth: 1,
    },
    kmLowText: {
        color: '#047857',
        fontWeight: '600',
    },
    kmHighChip: {
        backgroundColor: '#FEE2E2',
        borderColor: '#EF4444',
        borderWidth: 1,
    },
    kmHighText: {
        color: '#B91C1C',
        fontWeight: '600',
    },
    equipementsContainer: {
        marginTop: 10,
        width: '100%',
    },
    equipTag: {
        backgroundColor: '#EFF6FF',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#BFDBFE',
    },
    equipText: {
        fontSize: 10,
        color: '#1D4ED8',
        fontWeight: '500',
    },
    trustBadgesContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 10,
    },

    // ========== STYLES MÉCANICIEN / GARAGE ==========
    mecanicienIdentity: {
        marginVertical: 8,
        padding: 12,
        backgroundColor: '#F0F9FF',
        borderRadius: 10,
        borderLeftWidth: 4,
        borderLeftColor: '#0EA5E9',
    },
    mecanicienIdentityText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#0C4A6E',
    },
    mecanicienSpecialites: {
        marginTop: 10,
        width: '100%',
    },
    mecanicienSpecialitesTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6B7280',
        marginBottom: 6,
    },
    mecanicienSpecTag: {
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#FDE68A',
    },
    mecanicienSpecText: {
        fontSize: 11,
        color: '#92400E',
        fontWeight: '600',
    },
    mecanicienServices: {
        marginTop: 10,
        width: '100%',
    },
    mecanicienMarques: {
        marginTop: 10,
        width: '100%',
    },
    marqueTag: {
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#D1D5DB',
    },
    marqueText: {
        fontSize: 10,
        color: '#374151',
        fontWeight: '500',
    },
    mecanicienCertifications: {
        marginTop: 10,
        width: '100%',
    },
    certificationTag: {
        backgroundColor: '#D1FAE5',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#6EE7B7',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    certificationText: {
        fontSize: 10,
        color: '#047857',
        fontWeight: '600',
    },
    mecanicienInfos: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 10,
    },
    urgenceChip: {
        backgroundColor: '#FEE2E2',
        borderColor: '#EF4444',
        borderWidth: 1,
    },
    urgenceText: {
        color: '#B91C1C',
        fontWeight: '700',
    },
    mecanicienOptions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 10,
    },

    // ========== STYLES MÉCANICIEN MOTO (SERVICE SPÉCIALISÉ) ========== //
    mecanicienMotoIdentity: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        backgroundColor: '#FEF3C7',
        borderWidth: 1,
        borderColor: '#F59E0B',
        alignSelf: 'flex-start',
        marginBottom: 12,
    },
    mecanicienMotoIdentityText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#92400E',
    },
    mecanicienMotoSpecialites: {
        marginBottom: 12,
    },
    mecanicienMotoSpecialitesTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 6,
    },
    mecanicienMotoSpecTag: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: '#FEF3C7',
        borderWidth: 1,
        borderColor: '#F59E0B',
    },
    mecanicienMotoSpecText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#92400E',
    },
    mecanicienMotoServices: {
        marginBottom: 12,
    },
    motoServiceTag: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: '#EFF6FF',
        borderWidth: 1,
        borderColor: '#BFDBFE',
    },
    motoServiceText: {
        fontSize: 10,
        color: '#1E40AF',
        fontWeight: '500',
    },
    mecanicienMotoMarques: {
        marginBottom: 12,
    },
    motoMarqueTag: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: '#F0FDF4',
        borderWidth: 1,
        borderColor: '#BBF7D0',
    },
    motoMarqueText: {
        fontSize: 10,
        color: '#166534',
        fontWeight: '500',
    },
    mecanicienMotoTypes: {
        marginBottom: 12,
    },
    motoTypeTag: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: '#FDF2F8',
        borderWidth: 1,
        borderColor: '#FBCFE8',
    },
    motoTypeText: {
        fontSize: 10,
        color: '#BE185D',
        fontWeight: '500',
    },
    mecanicienMotoCylindrees: {
        marginBottom: 12,
    },
    cylindreeTag: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: '#F0F9FF',
        borderWidth: 1,
        borderColor: '#BAE6FD',
    },
    cylindreeText: {
        fontSize: 10,
        color: '#0369A1',
        fontWeight: '500',
    },
    mecanicienMotoCertifications: {
        marginBottom: 12,
    },
    motoCertificationTag: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: '#F0FDF4',
        borderWidth: 1,
        borderColor: '#BBF7D0',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    motoCertificationText: {
        fontSize: 10,
        color: '#166534',
        fontWeight: '600',
    },
    mecanicienMotoInfos: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 12,
    },
    mecanicienMotoOptions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 10,
    },

    // Styles Immobilier
    immoStatutChip: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        borderWidth: 1,
    },
    immoStatutText: {
        fontSize: 12,
        fontWeight: '700',
    },
    immoStandingChip: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        borderWidth: 1,
    },
    immoStandingText: {
        fontSize: 12,
        fontWeight: '600',
    },
    immoEtatChip: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        borderWidth: 1,
    },
    immoEtatText: {
        fontSize: 12,
        fontWeight: '600',
    },
    immoDispoChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        backgroundColor: '#D1FAE5',
        borderWidth: 1,
        borderColor: '#10B981',
    },
    immoDispoText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#059669',
    },
    immoIdentity: {
        paddingVertical: 8,
    },
    immoTypeText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1F2937',
    },
    immoMainInfo: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        backgroundColor: '#F9FAFB',
        padding: 10,
        borderRadius: 8,
    },
    immoInfoItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    immoInfoLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#374151',
    },
    immoAmeublementChip: {
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        alignSelf: 'flex-start',
    },
    immoAmeublementText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#92400E',
    },
    immoEquipementsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    immoEquipTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: '#EFF6FF',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#DBEAFE',
    },
    immoEquipText: {
        fontSize: 11,
        fontWeight: '500',
        color: '#1E40AF',
    },
    immoExtraInfo: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    immoExtraText: {
        fontSize: 12,
        color: '#6B7280',
    },
    immoTrueBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: '#D1FAE5',
        borderRadius: 6,
    },
    immoTrueText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#059669',
    },
    immoLocation: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingTop: 8,
    },
    immoLocationText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#6B7280',
    },

    // Styles Location Courte Durée
    immoLocationCourte: {
        paddingVertical: 8,
        gap: 6,
        backgroundColor: '#FFFBEB',
        padding: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#FCD34D',
    },
    immoPrixNuit: {
        paddingVertical: 4,
    },
    immoPrixNuitText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#F59E0B',
    },
    immoLocationCourteTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: '#ECFDF5',
        borderRadius: 6,
    },
    immoLocationCourteText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#047857',
    },

    // Styles Terrain
    terrainStatutChip: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        borderWidth: 1,
    },
    terrainStatutText: {
        fontSize: 12,
        fontWeight: '700',
    },
    terrainViabChip: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        borderWidth: 1,
    },
    terrainViabText: {
        fontSize: 12,
        fontWeight: '600',
    },
    terrainTitreChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        backgroundColor: '#D1FAE5',
        borderWidth: 1,
        borderColor: '#10B981',
    },
    terrainTitreText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#059669',
    },
    terrainIdentity: {
        paddingVertical: 8,
    },
    terrainTypeText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1F2937',
    },
    terrainDimensionsCard: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        backgroundColor: '#ECFDF5',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#A7F3D0',
    },
    terrainDimItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    terrainDimValue: {
        fontSize: 14,
        fontWeight: '700',
        color: '#065F46',
    },
    terrainDimLabel: {
        fontSize: 11,
        color: '#059669',
    },
    terrainCaracContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    terrainCaracTag: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        backgroundColor: '#F3F4F6',
        borderRadius: 8,
    },
    terrainCaracText: {
        fontSize: 12,
        fontWeight: '500',
        color: '#374151',
    },
    terrainReseauxContainer: {
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    terrainReseauxTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6B7280',
    },
    terrainReseauTag: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: '#EFF6FF',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#DBEAFE',
    },
    terrainReseauText: {
        fontSize: 11,
        fontWeight: '500',
        color: '#1E40AF',
    },
    terrainJuridiqueContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    terrainJuridiqueBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: '#D1FAE5',
        borderRadius: 6,
    },
    terrainJuridiqueText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#059669',
    },
    terrainLocation: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingTop: 8,
    },
    terrainLocationText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#6B7280',
    },

    // Styles Mobilier
    mobilierEtatChip: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        borderWidth: 1,
    },
    mobilierEtatText: {
        fontSize: 12,
        fontWeight: '700',
    },
    mobilierStyleChip: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        backgroundColor: '#EDE9FE',
        borderWidth: 1,
        borderColor: '#8B5CF6',
    },
    mobilierStyleText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#5B21B6',
    },
    mobilierLivraisonChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        backgroundColor: '#D1FAE5',
        borderWidth: 1,
        borderColor: '#10B981',
    },
    mobilierLivraisonText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#059669',
    },
    mobilierIdentity: {
        paddingVertical: 8,
    },
    mobilierTypeText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1F2937',
    },
    mobilierMaterialText: {
        fontSize: 13,
        color: '#6B7280',
        marginTop: 4,
    },
    mobilierCaracteristiques: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        backgroundColor: '#F9FAFB',
        padding: 10,
        borderRadius: 8,
    },
    mobilierCaracItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    mobilierCaracText: {
        fontSize: 13,
        color: '#374151',
    },
    mobilierServices: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    mobilierServiceText: {
        fontSize: 12,
        color: '#6B7280',
    },
    mobilierServiceBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: '#EFF6FF',
        borderRadius: 6,
    },
    mobilierServiceBadgeText: {
        fontSize: 11,
        fontWeight: '500',
        color: '#1E40AF',
    },
    // ✅ NOUVEAU: Badge caractéristiques
    mobilierCaracBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: '#F3F4F6',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#D1D5DB',
    },
    mobilierCaracBadgeText: {
        fontSize: 11,
        fontWeight: '500',
        color: '#4B5563',
    },

    // Styles Électroménager
    electroEtatChip: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        borderWidth: 1,
    },
    electroEtatText: {
        fontSize: 12,
        fontWeight: '700',
    },
    electroClasseChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        fontWeight: '900',
    },
    electroClasseText: {
        fontSize: 13,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    electroRecentChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        backgroundColor: '#E0F2FE',
        borderWidth: 1,
        borderColor: '#0EA5E9',
    },
    electroRecentText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#0369A1',
    },
    electroIdentity: {
        paddingVertical: 8,
    },
    electroMarqueText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1F2937',
    },
    electroTypeText: {
        fontSize: 13,
        color: '#6B7280',
        marginTop: 4,
    },
    electroSpecs: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        backgroundColor: '#F0FDFA',
        padding: 10,
        borderRadius: 8,
    },
    electroSpecItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    electroSpecText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#0F766E',
    },
    electroFonctionnalites: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    electroFoncTag: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: '#EFF6FF',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#DBEAFE',
    },
    electroFoncText: {
        fontSize: 11,
        fontWeight: '500',
        color: '#1E40AF',
    },
    electroGarantie: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    electroGarantieText: {
        fontSize: 12,
        color: '#6B7280',
    },
    electroDocBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: '#D1FAE5',
        borderRadius: 6,
    },
    electroDocText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#059669',
    },

    // Styles Alimentation
    alimentBioChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        backgroundColor: '#D1FAE5',
        borderWidth: 1,
        borderColor: '#10B981',
    },
    alimentBioText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#059669',
    },
    alimentTypeChip: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        backgroundColor: '#E0F2FE',
        borderWidth: 1,
        borderColor: '#0EA5E9',
    },
    alimentTypeText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#0369A1',
    },
    alimentStockChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        backgroundColor: '#FFF',
        borderWidth: 1,
    },
    alimentStockText: {
        fontSize: 12,
        fontWeight: '600',
    },
    alimentMarqueChip: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        backgroundColor: '#FEF3C7',
        borderWidth: 1,
        borderColor: '#F59E0B',
    },
    alimentMarqueText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#D97706',
    },
    variantsSelector: {
        backgroundColor: '#F9FAFB',
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    variantsSelectorLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    variantOptions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    variantOption: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: '#D1D5DB',
        minWidth: 85,
    },
    variantOptionActive: {
        backgroundColor: '#10B981',
        borderColor: '#10B981',
    },
    variantOptionText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#374151',
        textAlign: 'center',
    },
    variantOptionTextActive: {
        color: '#FFFFFF',
    },
    variantPriceText: {
        fontSize: 11,
        fontWeight: '500',
        color: '#6B7280',
        textAlign: 'center',
        marginTop: 2,
    },
    variantPriceTextActive: {
        color: '#FFFFFF',
        fontWeight: '600',
    },
    variantOptionImage: {
        width: 30,
        height: 30,
        borderRadius: 6,
        marginBottom: 4,
        backgroundColor: '#F3F4F6',
    },
    // ✅ NOUVEAU: Styles Assurance
    assuranceTypeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        borderWidth: 1,
    },
    assuranceTypeText: {
        fontSize: 12,
        fontWeight: '700',
    },
    assuranceCompagnieBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        backgroundColor: '#CCFBF1',
        borderWidth: 1,
        borderColor: '#14B8A6',
    },
    assuranceCompagnieText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#0F766E',
    },
    assuranceProduit: {
        paddingVertical: 8,
    },
    assuranceProduitText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1F2937',
    },
    assurancePrime: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        backgroundColor: '#F0FDFA',
        padding: 10,
        borderRadius: 8,
    },
    assurancePrimeItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    assurancePrimeText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#0F766E',
    },
    assuranceCouvertures: {
        gap: 8,
    },
    assuranceCouverturesTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#374151',
    },
    assuranceCouverturesList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    assuranceCouvertureTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: '#D1FAE5',
        borderRadius: 6,
    },
    assuranceCouvertureText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#065F46',
    },
    assuranceMoreText: {
        fontSize: 11,
        fontWeight: '500',
        color: '#6B7280',
        fontStyle: 'italic',
    },
    assuranceOptions: {
        backgroundColor: '#F9FAFB',
        padding: 12,
        borderRadius: 10,
        gap: 8,
    },
    assuranceOptionsTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#374151',
    },
    assuranceOptionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    assuranceOptionCard: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        minWidth: 100,
    },
    assuranceOptionName: {
        fontSize: 12,
        fontWeight: '600',
        color: '#374151',
    },
    assuranceOptionPrime: {
        fontSize: 11,
        fontWeight: '500',
        color: '#14B8A6',
        marginTop: 2,
    },
    alimentIdentity: {
        paddingVertical: 8,
    },
    alimentCategoryText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1F2937',
    },
    alimentQuantite: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        backgroundColor: '#F7FEE7',
        padding: 10,
        borderRadius: 8,
    },
    alimentQuantiteItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    alimentQuantiteText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#4D7C0F',
    },
    alimentCertifications: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    alimentLabelTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: '#FEF3C7',
        borderRadius: 6,
    },
    alimentLabelText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#A16207',
    },
    alimentCertTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: '#D1FAE5',
        borderRadius: 6,
    },
    alimentCertText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#059669',
    },
    alimentDates: {
        flexDirection: 'column',
        gap: 4,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    alimentDateText: {
        fontSize: 12,
        color: '#6B7280',
    },
    alimentDateExpiration: {
        color: '#DC2626',
        fontWeight: '600',
    },
    alimentAllergenes: {
        backgroundColor: '#FEF2F2',
        padding: 8,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#FEE2E2',
    },
    alimentAllergenesText: {
        fontSize: 11,
        color: '#991B1B',
        fontWeight: '600',
    },

    // ========== STYLES SMARTPHONE ========== //
    phoneBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        borderWidth: 1,
    },
    phoneBadgeText: {
        fontSize: 12,
        fontWeight: '700',
    },
    phoneRecentBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        backgroundColor: '#ECFDF5',
        borderWidth: 1,
        borderColor: '#10B981',
    },
    phoneRecentText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#059669',
    },
    phoneGarantieBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        backgroundColor: '#EEF2FF',
        borderWidth: 1,
        borderColor: '#6366F1',
    },
    phoneGarantieText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#4F46E5',
    },
    phone5GBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        backgroundColor: '#DBEAFE',
        borderWidth: 1,
        borderColor: '#3B82F6',
    },
    phone5GText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#1E40AF',
    },
    phoneIdentity: {
        paddingVertical: 8,
    },
    phoneIdentityText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1F2937',
    },
    phoneSpecs: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        backgroundColor: '#F9FAFB',
        padding: 10,
        borderRadius: 8,
    },
    phoneSpecItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    phoneSpecLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#374151',
    },
    phoneOperateur: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 6,
    },
    phoneOperateurText: {
        fontSize: 13,
        fontWeight: '500',
        color: '#6B7280',
    },
    phoneConfiance: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    phoneConfianceTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: '#ECFDF5',
        borderRadius: 6,
    },
    phoneConfianceText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#047857',
    },
    phoneAccessoires: {
        paddingVertical: 8,
    },
    phoneAccessoiresTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6B7280',
    },
    phoneAccessoireTag: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: '#F3F4F6',
        borderRadius: 6,
    },
    phoneAccessoireText: {
        fontSize: 11,
        fontWeight: '500',
        color: '#4B5563',
    },

    // ========== STYLES RÉPARATEUR TÉLÉPHONE/TABLETTE ========== //
    repairBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        borderWidth: 1,
    },
    repairBadgeText: {
        fontSize: 12,
        fontWeight: '700',
    },
    repairFreeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        backgroundColor: '#ECFDF5',
        borderWidth: 1,
        borderColor: '#10B981',
    },
    repairFreeText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#059669',
    },
    // 🆕 AMÉLIORATION PRODUCTION: Badge technicien vérifié
    verifiedBadgeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: '#D1FAE5',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#10B981',
        alignSelf: 'flex-start',
    },
    verifiedBadgeText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#047857',
        letterSpacing: 0.3,
    },
    repairHomeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        backgroundColor: '#DBEAFE',
        borderWidth: 1,
        borderColor: '#3B82F6',
    },
    repairHomeText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#1E40AF',
    },
    repairName: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 8,
    },
    repairNameText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1F2937',
    },
    repairServices: {
        paddingVertical: 8,
    },
    repairSectionTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#4B5563',
    },
    repairServiceTag: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#D1D5DB',
    },
    repairServiceText: {
        fontSize: 12,
        fontWeight: '500',
        color: '#374151',
    },
    repairBrands: {
        paddingVertical: 8,
    },
    repairBrandTag: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: '#EFF6FF',
        borderWidth: 1,
        borderColor: '#BFDBFE',
    },
    repairBrandText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#1E40AF',
    },
    repairQuality: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 6,
    },
    repairQualityText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#92400E',
    },
    repairCertifications: {
        paddingVertical: 8,
    },
    repairCertTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 8,
        backgroundColor: '#EDE9FE',
        borderWidth: 1,
        borderColor: '#C4B5FD',
    },
    repairCertText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#6B21A8',
    },
    repairPrice: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 6,
    },
    repairPriceText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#4B5563',
    },
    repairExtras: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        paddingVertical: 6,
    },
    repairExtraTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 8,
        backgroundColor: '#ECFDF5',
        borderWidth: 1,
        borderColor: '#A7F3D0',
    },
    repairExtraText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#047857',
    },
    repairIntervention: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 6,
    },
    repairInterventionText: {
        fontSize: 13,
        fontWeight: '500',
        color: '#6B7280',
    },

    // ========== STYLES MENUISIER ALUMINIUM ========== //
    menuisierAluBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
    },
    menuisierAluBadgeText: {
        fontSize: 11,
        fontWeight: '600',
    },
    menuisierAluFreeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#D1FAE5',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#10B981',
    },
    menuisierAluFreeText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#065F46',
    },
    menuisierAluMotorBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#F59E0B',
    },
    menuisierAluMotorText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#92400E',
    },
    menuisierAluName: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 4,
    },
    menuisierAluNameText: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#1F2937',
    },
    menuisierAluRealisations: {
        gap: 6,
    },
    menuisierAluSectionTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#4B5563',
    },
    menuisierAluRealisationTag: {
        backgroundColor: '#E0F2FE',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#0EA5E9',
    },
    menuisierAluRealisationText: {
        fontSize: 12,
        color: '#0C4A6E',
        fontWeight: '500',
    },
    menuisierAluTypeTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#CBD5E1',
    },
    menuisierAluTypeText: {
        fontSize: 12,
        color: '#334155',
        fontWeight: '500',
    },
    menuisierAluCouleurTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#D1D5DB',
    },
    menuisierAluCouleurText: {
        fontSize: 12,
        color: '#374151',
        fontWeight: '500',
    },
    menuisierAluVitrageTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#EFF6FF',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#BFDBFE',
    },
    menuisierAluVitrageText: {
        fontSize: 12,
        color: '#1E40AF',
        fontWeight: '500',
    },
    menuisierAluCertifications: {
        gap: 6,
    },
    menuisierAluCertTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#FAF5FF',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E9D5FF',
    },
    menuisierAluCertText: {
        fontSize: 11,
        color: '#6B21A8',
        fontWeight: '500',
    },
    menuisierAluPrice: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 6,
        paddingHorizontal: 10,
        backgroundColor: '#FEF3C7',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#FCD34D',
    },
    menuisierAluPriceText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#92400E',
    },
    menuisierAluExtras: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    menuisierAluExtraTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#A7F3D0',
    },
    menuisierAluExtraText: {
        fontSize: 11,
        color: '#065F46',
        fontWeight: '500',
    },

    // ========== STYLES FORGERON / FERRONNERIE ========== //
    forgeronBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        borderWidth: 1,
    },
    forgeronBadgeText: {
        fontSize: 12,
        fontWeight: '700',
    },
    forgeronFreeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        backgroundColor: '#ECFDF5',
        borderWidth: 1,
        borderColor: '#10B981',
    },
    forgeronFreeText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#059669',
    },
    forgeronMotorBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        backgroundColor: '#FEF3C7',
        borderWidth: 1,
        borderColor: '#F59E0B',
    },
    forgeronMotorText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#92400E',
    },
    forgeronName: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 8,
    },
    forgeronNameText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1F2937',
    },
    forgeronRealisations: {
        paddingVertical: 8,
    },
    forgeronSectionTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#4B5563',
    },
    forgeronRealisationTag: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#D1D5DB',
    },
    forgeronRealisationText: {
        fontSize: 12,
        fontWeight: '500',
        color: '#374151',
    },
    forgeronMateriauTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: '#E0F2FE',
        borderWidth: 1,
        borderColor: '#BAE6FD',
    },
    forgeronMateriauText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#075985',
    },
    forgeronStyleTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: '#F5F3FF',
        borderWidth: 1,
        borderColor: '#DDD6FE',
    },
    forgeronStyleText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6B21A8',
    },
    forgeronFinitionTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: '#FEF3C7',
        borderWidth: 1,
        borderColor: '#FDE68A',
    },
    forgeronFinitionText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#92400E',
    },
    forgeronCertifications: {
        paddingVertical: 8,
    },
    forgeronCertTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 8,
        backgroundColor: '#EDE9FE',
        borderWidth: 1,
        borderColor: '#C4B5FD',
    },
    forgeronCertText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#6B21A8',
    },
    forgeronPrice: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 6,
    },
    forgeronPriceText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#4B5563',
    },
    forgeronExtras: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        paddingVertical: 6,
    },
    forgeronExtraTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 8,
        backgroundColor: '#ECFDF5',
        borderWidth: 1,
        borderColor: '#A7F3D0',
    },
    forgeronExtraText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#047857',
    },

    // ========== STYLES SPORT & FITNESS ========== //
    sportTypeBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        borderWidth: 1,
    },
    sportTypeText: {
        fontSize: 12,
        fontWeight: '700',
    },
    sportNiveauBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        backgroundColor: '#E0E7FF',
        borderWidth: 1,
        borderColor: '#6366F1',
    },
    sportNiveauText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#4338CA',
    },
    sportDureeBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        backgroundColor: '#FEF3C7',
        borderWidth: 1,
        borderColor: '#F59E0B',
    },
    sportDureeText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#92400E',
    },
    sportInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    sportInfoLabel: {
        fontSize: 12,
        color: '#6B7280',
        fontWeight: '500',
    },
    sportInfoValue: {
        fontSize: 12,
        color: '#111827',
        fontWeight: '600',
        flex: 1,
    },
    sportEquipBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: '#ECFDF5',
        borderWidth: 1,
        borderColor: '#10B981',
    },
    sportEquipText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#047857',
    },

    // ========== STYLES ORDINATEUR ========== //
    pcBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        borderWidth: 1,
    },
    pcBadgeText: {
        fontSize: 12,
        fontWeight: '700',
    },
    pcUsageBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        backgroundColor: '#EDE9FE',
        borderWidth: 1,
        borderColor: '#8B5CF6',
    },
    pcUsageText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6B21A8',
    },
    pcRecentBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        backgroundColor: '#ECFDF5',
        borderWidth: 1,
        borderColor: '#10B981',
    },
    pcRecentText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#059669',
    },
    pcIdentity: {
        paddingVertical: 8,
    },
    pcIdentityText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1F2937',
    },
    pcSpecs: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        backgroundColor: '#F0F9FF',
        padding: 10,
        borderRadius: 8,
    },
    pcSpecItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    pcSpecLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#374151',
    },
    pcConfiance: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    pcConfianceTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: '#ECFDF5',
        borderRadius: 6,
    },
    pcConfianceText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#047857',
    },
    pcLogiciels: {
        paddingVertical: 8,
    },
    pcLogicielsTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6B7280',
    },
    pcLogicielTag: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: '#EEF2FF',
        borderRadius: 6,
    },
    pcLogicielText: {
        fontSize: 11,
        fontWeight: '500',
        color: '#4F46E5',
    },
    pcFeatures: {
        paddingVertical: 8,
    },
    pcFeatureTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: '#EEF2FF',
        borderRadius: 6,
    },
    pcFeatureText: {
        fontSize: 11,
        fontWeight: '500',
        color: '#6366F1',
    },

    // ========== STYLES TEXTILE (VÊTEMENT) ========== //
    textileBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        borderWidth: 1,
    },
    textileBadgeText: {
        fontSize: 12,
        fontWeight: '700',
    },
    textileGenreBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        backgroundColor: '#FCE7F3',
        borderWidth: 1,
        borderColor: '#EC4899',
    },
    textileGenreText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#DB2777',
    },
    textileMarqueBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#9CA3AF',
    },
    textileMarqueText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#4B5563',
    },
    textileStyleBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        backgroundColor: '#F0F9FF',
        borderWidth: 1,
        borderColor: '#0EA5E9',
        alignSelf: 'flex-start',
    },
    textileStyleText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#0C4A6E',
    },
    textileOrigineBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        backgroundColor: '#F0FDF4',
        borderWidth: 1,
        borderColor: '#22C55E',
        alignSelf: 'flex-start',
    },
    textileOrigineText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#166534',
    },
    variantesContainer: {
        backgroundColor: '#F8FAFC',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    variantesTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1E293B',
        marginBottom: 8,
    },
    variantesList: {
        gap: 6,
    },
    varianteItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 8,
        paddingVertical: 6,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    varianteText: {
        fontSize: 12,
        fontWeight: '500',
        color: '#374151',
        flex: 1,
    },
    variantePrix: {
        fontSize: 12,
        fontWeight: '600',
        color: '#059669',
    },
    variantesMore: {
        fontSize: 11,
        fontWeight: '500',
        color: '#6B7280',
        fontStyle: 'italic',
        textAlign: 'center',
        marginTop: 4,
    },
    textileIdentity: {
        paddingVertical: 8,
    },
    textileIdentityText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1F2937',
    },
    textileSpecs: {
        flexDirection: 'column',
        gap: 6,
        backgroundColor: '#FDF2F8',
        padding: 10,
        borderRadius: 8,
    },
    textileSpecItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    textileSpecLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#374151',
    },
    textileSpecText: {
        fontSize: 13,
        fontWeight: '500',
        color: '#6B7280',
    },
    textileCertifications: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    textileCertTag: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: '#ECFDF5',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#10B981',
    },
    textileCertText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#047857',
    },
    // ✅ NOUVEAU: Styles pour le sélecteur de variantes vêtements
    vetementVariantOption: {
        padding: 10,
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: '#E5E7EB',
        backgroundColor: '#FFFFFF',
        marginBottom: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    vetementVariantOptionActive: {
        borderColor: '#EC4899',
        backgroundColor: '#FCE7F3',
    },
    vetementVariantOptionOutOfStock: {
        opacity: 0.5,
        borderColor: '#D1D5DB',
        backgroundColor: '#F9FAFB',
    },
    vetementVariantImage: {
        width: 50,
        height: 50,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
    },
    vetementVariantInfo: {
        flex: 1,
        gap: 2,
    },
    vetementVariantText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#374151',
    },
    vetementVariantTextActive: {
        color: '#EC4899',
    },
    vetementVariantTextDisabled: {
        color: '#9CA3AF',
    },
    vetementVariantPrice: {
        fontSize: 12,
        fontWeight: '700',
        color: '#1F2937',
    },
    vetementVariantPriceActive: {
        color: '#EC4899',
    },
    vetementVariantStockLow: {
        fontSize: 10,
        fontWeight: '500',
        color: '#F59E0B',
        marginTop: 2,
    },
    vetementVariantOutOfStockText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#DC2626',
        marginTop: 2,
    },

    // ========== STYLES RESTAURATION ULTRA-ENRICHIS ========== //

    // Badges principaux
    restaurantTypeBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        backgroundColor: '#F3E8FF',
        borderWidth: 1,
        borderColor: '#A855F7',
    },
    restaurantTypeText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#7C2D12',
    },
    restaurantCuisineBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        backgroundColor: '#FFEDD5',
        borderWidth: 1,
        borderColor: '#F97316',
    },
    restaurantCuisineText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#EA580C',
    },
    restaurantPrixBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        borderWidth: 1,
    },
    restaurantPrixText: {
        fontSize: 12,
        fontWeight: '700',
    },
    restaurantServiceBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        backgroundColor: '#DBEAFE',
        borderWidth: 1,
        borderColor: '#3B82F6',
    },
    restaurantServiceText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#1E40AF',
    },

    // Plats par pays
    restaurantPlatsParPays: {
        paddingVertical: 8,
        backgroundColor: '#FEF7ED',
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#FED7AA',
    },
    restaurantPlatsTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#9A3412',
        marginBottom: 8,
    },
    restaurantPaysSection: {
        marginBottom: 8,
    },
    restaurantPaysTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#7C2D12',
        marginBottom: 4,
    },
    restaurantPlatTag: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: '#FEF3C7',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#F59E0B',
    },
    restaurantPlatText: {
        fontSize: 11,
        fontWeight: '500',
        color: '#92400E',
    },

    // Boissons & Desserts
    restaurantBoissonsDesserts: {
        paddingVertical: 8,
        backgroundColor: '#F0FDF4',
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#BBF7D0',
    },
    restaurantBoissonsSection: {
        marginBottom: 8,
    },
    restaurantBoissonsTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#166534',
        marginBottom: 4,
    },
    restaurantBoissonTag: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: '#DCFCE7',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#22C55E',
    },
    restaurantBoissonText: {
        fontSize: 11,
        fontWeight: '500',
        color: '#15803D',
    },
    restaurantDessertsSection: {
        marginTop: 8,
    },
    restaurantDessertsTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#166534',
        marginBottom: 4,
    },
    restaurantDessertTag: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: '#FCE7F3',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#EC4899',
    },
    restaurantDessertText: {
        fontSize: 11,
        fontWeight: '500',
        color: '#BE185D',
    },

    // Informations générales
    restaurantInfo: {
        flexDirection: 'column',
        gap: 6,
        backgroundColor: '#FEF2F2',
        padding: 10,
        borderRadius: 8,
    },
    restaurantInfoItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    restaurantInfoText: {
        fontSize: 13,
        fontWeight: '500',
        color: '#374151',
    },

    // Ambiance
    restaurantAmbiance: {
        paddingVertical: 8,
        backgroundColor: '#F0F9FF',
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#BAE6FD',
    },
    restaurantAmbianceTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#0C4A6E',
        marginBottom: 4,
    },
    restaurantAmbianceTag: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: '#E0F2FE',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#0EA5E9',
    },
    restaurantAmbianceText: {
        fontSize: 11,
        fontWeight: '500',
        color: '#0369A1',
    },

    // Régimes alimentaires
    restaurantRegimes: {
        paddingVertical: 8,
        backgroundColor: '#F0FDF4',
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#BBF7D0',
    },
    restaurantRegimesTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#166534',
        marginBottom: 4,
    },
    restaurantRegimeTag: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: '#ECFDF5',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#10B981',
    },
    restaurantRegimeText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#047857',
    },

    // Certifications & Promotions
    restaurantCertificationsPromotions: {
        paddingVertical: 8,
        backgroundColor: '#FEF7ED',
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#FED7AA',
    },
    restaurantCertificationsSection: {
        marginBottom: 8,
    },
    restaurantCertificationsTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#9A3412',
        marginBottom: 4,
    },
    restaurantCertificationTag: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: '#FEF3C7',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#F59E0B',
    },
    restaurantCertificationText: {
        fontSize: 11,
        fontWeight: '500',
        color: '#92400E',
    },
    restaurantPromotionsSection: {
        marginTop: 8,
    },
    restaurantPromotionsTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#9A3412',
        marginBottom: 4,
    },
    restaurantPromotionTag: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: '#FCE7F3',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#EC4899',
    },
    restaurantPromotionText: {
        fontSize: 11,
        fontWeight: '500',
        color: '#BE185D',
    },

    // Zones de livraison
    restaurantZonesLivraison: {
        paddingVertical: 8,
        backgroundColor: '#F0F9FF',
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#BAE6FD',
    },
    restaurantZonesTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#0C4A6E',
        marginBottom: 8,
    },
    restaurantZoneSection: {
        marginBottom: 8,
    },
    restaurantZoneCity: {
        fontSize: 12,
        fontWeight: '600',
        color: '#0369A1',
        marginBottom: 4,
    },
    restaurantZoneTag: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: '#E0F2FE',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#0EA5E9',
    },
    restaurantZoneText: {
        fontSize: 11,
        fontWeight: '500',
        color: '#0369A1',
    },

    // Type de clientèle
    restaurantClientele: {
        paddingVertical: 8,
        backgroundColor: '#FDF4FF',
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E9D5FF',
    },
    restaurantClienteleTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#7C2D12',
        marginBottom: 4,
    },
    restaurantClienteleTag: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: '#F3E8FF',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#A855F7',
    },
    restaurantClienteleText: {
        fontSize: 11,
        fontWeight: '500',
        color: '#7C2D12',
    },

    // Styles obsolètes (conservés pour compatibilité)
    restaurantIdentity: {
        paddingVertical: 8,
    },
    restaurantIdentityText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1F2937',
    },
    restaurantSpecialites: {
        paddingVertical: 6,
    },
    restaurantSpecialitesTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6B7280',
    },
    restaurantSpecTag: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: '#FEF3C7',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#F59E0B',
    },
    restaurantSpecText: {
        fontSize: 11,
        fontWeight: '500',
        color: '#92400E',
    },
    restaurantServices: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    restaurantServiceTag: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: '#F3F4F6',
        borderRadius: 6,
    },
    restaurantServiceTagText: {
        fontSize: 11,
        fontWeight: '500',
        color: '#4B5563',
    },

    // ========== STYLES MUSIQUE & INSTRUMENTS ========== //
    musiqueBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        borderWidth: 1,
    },
    musiqueBadgeText: {
        fontSize: 12,
        fontWeight: '700',
    },
    musiqueMarqueBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        backgroundColor: '#F3E5F5',
        borderWidth: 1,
        borderColor: '#9C27B0',
    },
    musiqueMarqueText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#7B1FA2',
    },
    musiqueTypeBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        backgroundColor: '#E0E7FF',
        borderWidth: 1,
        borderColor: '#6366F1',
    },
    musiqueTypeText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#3730A3',
    },
    musiqueIdentity: {
        paddingVertical: 8,
    },
    musiqueIdentityText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1F2937',
    },
    musiqueCaracs: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        backgroundColor: '#FAF5FF',
        padding: 10,
        borderRadius: 8,
    },
    musiqueCaracItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    musiqueCaracLabel: {
        fontSize: 13,
        fontWeight: '500',
        color: '#374151',
    },
    musiqueConfianceTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: '#ECFDF5',
        borderRadius: 6,
    },
    musiqueConfianceText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#047857',
    },
    musiqueAccessoires: {
        paddingVertical: 6,
    },
    musiqueAccessoiresTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6B7280',
    },
    musiqueAccessoireTag: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: '#F3F4F6',
        borderRadius: 6,
    },
    musiqueAccessoireText: {
        fontSize: 11,
        fontWeight: '500',
        color: '#4B5563',
    },

    // ========== STYLES TICKET VOYAGE ========== //
    ticketClasseBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        borderWidth: 1,
    },
    ticketClasseText: {
        fontSize: 12,
        fontWeight: '700',
    },
    ticketTypeBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        backgroundColor: '#EDE9FE',
        borderWidth: 1,
        borderColor: '#8B5CF6',
    },
    ticketTypeText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6B21A8',
    },
    ticketEscaleBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        borderWidth: 1,
    },
    ticketEscaleText: {
        fontSize: 11,
        fontWeight: '600',
    },
    ticketItineraire: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F5F3FF',
        padding: 12,
        borderRadius: 8,
    },
    ticketVille: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flex: 1,
    },
    ticketVilleText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1F2937',
    },
    ticketFleche: {
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        paddingHorizontal: 10,
    },
    ticketDuree: {
        fontSize: 10,
        fontWeight: '500',
        color: '#6B7280',
    },
    ticketHoraires: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        backgroundColor: '#FAFAFA',
        padding: 10,
        borderRadius: 8,
    },
    ticketHoraireItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    ticketHoraireText: {
        fontSize: 13,
        fontWeight: '500',
        color: '#374151',
    },
    ticketPlaceText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#8B5CF6',
    },
    ticketServiceTag: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: '#F3F4F6',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#D1D5DB',
    },
    ticketServiceText: {
        fontSize: 11,
        fontWeight: '500',
        color: '#4B5563',
    },
    ticketCompagnie: {
        paddingVertical: 6,
    },
    ticketCompagnieText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6B7280',
    },

    // ========== STYLES EMPLOI ========== //
    emploiBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        borderWidth: 1,
    },
    emploiBadgeText: {
        fontSize: 12,
        fontWeight: '700',
    },
    emploiDomaineBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        backgroundColor: '#DBEAFE',
        borderWidth: 1,
        borderColor: '#3B82F6',
    },
    emploiDomaineText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#1E40AF',
    },
    emploiTeletravailBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        backgroundColor: '#ECFDF5',
        borderWidth: 1,
        borderColor: '#10B981',
    },
    emploiTeletravailText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#047857',
    },
    emploiIdentity: {
        paddingVertical: 8,
        gap: 4,
    },
    emploiPosteText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1F2937',
    },
    emploiEntrepriseText: {
        fontSize: 13,
        fontWeight: '500',
        color: '#6B7280',
    },
    emploiSalaire: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#EFF6FF',
        padding: 10,
        borderRadius: 8,
    },
    emploiSalaireText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1E40AF',
    },
    emploiInfos: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    emploiInfoItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    emploiInfoText: {
        fontSize: 13,
        fontWeight: '500',
        color: '#374151',
    },
    emploiCompetences: {
        paddingVertical: 6,
    },
    emploiCompetencesTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6B7280',
    },
    emploiCompetenceTag: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: '#EFF6FF',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#3B82F6',
    },
    emploiCompetenceText: {
        fontSize: 11,
        fontWeight: '500',
        color: '#1E40AF',
    },

    // ========== STYLES CHAUSSURE ========== //
    chaussureBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        borderWidth: 1,
        alignSelf: 'flex-start',
    },
    chaussureBadgeText: {
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    chaussureMarqueBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        backgroundColor: '#FEF3C7',
        borderWidth: 1,
        borderColor: '#F59E0B',
        alignSelf: 'flex-start',
    },
    chaussureMarqueText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#92400E',
    },
    chaussureUsageBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        backgroundColor: '#E0E7FF',
        borderWidth: 1,
        borderColor: '#6366F1',
        alignSelf: 'flex-start',
    },
    chaussureUsageText: {
        fontSize: 11,
        fontWeight: '500',
        color: '#3730A3',
    },
    chaussureIdentity: {
        paddingVertical: 6,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    chaussureIdentityText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1F2937',
    },
    chaussureCaracs: {
        gap: 6,
    },
    chaussureCaracItem: {
        flexDirection: 'row',
        gap: 6,
    },
    chaussureCaracLabel: {
        fontSize: 12,
        fontWeight: '500',
        color: '#6B7280',
    },
    chaussureCaracText: {
        fontSize: 12,
        fontWeight: '400',
        color: '#374151',
    },
    // ✅ NOUVEAU: Styles pour le sélecteur de variantes chaussures
    chaussureVariantOption: {
        padding: 10,
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: '#E5E7EB',
        backgroundColor: '#FFFFFF',
        marginBottom: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    chaussureVariantOptionActive: {
        borderColor: '#F97316',
        backgroundColor: '#FFEDD5',
    },
    chaussureVariantOptionOutOfStock: {
        opacity: 0.5,
        borderColor: '#D1D5DB',
        backgroundColor: '#F9FAFB',
    },
    chaussureVariantImage: {
        width: 50,
        height: 50,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
    },
    chaussureVariantInfo: {
        flex: 1,
        gap: 2,
    },
    chaussureVariantText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#374151',
    },
    chaussureVariantTextActive: {
        color: '#F97316',
    },
    chaussureVariantTextDisabled: {
        color: '#9CA3AF',
    },
    chaussureVariantPrice: {
        fontSize: 12,
        fontWeight: '700',
        color: '#1F2937',
    },
    chaussureVariantPriceActive: {
        color: '#F97316',
    },
    chaussureVariantStockLow: {
        fontSize: 10,
        fontWeight: '500',
        color: '#F59E0B',
        marginTop: 2,
    },
    chaussureVariantOutOfStockText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#DC2626',
        marginTop: 2,
    },

    // ========== STYLES LIVRES & FOURNITURES ========== //
    livreBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        borderWidth: 1,
        alignSelf: 'flex-start',
    },
    livreBadgeText: {
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    livreNiveauBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        backgroundColor: '#EDE9FE',
        borderWidth: 1,
        borderColor: '#7C3AED',
        alignSelf: 'flex-start',
    },
    livreNiveauText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#5B21B6',
    },
    livreIdentity: {
        paddingVertical: 6,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    livreIdentityText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1F2937',
    },
    livreInfos: {
        gap: 6,
    },
    livreInfoItem: {
        flexDirection: 'row',
        gap: 6,
    },
    livreInfoLabel: {
        fontSize: 12,
        fontWeight: '500',
        color: '#6B7280',
    },
    livreInfoText: {
        fontSize: 12,
        fontWeight: '400',
        color: '#374151',
    },
    livreIsbnBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#D1D5DB',
        alignSelf: 'flex-start',
    },
    livreIsbnText: {
        fontSize: 10,
        fontWeight: '500',
        color: '#6B7280',
        fontFamily: 'monospace',
    },
    livreTypeBadge: {
        backgroundColor: '#EDE9FE',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#A78BFA',
        alignSelf: 'flex-start',
    },
    livreTypeText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6B21A8',
    },
    livreProgrammeBadge: {
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#FCD34D',
        alignSelf: 'flex-start',
    },
    livreProgrammeText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#92400E',
    },
    livreFormatBadge: {
        backgroundColor: '#DBEAFE',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#93C5FD',
        alignSelf: 'flex-start',
    },
    livreFormatText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#1E40AF',
    },
    livreCouleurBadge: {
        backgroundColor: '#FCE7F3',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#F9A8D4',
        alignSelf: 'flex-start',
    },
    livreCouleurText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#BE185D',
    },

    // ========== STYLES COVOITURAGE ========== //
    covoiturageItineraire: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 8,
        backgroundColor: '#FCE7F3',
        borderRadius: 12,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: '#F9A8D4',
    },
    covoiturageVille: {
        fontSize: 14,
        fontWeight: '700',
        color: '#BE185D',
    },
    covoiturageHoraires: {
        flexDirection: 'row',
        gap: 12,
        flexWrap: 'wrap',
    },
    covoiturageHoraireText: {
        fontSize: 12,
        fontWeight: '500',
        color: '#4B5563',
    },
    covoituragePlacesBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 10,
        backgroundColor: '#D1FAE5',
        borderWidth: 1,
        borderColor: '#10B981',
        alignSelf: 'flex-start',
    },
    covoituragePlacesText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#065F46',
    },
    covoiturageVehiculeBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        backgroundColor: '#EDE9FE',
        borderWidth: 1,
        borderColor: '#7C3AED',
        alignSelf: 'flex-start',
    },
    covoiturageVehiculeText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#5B21B6',
    },
    covoituragePreferences: {
        paddingVertical: 4,
    },
    covoituragePreferencesText: {
        fontSize: 11,
        fontWeight: '400',
        color: '#6B7280',
    },

    // ========== STYLES EVENEMENTIEL ========== //
    evenementTypeBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: '#FCE7F3',
        borderWidth: 1,
        borderColor: '#EC4899',
        alignSelf: 'flex-start',
    },
    evenementTypeText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#BE185D',
    },
    evenementCapaciteBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10,
        backgroundColor: '#E0E7FF',
        borderWidth: 1,
        borderColor: '#6366F1',
        alignSelf: 'flex-start',
    },
    evenementCapaciteText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#3730A3',
    },
    evenementDureeBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10,
        backgroundColor: '#FEF3C7',
        borderWidth: 1,
        borderColor: '#F59E0B',
        alignSelf: 'flex-start',
    },
    evenementDureeText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#92400E',
    },
    evenementServices: {
        gap: 6,
    },
    evenementServicesTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: '#374151',
    },
    evenementServiceTag: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: '#D1FAE5',
        borderWidth: 1,
        borderColor: '#10B981',
    },
    evenementServiceText: {
        fontSize: 10,
        fontWeight: '500',
        color: '#065F46',
    },
    evenementServicesPlus: {
        fontSize: 10,
        fontWeight: '600',
        color: '#6B7280',
        paddingHorizontal: 8,
    },
    evenementEquipements: {
        paddingVertical: 4,
    },
    evenementEquipementsText: {
        fontSize: 11,
        fontWeight: '400',
        color: '#6B7280',
    },

    // ========== STYLES VOYAGE & TOURISME ========== //
    voyageBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: '#E0F2FE',
        borderWidth: 1,
        borderColor: '#0EA5E9',
        alignSelf: 'flex-start',
    },
    voyageText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#075985',
    },
    voyageDestBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10,
        backgroundColor: '#FEF3C7',
        borderWidth: 1,
        borderColor: '#F59E0B',
    },
    voyageDestText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#92400E',
    },
    voyageDureeBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10,
        backgroundColor: '#E0E7FF',
        borderWidth: 1,
        borderColor: '#6366F1',
    },
    voyageDureeText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#3730A3',
    },
    voyageServiceText: {
        fontSize: 10,
        fontWeight: '400',
        color: '#059669',
    },
    voyageHebergement: {
        fontSize: 11,
        fontWeight: '500',
        color: '#6B7280',
    },

    // ========== STYLES DEMENAGEMENT ========== //
    demenagementBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: '#FEF3C7',
        borderWidth: 1,
        borderColor: '#F59E0B',
        alignSelf: 'flex-start',
    },
    demenagementText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#92400E',
    },
    demenagementVolumeBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10,
        backgroundColor: '#E0E7FF',
        borderWidth: 1,
        borderColor: '#6366F1',
    },
    demenagementVolumeText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#3730A3',
    },
    demenagementServiceText: {
        fontSize: 10,
        fontWeight: '400',
        color: '#059669',
    },
    demenagementVehicule: {
        fontSize: 11,
        fontWeight: '500',
        color: '#6B7280',
    },

    // ========== STYLES PLOMBERIE ========== //
    plomberieBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: '#DBEAFE',
        borderWidth: 1,
        borderColor: '#3B82F6',
        alignSelf: 'flex-start',
    },
    plomberieText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#1E40AF',
    },
    plomberieUrgenceBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10,
        backgroundColor: '#FEE2E2',
        borderWidth: 1,
        borderColor: '#EF4444',
    },
    plomberieUrgenceText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#991B1B',
    },
    plomberieSpecialites: {
        fontSize: 11,
        fontWeight: '400',
        color: '#6B7280',
    },
    plomberieGarantie: {
        fontSize: 11,
        fontWeight: '500',
        color: '#059669',
    },

    // ========== STYLES NETTOYAGE ========== //
    nettoyageBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: '#D1FAE5',
        borderWidth: 1,
        borderColor: '#10B981',
        alignSelf: 'flex-start',
    },
    nettoyageText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#065F46',
    },
    nettoyageFrequenceBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10,
        backgroundColor: '#FEF3C7',
        borderWidth: 1,
        borderColor: '#F59E0B',
    },
    nettoyageFrequenceText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#92400E',
    },
    nettoyageServiceText: {
        fontSize: 10,
        fontWeight: '400',
        color: '#059669',
    },
    nettoyageBioBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10,
        backgroundColor: '#ECFDF5',
        borderWidth: 1,
        borderColor: '#10B981',
    },
    nettoyageBioText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#065F46',
    },

    // ========== STYLES ASSURANCE ========== //
    assuranceBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: '#EDE9FE',
        borderWidth: 1,
        borderColor: '#7C3AED',
        alignSelf: 'flex-start',
    },
    assuranceText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#5B21B6',
    },
    assuranceCouverture: {
        fontSize: 11,
        fontWeight: '600',
        color: '#6B7280',
    },
    assuranceDuree: {
        fontSize: 11,
        fontWeight: '400',
        color: '#6B7280',
    },
    assuranceFranchise: {
        fontSize: 10,
        fontWeight: '400',
        color: '#9CA3AF',
    },

    // ========== STYLES ÉLECTRICIEN (SERVICE) ========== //
    electricienBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: '#FEF3C7',
        borderWidth: 1,
        borderColor: '#F59E0B',
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    electricienText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#92400E',
    },
    electricienSpecialiteBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: '#E0E7FF',
        borderWidth: 1,
        borderColor: '#6366F1',
    },
    electricienSpecialiteText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#3730A3',
    },
    electricienUrgenceBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: '#FEE2E2',
        borderWidth: 1,
        borderColor: '#DC2626',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    electricienUrgenceText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#DC2626',
    },
    electricienDispoBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#9CA3AF',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    electricienDispoText: {
        fontSize: 10,
        fontWeight: '500',
        color: '#6B7280',
    },
    electricienDevisBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: '#D1FAE5',
        borderWidth: 1,
        borderColor: '#10B981',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    electricienDevisText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#059669',
    },
    electricienGarantie: {
        fontSize: 11,
        fontWeight: '500',
        color: '#059669',
    },
    electricienCertif: {
        fontSize: 11,
        fontWeight: '500',
        color: '#F59E0B',
    },
    electricienZones: {
        fontSize: 11,
        fontWeight: '400',
        color: '#6366F1',
    },
    electricienPromotionBadge: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: '#FEF2F2',
        borderRadius: 8,
        borderWidth: 1.5,
        borderColor: '#DC2626',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        alignSelf: 'flex-start',
    },
    electricienPromotionText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#DC2626',
    },
    electricienChargeBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        marginLeft: 4,
    },
    electricienChargeText: {
        fontSize: 9,
        fontWeight: '700',
    },

    // ========== STYLES ÉLECTRICIEN AUTOMOBILE (SERVICE) ========== //
    electricienAutoBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: '#FFEDD5',
        borderWidth: 1,
        borderColor: '#FF6B35',
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    electricienAutoText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#C2410C',
    },
    electricienAutoSpecialiteBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: '#DBEAFE',
        borderWidth: 1,
        borderColor: '#3B82F6',
    },
    electricienAutoSpecialiteText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#1E40AF',
    },
    electricienAutoVehicules: {
        fontSize: 11,
        fontWeight: '500',
        color: '#6B7280',
    },
    electricienAutoUrgenceBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: '#FEE2E2',
        borderWidth: 1,
        borderColor: '#DC2626',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    electricienAutoUrgenceText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#DC2626',
    },
    electricienAutoDispoBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#9CA3AF',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    electricienAutoDispoText: {
        fontSize: 10,
        fontWeight: '500',
        color: '#6B7280',
    },
    electricienAutoDeplacementBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: '#D1FAE5',
        borderWidth: 1,
        borderColor: '#10B981',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    electricienAutoDeplacementText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#059669',
    },
    electricienAutoDiagnostic: {
        fontSize: 11,
        fontWeight: '500',
        color: '#8B5CF6',
    },
    electricienAutoGarantie: {
        fontSize: 11,
        fontWeight: '500',
        color: '#059669',
    },
    electricienAutoZones: {
        fontSize: 11,
        fontWeight: '400',
        color: '#6366F1',
    },

    // ========== STYLES INGÉNIEUR / ARCHITECTE (SERVICE BTP) ========== //
    ingenieurBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: '#E0F2FE',
        borderWidth: 1,
        borderColor: '#0891B2',
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    ingenieurText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#0C4A6E',
    },
    ingenieurServiceBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: '#F0F9FF',
        borderWidth: 1,
        borderColor: '#0EA5E9',
    },
    ingenieurServiceText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#0C4A6E',
    },
    ingenieurDomaineBadge: {
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 6,
        backgroundColor: '#FEF3C7',
        borderWidth: 1,
        borderColor: '#F59E0B',
    },
    ingenieurDomaineText: {
        fontSize: 9,
        fontWeight: '600',
        color: '#92400E',
    },
    ingenieurLogiciels: {
        fontSize: 11,
        fontWeight: '500',
        color: '#8B5CF6',
    },
    ingenieurProjets: {
        fontSize: 11,
        fontWeight: '500',
        color: '#F59E0B',
    },
    ingenieurCertBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: '#D1FAE5',
        borderWidth: 1,
        borderColor: '#10B981',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    ingenieurCertText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#059669',
    },
    ingenieurDispoBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#9CA3AF',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    ingenieurDispoText: {
        fontSize: 10,
        fontWeight: '500',
        color: '#6B7280',
    },
    ingenieurTarifBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: '#D1FAE5',
        borderWidth: 1,
        borderColor: '#10B981',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    ingenieurTarifText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#059669',
    },
    ingenieurDevisBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: '#D1FAE5',
        borderWidth: 1,
        borderColor: '#10B981',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    ingenieurDevisText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#059669',
    },
    ingenieurZones: {
        fontSize: 11,
        fontWeight: '400',
        color: '#6366F1',
    },

    // ========== STYLES MAÇON (SERVICE) ========== //
    maconBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: '#E7E5E4',
        borderWidth: 1,
        borderColor: '#78716C',
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    maconText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#44403C',
    },
    maconSpecialiteBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: '#FEF3C7',
        borderWidth: 1,
        borderColor: '#F59E0B',
    },
    maconSpecialiteText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#92400E',
    },
    maconBatiments: {
        fontSize: 11,
        fontWeight: '500',
        color: '#6B7280',
    },
    maconAssuranceBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: '#D1FAE5',
        borderWidth: 1,
        borderColor: '#10B981',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    maconAssuranceText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#047857',
    },
    maconGarantieBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: '#DCFCE7',
        borderWidth: 1,
        borderColor: '#059669',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    maconGarantieText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#059669',
    },
    maconDevisBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: '#E0E7FF',
        borderWidth: 1,
        borderColor: '#6366F1',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    maconDevisText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#4F46E5',
    },
    maconDispo: {
        fontSize: 11,
        fontWeight: '500',
        color: '#6B7280',
    },
    maconZones: {
        fontSize: 11,
        fontWeight: '400',
        color: '#6366F1',
    },

    // ========== STYLES INGÉNIEUR / ARCHITECTE (SERVICE) ========== //
    archiTypeBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: '#CFFAFE',
        borderWidth: 1,
        borderColor: '#0891B2',
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    archiTypeText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#164E63',
    },
    archiServiceBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: '#E0E7FF',
        borderWidth: 1,
        borderColor: '#6366F1',
    },
    archiServiceText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#3730A3',
    },
    archiProjets: {
        fontSize: 11,
        fontWeight: '500',
        color: '#6B7280',
    },
    archiLogiciels: {
        fontSize: 11,
        fontWeight: '500',
        color: '#8B5CF6',
    },
    archiAssuranceBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: '#D1FAE5',
        borderWidth: 1,
        borderColor: '#10B981',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    archiAssuranceText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#047857',
    },
    archiDecennaleBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: '#DCFCE7',
        borderWidth: 1,
        borderColor: '#059669',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    archiDecennaleText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#047857',
    },
    archiCertifBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: '#FEF3C7',
        borderWidth: 1,
        borderColor: '#F59E0B',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    archiCertifText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#92400E',
    },
    archiTarif: {
        fontSize: 11,
        fontWeight: '500',
        color: '#6B7280',
    },
    archiZones: {
        fontSize: 11,
        fontWeight: '400',
        color: '#6366F1',
    },

    // ========== STYLES ELECTRICITE ========== //
    electriciteBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: '#FEF3C7',
        borderWidth: 1,
        borderColor: '#F59E0B',
        alignSelf: 'flex-start',
    },
    electriciteText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#92400E',
    },
    electriciteMarqueBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10,
        backgroundColor: '#E0E7FF',
        borderWidth: 1,
        borderColor: '#6366F1',
    },
    electriciteMarqueText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#3730A3',
    },
    electriciteCarac: {
        fontSize: 11,
        fontWeight: '400',
        color: '#6B7280',
    },

    // ========== STYLES IMAGE & SON ========== //
    imageSonBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        borderWidth: 1,
        alignSelf: 'flex-start',
    },
    imageSonBadgeText: {
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    imageSonMarqueBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10,
        backgroundColor: '#FEF3C7',
        borderWidth: 1,
        borderColor: '#F59E0B',
    },
    imageSonMarqueText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#92400E',
    },
    imageSonType: {
        fontSize: 12,
        fontWeight: '500',
        color: '#374151',
    },
    imageSonDiagonale: {
        fontSize: 11,
        fontWeight: '400',
        color: '#6B7280',
    },
    imageSonGarantie: {
        fontSize: 11,
        fontWeight: '500',
        color: '#059669',
    },

    // ========== STYLES SPORT & LOISIRS ========== //
    sportBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: '#DBEAFE',
        borderWidth: 1,
        borderColor: '#3B82F6',
        alignSelf: 'flex-start',
    },
    sportText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#1E40AF',
    },
    sportCategorieBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10,
        backgroundColor: '#FEF3C7',
        borderWidth: 1,
        borderColor: '#F59E0B',
    },
    sportCategorieText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#92400E',
    },
    sportNiveau: {
        fontSize: 11,
        fontWeight: '500',
        color: '#6B7280',
    },
    sportMarque: {
        fontSize: 11,
        fontWeight: '400',
        color: '#9CA3AF',
    },

    // ========== STYLES BRICOLAGE ========== //
    bricolageBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: '#FED7AA',
        borderWidth: 1,
        borderColor: '#F97316',
        alignSelf: 'flex-start',
    },
    bricolageText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#9A3412',
    },
    bricolageCategorie: {
        fontSize: 11,
        fontWeight: '500',
        color: '#6B7280',
    },
    bricolageMarque: {
        fontSize: 11,
        fontWeight: '400',
        color: '#9CA3AF',
    },

    // ========== STYLES ENFANTS & BEBES ========== //
    enfantBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: '#FCE7F3',
        borderWidth: 1,
        borderColor: '#EC4899',
        alignSelf: 'flex-start',
    },
    enfantText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#BE185D',
    },
    enfantAgeBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10,
        backgroundColor: '#FEF3C7',
        borderWidth: 1,
        borderColor: '#F59E0B',
    },
    enfantAgeText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#92400E',
    },
    enfantEtat: {
        fontSize: 11,
        fontWeight: '400',
        color: '#6B7280',
    },
    enfantSecurite: {
        fontSize: 11,
        fontWeight: '600',
        color: '#059669',
    },

    // ========== STYLES DECORATION ========== //
    decorationBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: '#F3E8FF',
        borderWidth: 1,
        borderColor: '#A855F7',
        alignSelf: 'flex-start',
    },
    decorationText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#6B21A8',
    },
    decorationStyleBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10,
        backgroundColor: '#FEF3C7',
        borderWidth: 1,
        borderColor: '#F59E0B',
    },
    decorationStyleText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#92400E',
    },
    decorationCouleur: {
        fontSize: 11,
        fontWeight: '500',
        color: '#6B7280',
    },
    decorationMateriau: {
        fontSize: 11,
        fontWeight: '400',
        color: '#9CA3AF',
    },

    // ========== STYLES JOUETS ENFANTS ========== //
    jouetBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: '#FCE7F3',
        borderWidth: 1,
        borderColor: '#EC4899',
        alignSelf: 'flex-start',
    },
    jouetText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#BE185D',
    },
    jouetAgeBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10,
        backgroundColor: '#FEF3C7',
        borderWidth: 1,
        borderColor: '#F59E0B',
    },
    jouetAgeText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#92400E',
    },
    jouetEtat: {
        fontSize: 11,
        fontWeight: '400',
        color: '#6B7280',
    },
    jouetNorme: {
        fontSize: 11,
        fontWeight: '600',
        color: '#059669',
    },

    // ========== STYLES SANTE & BEAUTE ========== //
    beauteBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: '#FCE7F3',
        borderWidth: 1,
        borderColor: '#F472B6',
        alignSelf: 'flex-start',
    },
    beauteText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#BE185D',
    },
    beauteMarqueBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10,
        backgroundColor: '#FEF3C7',
        borderWidth: 1,
        borderColor: '#F59E0B',
    },
    beauteMarqueText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#92400E',
    },
    beauteBioBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10,
        backgroundColor: '#D1FAE5',
        borderWidth: 1,
        borderColor: '#10B981',
    },
    beauteBioText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#065F46',
    },

    // ========== STYLES BIEN-ETRE ========== //
    bienEtreBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: '#E0E7FF',
        borderWidth: 1,
        borderColor: '#6366F1',
        alignSelf: 'flex-start',
    },
    bienEtreText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#3730A3',
    },
    bienEtreDuree: {
        fontSize: 11,
        fontWeight: '500',
        color: '#6B7280',
    },
    bienEtreTarif: {
        fontSize: 11,
        fontWeight: '400',
        color: '#9CA3AF',
    },

    // ========== STYLES BIJOUX ========== //
    bijouxBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: '#FEF3C7',
        borderWidth: 1,
        borderColor: '#F59E0B',
        alignSelf: 'flex-start',
    },
    bijouxText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#92400E',
    },
    bijouxMateriauBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10,
        backgroundColor: '#FEF3C7',
        borderWidth: 1,
        borderColor: '#FBBF24',
    },
    bijouxMateriauText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#78350F',
    },
    bijouxPoids: {
        fontSize: 11,
        fontWeight: '500',
        color: '#6B7280',
    },
    bijouxCertif: {
        fontSize: 11,
        fontWeight: '600',
        color: '#059669',
    },

    // ========== STYLES JURIDIQUE ========== //
    juridiqueBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: '#E0E7FF',
        borderWidth: 1,
        borderColor: '#6366F1',
        alignSelf: 'flex-start',
    },
    juridiqueText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#3730A3',
    },
    juridiqueDomaine: {
        fontSize: 11,
        fontWeight: '500',
        color: '#6B7280',
    },
    juridiqueTarif: {
        fontSize: 11,
        fontWeight: '400',
        color: '#9CA3AF',
    },

    // ========== STYLES MUSIQUE (SERVICES) ========== //
    musiqueServiceBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: '#F3E8FF',
        borderWidth: 1,
        borderColor: '#A855F7',
        alignSelf: 'flex-start',
    },
    musiqueServiceText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#6B21A8',
    },
    musiqueServiceGenre: {
        fontSize: 11,
        fontWeight: '500',
        color: '#6B7280',
    },
    musiqueServiceDuree: {
        fontSize: 11,
        fontWeight: '400',
        color: '#9CA3AF',
    },

    // ========== STYLES PHOTOGRAPHIE ========== //
    photoBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: '#DBEAFE',
        borderWidth: 1,
        borderColor: '#3B82F6',
        alignSelf: 'flex-start',
    },
    photoText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#1E40AF',
    },
    photoStyle: {
        fontSize: 11,
        fontWeight: '500',
        color: '#6B7280',
    },
    photoEquipement: {
        fontSize: 11,
        fontWeight: '400',
        color: '#9CA3AF',
    },

    // ========== STYLES ENTREPRISE & INDUSTRIE ========== //
    entrepriseBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: '#E0E7FF',
        borderWidth: 1,
        borderColor: '#6366F1',
        alignSelf: 'flex-start',
    },
    entrepriseText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#3730A3',
    },
    entrepriseSecteur: {
        fontSize: 11,
        fontWeight: '500',
        color: '#6B7280',
    },
    entrepriseCertif: {
        fontSize: 11,
        fontWeight: '600',
        color: '#059669',
    },

    // ========== STYLES REPARATION ========== //
    reparationBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: '#FED7AA',
        borderWidth: 1,
        borderColor: '#F97316',
        alignSelf: 'flex-start',
    },
    reparationText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#9A3412',
    },
    reparationSpec: {
        fontSize: 11,
        fontWeight: '500',
        color: '#6B7280',
    },
    reparationGarantie: {
        fontSize: 11,
        fontWeight: '600',
        color: '#059669',
    },

    // ========== STYLES CARRELAGE ========== //
    carrelageBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: '#E7E5E4',
        borderWidth: 1,
        borderColor: '#78716C',
        alignSelf: 'flex-start',
    },
    carrelageText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#44403C',
    },
    carrelageMateriauBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10,
        backgroundColor: '#FEF3C7',
        borderWidth: 1,
        borderColor: '#F59E0B',
    },
    carrelageMateriauText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#92400E',
    },
    carrelageDimensions: {
        fontSize: 11,
        fontWeight: '500',
        color: '#6B7280',
    },
    carrelageFinition: {
        fontSize: 11,
        fontWeight: '400',
        color: '#6B7280',
    },
    carrelageUsage: {
        fontSize: 11,
        fontWeight: '400',
        color: '#9CA3AF',
    },

    // ========== STYLES PLOMBERIE & SANITAIRE ========== //
    plomberieCategorieBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: '#E0F7FA',
        borderWidth: 1,
        borderColor: '#00BCD4',
        alignSelf: 'flex-start',
    },
    plomberieCategorieText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#006064',
    },
    plomberieEtatBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10,
        borderWidth: 1,
        alignSelf: 'flex-start',
    },
    plomberieEtatText: {
        fontSize: 11,
        fontWeight: '600',
    },
    plomberieMarqueBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10,
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#9CA3AF',
        alignSelf: 'flex-start',
    },
    plomberieMarqueText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#374151',
    },
    plomberieMateriauBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10,
        backgroundColor: '#FEF3C7',
        borderWidth: 1,
        borderColor: '#F59E0B',
        alignSelf: 'flex-start',
    },
    plomberieMateriauText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#92400E',
    },
    plomberieFinition: {
        fontSize: 11,
        fontWeight: '500',
        color: '#6B7280',
    },
    plomberieService: {
        fontSize: 11,
        fontWeight: '400',
        color: '#6B7280',
    },

    // ========== STYLES FORMATION ========== //
    formationNiveauBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        borderWidth: 1,
    },
    formationNiveauText: {
        fontSize: 12,
        fontWeight: '700',
    },
    formationModeBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        backgroundColor: '#EDE9FE',
        borderWidth: 1,
        borderColor: '#7C3AED',
    },
    formationModeText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6D28D9',
    },
    formationCertifBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        backgroundColor: '#ECFDF5',
        borderWidth: 1,
        borderColor: '#10B981',
    },
    formationCertifText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#047857',
    },
    formationIdentity: {
        paddingVertical: 8,
    },
    formationIdentityText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1F2937',
    },
    formationInfos: {
        flexDirection: 'column',
        gap: 6,
        backgroundColor: '#FAF5FF',
        padding: 10,
        borderRadius: 8,
    },
    formationInfoItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    formationInfoLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#374151',
    },
    formationInfoText: {
        fontSize: 13,
        fontWeight: '500',
        color: '#6B7280',
    },
    formationProgramme: {
        paddingVertical: 6,
    },
    formationProgrammeTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6B7280',
    },
    formationMatiereTag: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: '#EEF2FF',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#6366F1',
    },
    formationMatiereText: {
        fontSize: 11,
        fontWeight: '500',
        color: '#4F46E5',
    },
    // ✅ NOUVEAUX STYLES FORMATION ENRICHIS
    formationTypeBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        backgroundColor: '#F3E8FF',
        borderWidth: 1,
        borderColor: '#A855F7',
    },
    formationTypeText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#7C3AED',
    },
    formationSection: {
        paddingVertical: 8,
    },
    formationSectionTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 4,
    },
    formationTag: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: '#F3E8FF',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#A855F7',
    },
    formationTagText: {
        fontSize: 11,
        fontWeight: '500',
        color: '#7C3AED',
    },

    // ========== STYLES HOTELLERIE ========== //
    hotelCatBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#F59E0B',
    },
    hotelCatText: {
        fontSize: 14,
        fontWeight: '700',
    },
    hotelTypeBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        backgroundColor: '#FCE7F3',
        borderWidth: 1,
        borderColor: '#EC4899',
    },
    hotelTypeText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#DB2777',
    },
    hotelServiceBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        backgroundColor: '#ECFDF5',
        borderWidth: 1,
        borderColor: '#10B981',
    },
    hotelServiceText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#047857',
    },
    hotelPrix: {
        paddingVertical: 8,
        backgroundColor: '#FDF2F8',
        padding: 10,
        borderRadius: 8,
    },
    hotelPrixText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#DB2777',
        textAlign: 'center',
    },
    hotelEquipements: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    hotelEquipementTag: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: '#FEF2F2',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#F87171',
    },
    hotelEquipementText: {
        fontSize: 11,
        fontWeight: '500',
        color: '#B91C1C',
    },
    hotelServices: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    hotelServiceTag: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: '#F3F4F6',
        borderRadius: 6,
    },
    hotelServiceTagText: {
        fontSize: 11,
        fontWeight: '500',
        color: '#4B5563',
    },

    // ✅ NOUVEAUX STYLES: Variantes de chambres
    hotelVariantes: {
        backgroundColor: '#FFF7ED',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#FED7AA',
        gap: 10,
    },
    hotelVariantesHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    hotelVariantesTitre: {
        fontSize: 14,
        fontWeight: '700',
        color: '#9A3412',
    },
    hotelVariantesList: {
        gap: 8,
    },
    hotelVarianteCard: {
        backgroundColor: '#FFFFFF',
        padding: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#FDBA74',
        gap: 6,
    },
    hotelVarianteHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    hotelVarianteType: {
        fontSize: 13,
        fontWeight: '700',
        color: '#1F2937',
        flex: 1,
    },
    hotelVariantePrix: {
        fontSize: 13,
        fontWeight: '700',
        color: '#EC4899',
    },
    hotelVarianteDetails: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    hotelVarianteCapacite: {
        fontSize: 11,
        fontWeight: '500',
        color: '#6B7280',
    },
    hotelVarianteSuperficie: {
        fontSize: 11,
        fontWeight: '500',
        color: '#6B7280',
    },
    hotelVarianteDisponibles: {
        fontSize: 11,
        fontWeight: '600',
        color: '#059669',
    },
    hotelVarianteEquipements: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 4,
    },
    hotelVarianteEquipTag: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        backgroundColor: '#F0FDF4',
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#86EFAC',
        fontSize: 10,
        fontWeight: '500',
        color: '#15803D',
    },
    hotelVariantesMore: {
        fontSize: 12,
        fontWeight: '600',
        color: '#EA580C',
        textAlign: 'center',
        marginTop: 4,
    },

    // ========== NOUVEAUX STYLES IMAGE & SON ========== //
    imageSonCategorieBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10,
        backgroundColor: '#F3E5F5',
        borderWidth: 1,
        borderColor: '#9C27B0',
    },
    imageSonCategorieText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#7B1FA2',
    },
    imageSonModeleBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10,
        backgroundColor: '#FEF3C7',
        borderWidth: 1,
        borderColor: '#F59E0B',
    },
    imageSonModeleText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#92400E',
    },
    imageSonSpec: {
        fontSize: 11,
        fontWeight: '500',
        color: '#6B7280',
    },
    imageSonFonctionTag: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: '#EEF2FF',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#818CF8',
    },
    imageSonFonctionText: {
        fontSize: 10,
        fontWeight: '500',
        color: '#4F46E5',
    },
    imageSonConnectTag: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: '#DBEAFE',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#60A5FA',
    },
    imageSonConnectText: {
        fontSize: 10,
        fontWeight: '500',
        color: '#1E40AF',
    },

    // ========== NOUVEAUX STYLES IMMOBILIER ========== //
    immoAccesChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 5,
        backgroundColor: '#ECFDF5',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#10B981',
        alignSelf: 'flex-start',
    },
    immoAccesText: {
        fontSize: 11,
        fontWeight: '500',
        color: '#059669',
    },
    immoProximites: {
        gap: 6,
    },
    immoProximitesLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#6B7280',
    },
    immoProxTag: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: '#FFF7ED',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#FDBA74',
    },
    immoProxText: {
        fontSize: 10,
        fontWeight: '500',
        color: '#C2410C',
    },
    immoConditions: {
        gap: 6,
    },
    immoConditionsLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#6B7280',
    },
    immoCondTag: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: '#EFF6FF',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#93C5FD',
    },
    immoCondText: {
        fontSize: 10,
        fontWeight: '500',
        color: '#1E40AF',
    },

    // ========== STYLES RÉPARATEURS (TOUS TYPES) ========== //
    repairTypes: {
        gap: 6,
        marginTop: 8,
    },
    repairTypesTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 6,
    },
    repairTypeTag: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: '#EFF6FF',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#3B82F6',
    },
    repairTypeText: {
        fontSize: 11,
        fontWeight: '500',
        color: '#1E40AF',
    },
    repairMarques: {
        gap: 6,
        marginTop: 8,
    },
    repairMarquesTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 6,
    },
    repairMarqueTag: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: '#FEF3C7',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#F59E0B',
    },
    repairMarqueText: {
        fontSize: 11,
        fontWeight: '500',
        color: '#92400E',
    },
    repairExtraBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: '#ECFDF5',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#10B981',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    repairExperience: {
        marginTop: 8,
    },
    repairExperienceText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6B7280',
    },
    repairSpecialtyBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        backgroundColor: '#F3E8FF',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#A855F7',
    },
    repairSpecialtyText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#7C3AED',
    },
});

export default ProductCard;

