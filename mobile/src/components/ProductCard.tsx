// @ts-nocheck
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import SafeIcon from './SafeIcon';

const { width } = Dimensions.get('window');

interface ProductCardProps {
    product: any;
    service: any;
    prestataire?: any;
    onPress?: () => void;
    onChatPress?: () => void;
}

const ProductCard: React.FC<ProductCardProps> = ({
    product,
    service,
    prestataire,
    onPress,
    onChatPress
}) => {
    const [showAllImages, setShowAllImages] = useState(false);

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
            immobilier_batiment: { icon: 'home', color: '#3B82F6', bg: '#EFF6FF', label: 'Bâtiment' },
            immobilier_terrain: { icon: 'map', color: '#10B981', bg: '#D1FAE5', label: 'Terrain' },
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
            livres_fournitures: { icon: 'book', color: '#6366F1', bg: '#E0E7FF', label: 'Livre' },
            quincaillerie: { icon: 'tool', color: '#64748B', bg: '#F1F5F9', label: 'Quincaillerie' },
            pharmacie: { icon: 'activity', color: '#059669', bg: '#D1FAE5', label: 'Pharmacie' },
            hopital_clinique: { icon: 'heart', color: '#DC2626', bg: '#FEE2E2', label: 'Hôpital' },
            prestation_service: { icon: 'briefcase', color: '#8B5CF6', bg: '#F3E8FF', label: 'Service' },
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
                        {product.superficie && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="maximize-2" size={14} color="#6B7280" />
                                <Text style={styles.detailText}>{product.superficie} m²</Text>
                            </View>
                        )}
                        {product.nbPieces && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="grid" size={14} color="#6B7280" />
                                <Text style={styles.detailText}>{product.nbPieces} pièces</Text>
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
                    <View style={styles.detailsGrid}>
                        {product.specialites && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="heart" size={14} color="#DC2626" />
                                <Text style={styles.detailText}>{product.specialites}</Text>
                            </View>
                        )}
                        {product.urgences === 'oui' && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="alert-circle" size={14} color="#EF4444" />
                                <Text style={styles.detailText}>Urgences 24/7</Text>
                            </View>
                        )}
                        {product.medecinsDispo && (
                            <View style={styles.detailChip}>
                                <SafeIcon name="users" size={14} color="#6B7280" />
                                <Text style={styles.detailText}>{product.medecinsDispo}</Text>
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

            case 'prestation_service':
                return (
                    <View style={styles.detailsGrid}>
                        <View style={styles.detailChip}>
                            <SafeIcon name="briefcase" size={14} color="#8B5CF6" />
                            <Text style={styles.detailText}>Prestation de service</Text>
                        </View>
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

                    {/* Indicateur vidéo si présente */}
                    {hasVideo && (
                        <View style={styles.videoIndicator}>
                            <SafeIcon name="play-circle" size={20} color="#FFFFFF" />
                        </View>
                    )}

                    {/* Galerie miniature si plusieurs images */}
                    {images.length > 1 && (
                        <View style={styles.imageCountBadge}>
                            <SafeIcon name="image" size={12} color="#FFFFFF" />
                            <Text style={styles.imageCountText}>{images.length}</Text>
                        </View>
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

                    {/* Actions */}
                    <View style={styles.actions}>
                        <TouchableOpacity
                            style={styles.chatButton}
                            onPress={onChatPress}
                        >
                            <SafeIcon name="message-circle" size={18} color="#FFFFFF" />
                            <Text style={styles.chatButtonText}>Discuter</Text>
                        </TouchableOpacity>

                        <View style={styles.secondaryActions}>
                            <TouchableOpacity 
                                style={styles.actionIconButton}
                                onPress={() => {
                                    // TODO: Implémenter appel
                                }}
                            >
                                <SafeIcon name="phone" size={16} color="#10B981" />
                            </TouchableOpacity>

                            <TouchableOpacity 
                                style={styles.actionIconButton}
                                onPress={() => {
                                    // TODO: Implémenter partage
                                }}
                            >
                                <SafeIcon name="share-2" size={16} color="#3B82F6" />
                            </TouchableOpacity>

                            <TouchableOpacity 
                                style={styles.actionIconButton}
                                onPress={() => {
                                    // TODO: Implémenter notation/avis
                                }}
                            >
                                <SafeIcon name="star" size={16} color="#F59E0B" />
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
});

export default ProductCard;

