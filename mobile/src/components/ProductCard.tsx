import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { Alert, Dimensions, Image, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getCategoryConfig, getCategoryStyle, getCategoryTerminology } from '../config/categoryConfig';
import SafeIcon from './SafeIcon';

const { width } = Dimensions.get('window');

interface ProductCardProps {
    product: any;
    service: any;
    prestataire?: any;
    onPress?: () => void;
    onChatPress?: () => void;
    onGalleryPress?: () => void;
    onWhatsAppPress?: () => void;
    onBookSeat?: () => void; // Pour réservation de place (ticket_voyage)
}

const ProductCard: React.FC<ProductCardProps> = ({
    product,
    service,
    prestataire,
    onPress,
    onChatPress,
    onGalleryPress,
    onWhatsAppPress,
    onBookSeat
}) => {
    const [showAllImages, setShowAllImages] = useState(false);

    // Récupérer la configuration intelligente de la catégorie
    const categoryConfig = getCategoryConfig(product.type || 'default');
    const categoryStyle = getCategoryStyle(product.type || 'default');
    const terminology = getCategoryTerminology(product.type || 'default');

    // Extraire les images et vidéos
    const images = product.images || product.imagesRealisations || [];
    const videos = product.videos || product.videosRealisations || [];
    const mainImage = images[0] || null;
    const hasVideo = videos.length > 0;

    // GPS prioritaire : produit > service gps_fixe > service gps
    const productGPS = product.gps || product.gpsFixe;
    const serviceGPS = service.data?.gps_fixe?.valeur || service.data?.gps_fixe || service.gps;
    const displayGPS = productGPS || serviceGPS;

    // Formater le prix
    const formatPrice = () => {
        if (!product.prix) return null;
        const devise = product.devise || 'FCFA';
        return `${parseFloat(product.prix).toLocaleString()} ${devise}`;
    };

    // Obtenir l'icône et la couleur par type
    const getTypeStyle = () => {
        const styles = {
            immobilier_batiment: { icon: 'home', color: '#3B82F6', bg: '#EFF6FF', label: 'Immobilier' },
            immobilier_terrain: { icon: 'map', color: '#10B981', bg: '#D1FAE5', label: 'Terrain' },
            hotellerie: { icon: 'building', color: '#EC4899', bg: '#FCE7F3', label: 'Hôtel' },
            automobile: { icon: 'car', color: '#F59E0B', bg: '#FEF3C7', label: 'Auto' },
            ticket_voyage: { icon: 'bus', color: '#8B5CF6', bg: '#F3E8FF', label: 'Voyage' },
            covoiturage: { icon: 'users', color: '#EC4899', bg: '#FCE7F3', label: 'Covoiturage' },
            vetement: { icon: 'shopping-bag', color: '#EF4444', bg: '#FEE2E2', label: 'Vêtement' },
            chaussure: { icon: 'shoe-prints', color: '#F97316', bg: '#FFEDD5', label: 'Chaussure' },
            electromenager: { icon: 'zap', color: '#14B8A6', bg: '#CCFBF1', label: 'Électro' },
            image_son: { icon: 'tv', color: '#9C27B0', bg: '#F3E5F5', label: 'Image/Son' },
            telephone: { icon: 'smartphone', color: '#FF9800', bg: '#FFF3E0', label: 'Téléphone' },
            ordinateur: { icon: 'monitor', color: '#00BCD4', bg: '#E0F7FA', label: 'Ordinateur' },
            mobilier: { icon: 'box', color: '#F97316', bg: '#FFEDD5', label: 'Mobilier' },
            decoration: { icon: 'image', color: '#E91E63', bg: '#FCE4EC', label: 'Déco' },
            ustensiles_cuisine: { icon: 'coffee', color: '#FF5722', bg: '#FFEBEE', label: 'Ustensiles' },
            aliments: { icon: 'pizza', color: '#84CC16', bg: '#ECFCCB', label: 'Aliment' },
            assurance: { icon: 'shield', color: '#14B8A6', bg: '#CCFBF1', label: 'Assurance' },
            livres_fournitures: { icon: 'book', color: '#6366F1', bg: '#E0E7FF', label: 'Livre' },
            quincaillerie: { icon: 'tool', color: '#64748B', bg: '#F1F5F9', label: 'Quincaillerie' },
            pharmacie: { icon: 'activity', color: '#059669', bg: '#D1FAE5', label: 'Pharmacie' },
            hopital_clinique: { icon: 'heart', color: '#DC2626', bg: '#FEE2E2', label: 'Hôpital' },
            prestation_service: { icon: 'briefcase', color: '#8B5CF6', bg: '#F3E8FF', label: 'Service' },
            cosmetique_parfum: { icon: 'sparkle', color: '#EC4899', bg: '#FCE7F3', label: 'Cosmétique' },
            bijoux: { icon: 'gem', color: '#F59E0B', bg: '#FEF3C7', label: 'Bijoux' },
            coiffure_beaute: { icon: 'scissors', color: '#E91E63', bg: '#FCE4EC', label: 'Coiffure' },
            autre: { icon: 'package', color: '#6B7280', bg: '#F3F4F6', label: 'Produit' }
        };
        return styles[product.type] || styles.autre;
    };

    const typeStyle = getTypeStyle();

    // Rendu spécialisé par type de produit
    const renderProductDetails = () => {
        switch (product.type) {
            case 'immobilier_batiment':
            case 'immobilier_terrain':
                return (
                    <View style={styles.detailsGrid}>
                        {product.typeImmobilier && (
                            <View style={styles.detailChip}>
                                <Text style={styles.detailText}>🏠 {product.typeImmobilier}</Text>
                            </View>
                        )}
                        {product.statutImmobilier && (
                            <View style={styles.detailChip}>
                                <Text style={styles.detailText}>📋 {product.statutImmobilier}</Text>
                            </View>
                        )}
                        {product.superficie && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="maximize-2" size={14} color="#6B7280" />
                                <Text style={styles.detailText}>{product.superficie} m²</Text>
                            </View>
                        )}
                        {product.nbChambres && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="grid" size={14} color="#6B7280" />
                                <Text style={styles.detailText}>{product.nbChambres} ch.</Text>
                            </View>
                        )}
                        {product.ameublement && (
                            <View style={styles.detailChip}>
                                <Text style={styles.detailText}>🛋️ {product.ameublement}</Text>
                            </View>
                        )}
                        {product.quartier && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="map-pin" size={14} color="#6B7280" />
                                <Text style={styles.detailText}>{product.quartier}</Text>
                            </View>
                        )}
                    </View>
                );

            case 'automobile':
                return (
                    <View style={styles.detailsGrid}>
                        {product.marque && (
                            <View style={styles.detailChip}>
                                <Text style={styles.detailText}>🏷️ {product.marque}</Text>
                            </View>
                        )}
                        {product.modele && (
                            <View style={styles.detailChip}>
                                <Text style={styles.detailText}>🚗 {product.modele}</Text>
                            </View>
                        )}
                        {product.etatVehicule && (
                            <View style={styles.detailChip}>
                                <Text style={styles.detailText}>{product.etatVehicule === 'Neuf' ? '✨' : '🔧'} {product.etatVehicule}</Text>
                            </View>
                        )}
                        {product.annee && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="calendar" size={14} color="#6B7280" />
                                <Text style={styles.detailText}>{product.annee}</Text>
                            </View>
                        )}
                        {product.kilometrage && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="activity" size={14} color="#6B7280" />
                                <Text style={styles.detailText}>{product.kilometrage} km</Text>
                            </View>
                        )}
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
                    </View>
                );

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

            case 'ticket_voyage':
                return (
                    <View style={styles.detailsGrid}>
                        {product.compagnie && (
                            <View style={styles.detailChip}>
                                <Text style={styles.detailText}>✈️ {product.compagnie}</Text>
                            </View>
                        )}
                        {product.typeVehiculeTransport && (
                            <View style={styles.detailChip}>
                                <Text style={styles.detailText}>🚌 {product.typeVehiculeTransport}</Text>
                            </View>
                        )}
                        {product.classeVoyage && (
                            <View style={styles.detailChip}>
                                <Text style={styles.detailText}>💺 {product.classeVoyage}</Text>
                            </View>
                        )}
                        {product.depart && product.destination && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="navigation" size={14} color="#6B7280" />
                                <Text style={styles.detailText}>{product.depart} → {product.destination}</Text>
                            </View>
                        )}
                        {product.dateDepart && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="calendar" size={14} color="#6B7280" />
                                <Text style={styles.detailText}>{product.dateDepart}</Text>
                            </View>
                        )}
                        {product.numeroPlace && (
                            <View style={styles.detailChip}>
                                <Text style={styles.detailText}>🎫 Place {product.numeroPlace}</Text>
                            </View>
                        )}
                    </View>
                );

            case 'vetement':
            case 'chaussure':
                return (
                    <View style={styles.detailsGrid}>
                        {product.taille && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="maximize" size={14} color="#6B7280" />
                                <Text style={styles.detailText}>Taille {product.taille}</Text>
                            </View>
                        )}
                        {product.couleur && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="droplet" size={14} color="#6B7280" />
                                <Text style={styles.detailText}>{product.couleur}</Text>
                            </View>
                        )}
                        {product.marque && (
                            <View style={styles.detailChip}>
                                <Text style={styles.detailText}>🏷️ {product.marque}</Text>
                            </View>
                        )}
                    </View>
                );

            case 'electromenager':
                return (
                    <View style={styles.detailsGrid}>
                        {product.marque && (
                            <View style={styles.detailChip}>
                                <Text style={styles.detailText}>🏷️ {product.marque}</Text>
                            </View>
                        )}
                        {product.modele && (
                            <View style={styles.detailChip}>
                                <Text style={styles.detailText}>📱 {product.modele}</Text>
                            </View>
                        )}
                        {product.etatProduit && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="check-circle" size={14} color="#10B981" />
                                <Text style={styles.detailText}>{product.etatProduit}</Text>
                            </View>
                        )}
                    </View>
                );

            case 'pharmacie':
                return (
                    <View style={styles.detailsGrid}>
                        {product.typePharmacie && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="shield" size={14} color="#059669" />
                                <Text style={styles.detailText}>{product.typePharmacie}</Text>
                            </View>
                        )}
                        {product.joursGarde && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="clock" size={14} color="#6B7280" />
                                <Text style={styles.detailText}>Garde: {product.joursGarde}</Text>
                            </View>
                        )}
                        {product.telephoneUrgence && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="phone" size={14} color="#DC2626" />
                                <Text style={styles.detailText}>{product.telephoneUrgence}</Text>
                            </View>
                        )}
                    </View>
                );

            case 'hopital_clinique':
                return (
                    <View style={styles.detailsSection}>
                        {/* Type d'établissement */}
                        {product.typeEtablissement && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="building" size={14} color="#DC2626" />
                                <Text style={styles.detailText}>{product.typeEtablissement}</Text>
                            </View>
                        )}

                        {/* Banque de sang */}
                        {product.banqueSang && (
                            <View style={[styles.detailChip, styles.highlightChip]}>
                                <Text style={styles.detailText}>🩸 Banque de sang</Text>
                            </View>
                        )}

                        {/* Prestations médicales */}
                        {product.prestationsMedicales && product.prestationsMedicales.length > 0 && (
                            <View style={styles.prestationsContainer}>
                                <Text style={styles.prestationLabel}>Prestations disponibles:</Text>
                                <View style={styles.tagsContainer}>
                                    {product.prestationsMedicales.slice(0, 4).map((prestation: string, idx: number) => (
                                        <View key={idx} style={styles.tag}>
                                            <Text style={styles.tagText}>{prestation}</Text>
                                        </View>
                                    ))}
                                    {product.prestationsMedicales.length > 4 && (
                                        <View style={styles.tag}>
                                            <Text style={styles.tagText}>+{product.prestationsMedicales.length - 4}</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* Planning simplifié */}
                        {product.planningHebdomadaire && Object.keys(product.planningHebdomadaire).length > 0 && (
                            <View style={styles.planningPreview}>
                                <SafeIcon name="clock" size={14} color="#6B7280" />
                                <Text style={styles.detailText}>
                                    Horaires: {(Object.values(product.planningHebdomadaire)[0] as any)?.permanent
                                        ? '24h/24'
                                        : `${(Object.values(product.planningHebdomadaire)[0] as any)?.debut || '08:00'}-${(Object.values(product.planningHebdomadaire)[0] as any)?.fin || '18:00'}`}
                                </Text>
                            </View>
                        )}

                        {/* RDV en ligne */}
                        {product.rdvEnLigne && (
                            <View style={[styles.detailChip, styles.successChip]}>
                                <SafeIcon name="calendar" size={14} color="#10B981" />
                                <Text style={[styles.detailText, styles.successText]}>RDV en ligne</Text>
                            </View>
                        )}
                    </View>
                );

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

            case 'covoiturage':
                return (
                    <View style={styles.detailsGrid}>
                        {product.pointDepart && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="map-pin" size={14} color="#EC4899" />
                                <Text style={styles.detailText}>De: {product.pointDepart}</Text>
                            </View>
                        )}
                        {product.pointArrivee && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="flag" size={14} color="#EC4899" />
                                <Text style={styles.detailText}>À: {product.pointArrivee}</Text>
                            </View>
                        )}
                        {product.nbPlacesDisponibles && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="users" size={14} color="#6B7280" />
                                <Text style={styles.detailText}>{product.nbPlacesDisponibles} places</Text>
                            </View>
                        )}
                    </View>
                );

            case 'mobilier':
                return (
                    <View style={styles.detailsGrid}>
                        {product.typeMobilier && (
                            <View style={styles.detailChip}>
                                <Text style={styles.detailText}>🪑 {product.typeMobilier}</Text>
                            </View>
                        )}
                        {product.materiau && (
                            <View style={styles.detailChip}>
                                <Text style={styles.detailText}>📦 {product.materiau}</Text>
                            </View>
                        )}
                        {product.dimensions && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="maximize-2" size={14} color="#6B7280" />
                                <Text style={styles.detailText}>{product.dimensions}</Text>
                            </View>
                        )}
                    </View>
                );

            case 'aliments':
                return (
                    <View style={styles.detailsGrid}>
                        {product.categorieAliment && (
                            <View style={styles.detailChip}>
                                <Text style={styles.detailText}>🍕 {product.categorieAliment}</Text>
                            </View>
                        )}
                        {product.origine && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="globe" size={14} color="#6B7280" />
                                <Text style={styles.detailText}>{product.origine}</Text>
                            </View>
                        )}
                        {product.certification && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="award" size={14} color="#10B981" />
                                <Text style={styles.detailText}>{product.certification}</Text>
                            </View>
                        )}
                    </View>
                );

            case 'livres_fournitures':
                return (
                    <View style={styles.detailsGrid}>
                        {product.categorieLivre && (
                            <View style={styles.detailChip}>
                                <Text style={styles.detailText}>📚 {product.categorieLivre}</Text>
                            </View>
                        )}
                        {product.niveau && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="book-open" size={14} color="#6366F1" />
                                <Text style={styles.detailText}>{product.niveau}</Text>
                            </View>
                        )}
                        {product.matiereScolaire && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="file-text" size={14} color="#6B7280" />
                                <Text style={styles.detailText}>{product.matiereScolaire}</Text>
                            </View>
                        )}
                    </View>
                );

            case 'quincaillerie':
                return (
                    <View style={styles.detailsGrid}>
                        {product.categorieQuincaillerie && (
                            <View style={styles.detailChip}>
                                <Text style={styles.detailText}>🔧 {product.categorieQuincaillerie}</Text>
                            </View>
                        )}
                        {product.marqueQuincaillerie && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="tag" size={14} color="#6B7280" />
                                <Text style={styles.detailText}>{product.marqueQuincaillerie}</Text>
                            </View>
                        )}
                        {product.unite && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="package" size={14} color="#6B7280" />
                                <Text style={styles.detailText}>Unité: {product.unite}</Text>
                            </View>
                        )}
                    </View>
                );

            case 'image_son':
                return (
                    <View style={styles.detailsGrid}>
                        {product.marqueImageSon && (
                            <View style={styles.detailChip}>
                                <Text style={styles.detailText}>🏷️ {product.marqueImageSon}</Text>
                            </View>
                        )}
                        {product.typeImageSon && (
                            <View style={styles.detailChip}>
                                <Text style={styles.detailText}>📺 {product.typeImageSon}</Text>
                            </View>
                        )}
                        {product.diagonaleEcran && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="maximize-2" size={14} color="#6B7280" />
                                <Text style={styles.detailText}>{product.diagonaleEcran}"</Text>
                            </View>
                        )}
                        {product.resolution && (
                            <View style={styles.detailChip}>
                                <Text style={styles.detailText}>🎬 {product.resolution}</Text>
                            </View>
                        )}
                    </View>
                );

            case 'telephone':
                return (
                    <View style={styles.detailsGrid}>
                        {product.marqueTelephone && (
                            <View style={styles.detailChip}>
                                <Text style={styles.detailText}>🏷️ {product.marqueTelephone}</Text>
                            </View>
                        )}
                        {product.modeleTelephone && (
                            <View style={styles.detailChip}>
                                <Text style={styles.detailText}>📱 {product.modeleTelephone}</Text>
                            </View>
                        )}
                        {product.stockage && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="hard-drive" size={14} color="#6B7280" />
                                <Text style={styles.detailText}>{product.stockage}</Text>
                            </View>
                        )}
                        {product.ram && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="cpu" size={14} color="#6B7280" />
                                <Text style={styles.detailText}>RAM: {product.ram}</Text>
                            </View>
                        )}
                    </View>
                );

            case 'ordinateur':
                return (
                    <View style={styles.detailsGrid}>
                        {product.marqueOrdinateur && (
                            <View style={styles.detailChip}>
                                <Text style={styles.detailText}>🏷️ {product.marqueOrdinateur}</Text>
                            </View>
                        )}
                        {product.processeur && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="cpu" size={14} color="#6B7280" />
                                <Text style={styles.detailText}>{product.processeur}</Text>
                            </View>
                        )}
                        {product.ramOrdinateur && (
                            <View style={styles.detailChip}>
                                <Text style={styles.detailText}>RAM: {product.ramOrdinateur}</Text>
                            </View>
                        )}
                        {product.stockageOrdinateur && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="hard-drive" size={14} color="#6B7280" />
                                <Text style={styles.detailText}>{product.stockageOrdinateur}</Text>
                            </View>
                        )}
                    </View>
                );

            case 'decoration':
                return (
                    <View style={styles.detailsGrid}>
                        {product.typeDecoration && (
                            <View style={styles.detailChip}>
                                <Text style={styles.detailText}>🖼️ {product.typeDecoration}</Text>
                            </View>
                        )}
                        {product.style && (
                            <View style={styles.detailChip}>
                                <Text style={styles.detailText}>✨ {product.style}</Text>
                            </View>
                        )}
                        {product.couleurDecoration && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="droplet" size={14} color="#6B7280" />
                                <Text style={styles.detailText}>{product.couleurDecoration}</Text>
                            </View>
                        )}
                    </View>
                );

            case 'ustensiles_cuisine':
                return (
                    <View style={styles.detailsGrid}>
                        {product.typeUstensile && (
                            <View style={styles.detailChip}>
                                <Text style={styles.detailText}>🍴 {product.typeUstensile}</Text>
                            </View>
                        )}
                        {product.materiauUstensile && (
                            <View style={styles.detailChip}>
                                <Text style={styles.detailText}>📦 {product.materiauUstensile}</Text>
                            </View>
                        )}
                        {product.marqueUstensile && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="tag" size={14} color="#6B7280" />
                                <Text style={styles.detailText}>{product.marqueUstensile}</Text>
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

            case 'prestation_service':
                return (
                    <View style={styles.prestationsContainer}>
                        {product.prestations && product.prestations.length > 0 ? (
                            <>
                                <Text style={styles.prestationsSectionTitle}>🎯 Offres de service :</Text>
                                {product.prestations.map((prestation, index) => (
                                    <View key={index} style={styles.prestationItem}>
                                        <View style={styles.prestationHeader}>
                                            <SafeIcon name="check-circle" size={16} color="#8B5CF6" />
                                            <Text style={styles.prestationName}>{prestation.nom}</Text>
                                        </View>
                                        {prestation.prixAPartirDe && (
                                            <Text style={styles.prestationPrice}>
                                                Montant minimum : {parseFloat(prestation.prixAPartirDe).toLocaleString()} FCFA
                                            </Text>
                                        )}
                                        {prestation.description && (
                                            <Text style={styles.prestationDescription} numberOfLines={2}>
                                                {prestation.description}
                                            </Text>
                                        )}
                                    </View>
                                ))}
                            </>
                        ) : (
                            <View style={styles.detailChip}>
                                <SafeIcon name="briefcase" size={14} color="#8B5CF6" />
                                <Text style={styles.detailText}>Prestation de service</Text>
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

                        <View style={styles.detailsGrid}>
                            {/* Volume */}
                            {product.volumeEstime && (
                                <View style={styles.detailChip}>
                                    <SafeIcon name="package" size={14} color="#6B7280" />
                                    <Text style={styles.detailText}>{product.volumeEstime} m³</Text>
                                </View>
                            )}

                            {/* Véhicule */}
                            {product.typeVehicule && (
                                <View style={styles.detailChip}>
                                    <Text style={styles.detailText}>🚚 {product.typeVehicule}</Text>
                                </View>
                            )}

                            {/* Déménageurs */}
                            {product.nbDemenageurs && (
                                <View style={styles.detailChip}>
                                    <SafeIcon name="users" size={14} color="#6B7280" />
                                    <Text style={styles.detailText}>{product.nbDemenageurs} personnes</Text>
                                </View>
                            )}

                            {/* Distance */}
                            {product.distanceKm && (
                                <View style={styles.detailChip}>
                                    <SafeIcon name="map" size={14} color="#6B7280" />
                                    <Text style={styles.detailText}>Max {product.distanceKm} km</Text>
                                </View>
                            )}
                        </View>

                        {/* Services inclus */}
                        {(product.assuranceMarchandise || product.serviceManutention || product.montageDemontage ||
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
                        {/* Type de cosmétique */}
                        {product.typeCosmetique && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="sparkle" size={14} color="#EC4899" />
                                <Text style={styles.detailText}>{product.typeCosmetique}</Text>
                            </View>
                        )}

                        <View style={styles.detailsGrid}>
                            {/* Marque */}
                            {product.marqueCosmetique && (
                                <View style={styles.detailChip}>
                                    <Text style={styles.detailText}>🏷️ {product.marqueCosmetique}</Text>
                                </View>
                            )}

                            {/* Volume */}
                            {product.volumeCosmetique && product.uniteCosmetique && (
                                <View style={styles.detailChip}>
                                    <SafeIcon name="droplet" size={14} color="#6B7280" />
                                    <Text style={styles.detailText}>{product.volumeCosmetique} {product.uniteCosmetique}</Text>
                                </View>
                            )}

                            {/* Type de peau */}
                            {product.typePeau && (
                                <View style={styles.detailChip}>
                                    <SafeIcon name="user" size={14} color="#6B7280" />
                                    <Text style={styles.detailText}>Peau: {product.typePeau}</Text>
                                </View>
                            )}

                            {/* Âge recommandé */}
                            {product.ageRecommandé && (
                                <View style={styles.detailChip}>
                                    <SafeIcon name="calendar" size={14} color="#6B7280" />
                                    <Text style={styles.detailText}>Âge: {product.ageRecommandé}</Text>
                                </View>
                            )}
                        </View>

                        {/* Origine */}
                        {product.origineCosmetique && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="globe" size={14} color="#10B981" />
                                <Text style={styles.detailText}>Origine: {product.origineCosmetique}</Text>
                            </View>
                        )}

                        {/* Ingrédients */}
                        {product.ingredientsCosmetique && (
                            <View style={styles.ingredientsContainer}>
                                <Text style={styles.prestationLabel}>Ingrédients:</Text>
                                <Text style={styles.ingredientsText} numberOfLines={2}>
                                    {product.ingredientsCosmetique}
                                </Text>
                            </View>
                        )}
                    </View>
                );

            case 'bijoux':
                return (
                    <View style={styles.detailsSection}>
                        {/* Type de bijou */}
                        {product.typeBijou && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="gem" size={14} color="#F59E0B" />
                                <Text style={styles.detailText}>{product.typeBijou}</Text>
                            </View>
                        )}

                        <View style={styles.detailsGrid}>
                            {/* Matière */}
                            {product.matiereBijou && (
                                <View style={styles.detailChip}>
                                    <Text style={styles.detailText}>💎 {product.matiereBijou}</Text>
                                </View>
                            )}

                            {/* Poids */}
                            {product.poidsBijou && product.unitePoids && (
                                <View style={styles.detailChip}>
                                    <SafeIcon name="scale" size={14} color="#6B7280" />
                                    <Text style={styles.detailText}>{product.poidsBijou} {product.unitePoids}</Text>
                                </View>
                            )}

                            {/* Taille */}
                            {product.tailleBijou && (
                                <View style={styles.detailChip}>
                                    <SafeIcon name="maximize" size={14} color="#6B7280" />
                                    <Text style={styles.detailText}>Taille: {product.tailleBijou}</Text>
                                </View>
                            )}

                            {/* Style */}
                            {product.styleBijou && (
                                <View style={styles.detailChip}>
                                    <Text style={styles.detailText}>✨ {product.styleBijou}</Text>
                                </View>
                            )}
                        </View>

                        {/* Origine */}
                        {product.origineBijou && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="globe" size={14} color="#10B981" />
                                <Text style={styles.detailText}>Origine: {product.origineBijou}</Text>
                            </View>
                        )}

                        {/* Certificat */}
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
                {/* Image principale avec vidéo overlay */}
                <View style={styles.imageContainer}>
                    {mainImage ? (
                        <Image source={{ uri: mainImage }} style={styles.mainImage} resizeMode="cover" />
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

                    {/* GPS et distance */}
                    {displayGPS && (
                        <View style={styles.locationContainer}>
                            <SafeIcon name="map-pin" size={14} color="#EF4444" />
                            <Text style={styles.locationText} numberOfLines={1}>
                                {product.quartier || product.ville || 'Localisation disponible'}
                            </Text>
                            {product.distance && (
                                <Text style={styles.distanceText}>• {product.distance.toFixed(1)} km</Text>
                            )}
                        </View>
                    )}

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
                    {product.type === 'ticket_voyage' && product.seatMap && product.busConfiguration && onBookSeat && (
                        <TouchableOpacity
                            style={styles.bookSeatButton}
                            onPress={onBookSeat}
                        >
                            <SafeIcon name="grid" size={20} color="#FFFFFF" />
                            <Text style={styles.bookSeatButtonText}>🎫 Réserver une place</Text>
                            {product.seatMap && (
                                <Text style={styles.bookSeatSubtext}>
                                    {product.seatMap.filter(s => s.status === 'available').length} places disponibles
                                </Text>
                            )}
                        </TouchableOpacity>
                    )}

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
                                onPress={() => {
                                    // TODO: Implémenter partage
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
        marginLeft: 8,
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
});

export default ProductCard;

