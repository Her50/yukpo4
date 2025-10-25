import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { Alert, Dimensions, Image, Linking, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getCategoryConfig, getCategoryStyle, getCategoryTerminology } from '../config/categoryConfig';
import { formatPrestationPlanning, getPharmacyStatus, hasEmergencyAvailable, isPharmacyOpenNow } from '../utils/healthServiceHelpers';
import { getDepartureWarning, isTicketStillValid } from '../utils/ticketValidation';
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
                                    {product.capacitePersonnes && (
                                        <View style={styles.immoLocationCourteTag}>
                                            <SafeIcon name="users" size={12} color="#059669" />
                                            <Text style={styles.immoLocationCourteText}>{product.capacitePersonnes} pers.</Text>
                                        </View>
                                    )}
                                    {product.dureeMinimum && (
                                        <View style={styles.immoLocationCourteTag}>
                                            <SafeIcon name="clock" size={12} color="#059669" />
                                            <Text style={styles.immoLocationCourteText}>Min: {product.dureeMinimum}</Text>
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
                                <Text style={styles.terrainReseauxTitle}>Réseaux disponibles:</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                                    {product.reseauxTerrain.map((reseau, idx) => (
                                        <View key={idx} style={styles.terrainReseauTag}>
                                            <Text style={styles.terrainReseauText}>{reseau}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}

                        {/* Badges juridiques */}
                        {(product.bornage || product.constructibilite || product.cloture) && (
                            <View style={styles.terrainJuridiqueContainer}>
                                {product.bornage && (
                                    <View style={styles.terrainJuridiqueBadge}>
                                        <SafeIcon name="square-dashed" size={12} color="#059669" />
                                        <Text style={styles.terrainJuridiqueText}>Borné</Text>
                                    </View>
                                )}
                                {product.constructibilite && (
                                    <View style={styles.terrainJuridiqueBadge}>
                                        <SafeIcon name="hammer" size={12} color="#059669" />
                                        <Text style={styles.terrainJuridiqueText}>Constructible</Text>
                                    </View>
                                )}
                                {product.cloture && (
                                    <View style={styles.terrainJuridiqueBadge}>
                                        <SafeIcon name="fence" size={12} color="#059669" />
                                        <Text style={styles.terrainJuridiqueText}>Clôturé</Text>
                                    </View>
                                )}
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

                        {/* Specs */}
                        <View style={styles.textileSpecs}>
                            {product.taille && (
                                <View style={styles.textileSpecItem}>
                                    <SafeIcon name="maximize" size={14} color="#EC4899" />
                                    <Text style={styles.textileSpecLabel}>Taille: </Text>
                                    <Text style={styles.textileSpecText}>{product.taille}</Text>
                                </View>
                            )}
                            {product.couleurVetement && (
                                <View style={styles.textileSpecItem}>
                                    <SafeIcon name="droplet" size={14} color="#EC4899" />
                                    <Text style={styles.textileSpecLabel}>Couleur: </Text>
                                    <Text style={styles.textileSpecText}>{product.couleurVetement}</Text>
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

                        {/* Caractéristiques principales */}
                        <View style={styles.chaussureCaracs}>
                            {product.pointure && (
                                <View style={styles.chaussureCaracItem}>
                                    <Text style={styles.chaussureCaracLabel}>Pointure:</Text>
                                    <Text style={styles.chaussureCaracText}>{product.pointure}</Text>
                                </View>
                            )}
                            {product.couleurChaussure && (
                                <View style={styles.chaussureCaracItem}>
                                    <Text style={styles.chaussureCaracLabel}>Couleur:</Text>
                                    <Text style={styles.chaussureCaracText}>{product.couleurChaussure}</Text>
                                </View>
                            )}
                            {product.materiauChaussure && (
                                <View style={styles.chaussureCaracItem}>
                                    <Text style={styles.chaussureCaracLabel}>Matériau:</Text>
                                    <Text style={styles.chaussureCaracText}>{product.materiauChaussure}</Text>
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
                    if (gamme?.includes('Moyen')) return { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B' };
                    if (gamme?.includes('Élevé')) return { bg: '#FED7AA', text: '#9A3412', border: '#F97316' };
                    if (gamme?.includes('Premium')) return { bg: '#F3E8FF', text: '#6B21A8', border: '#A855F7' };
                    return { bg: '#F3F4F6', text: '#374151', border: '#9CA3AF' };
                };

                const gammePrixColor = product.gammePrix ? getGammePrixColor(product.gammePrix) : null;

                return (
                    <View style={{ gap: 12 }}>
                        {/* Badges principaux */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
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
                            {product.livraison && (
                                <View style={styles.restaurantServiceBadge}>
                                    <Text style={styles.restaurantServiceText}>🚚 Livraison</Text>
                                </View>
                            )}
                            {product.terrasse && (
                                <View style={styles.restaurantServiceBadge}>
                                    <Text style={styles.restaurantServiceText}>☀️ Terrasse</Text>
                                </View>
                            )}
                        </View>

                        {/* Identité */}
                        {(product.typeRestaurant || product.typeCuisine) && (
                            <View style={styles.restaurantIdentity}>
                                <Text style={styles.restaurantIdentityText}>
                                    {product.typeRestaurant || 'Restaurant'} {product.typeCuisine ? `• ${product.typeCuisine}` : ''}
                                </Text>
                            </View>
                        )}

                        {/* Spécialités */}
                        {product.specialites && Array.isArray(product.specialites) && product.specialites.length > 0 && (
                            <View style={styles.restaurantSpecialites}>
                                <Text style={styles.restaurantSpecialitesTitle}>Spécialités :</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                                    {product.specialites.slice(0, 4).map((spec, idx) => (
                                        <View key={idx} style={styles.restaurantSpecTag}>
                                            <Text style={styles.restaurantSpecText}>{spec}</Text>
                                        </View>
                                    ))}
                                    {product.specialites.length > 4 && (
                                        <View style={styles.restaurantSpecTag}>
                                            <Text style={styles.restaurantSpecText}>+{product.specialites.length - 4}</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* Informations */}
                        <View style={styles.restaurantInfo}>
                            {product.horairesRestaurant && (
                                <View style={styles.restaurantInfoItem}>
                                    <SafeIcon name="clock" size={14} color="#F97316" />
                                    <Text style={styles.restaurantInfoText}>{product.horairesRestaurant}</Text>
                                </View>
                            )}
                            {product.capaciteRestaurant && (
                                <View style={styles.restaurantInfoItem}>
                                    <SafeIcon name="users" size={14} color="#F97316" />
                                    <Text style={styles.restaurantInfoText}>{product.capaciteRestaurant} couverts</Text>
                                </View>
                            )}
                            {product.ambiance && (
                                <View style={styles.restaurantInfoItem}>
                                    <SafeIcon name="music" size={14} color="#F97316" />
                                    <Text style={styles.restaurantInfoText}>{product.ambiance}</Text>
                                </View>
                            )}
                        </View>

                        {/* Services */}
                        {product.servicesRestau && Array.isArray(product.servicesRestau) && product.servicesRestau.length > 0 && (
                            <View style={styles.restaurantServices}>
                                {product.servicesRestau.map((service, idx) => (
                                    <View key={idx} style={styles.restaurantServiceTag}>
                                        <Text style={styles.restaurantServiceTagText}>{service}</Text>
                                    </View>
                                ))}
                            </View>
                        )}

                        {/* Régimes spéciaux */}
                        {product.regimesSpeciaux && Array.isArray(product.regimesSpeciaux) && product.regimesSpeciaux.length > 0 && (
                            <View style={styles.restaurantRegimes}>
                                {product.regimesSpeciaux.map((regime, idx) => (
                                    <View key={idx} style={styles.restaurantRegimeTag}>
                                        <Text style={styles.restaurantRegimeText}>
                                            {regime === 'Halal' && '☪️ '}
                                            {regime === 'Vegan' && '🌱 '}
                                            {regime === 'Végétarien' && '🥗 '}
                                            {regime === 'Sans gluten' && '🌾 '}
                                            {regime}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>
                );
            }

            case 'musique_instruments': {
                const getEtatColorMusique = (etat: string) => {
                    if (etat === 'Neuf') return { bg: '#D1FAE5', text: '#065F46', border: '#10B981' };
                    if (etat === 'Excellent') return { bg: '#E0E7FF', text: '#3730A3', border: '#6366F1' };
                    if (etat === 'Bon') return { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B' };
                    if (etat?.includes('réviser')) return { bg: '#FEE2E2', text: '#991B1B', border: '#EF4444' };
                    return { bg: '#F3F4F6', text: '#374151', border: '#9CA3AF' };
                };

                const etatColor = product.etatInstrument ? getEtatColorMusique(product.etatInstrument) : null;

                return (
                    <View style={{ gap: 12 }}>
                        {/* Badges principaux */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {product.etatInstrument && etatColor && (
                                <View style={[styles.musiqueBadge, { backgroundColor: etatColor.bg, borderColor: etatColor.border }]}>
                                    <Text style={[styles.musiqueBadgeText, { color: etatColor.text }]}>{product.etatInstrument}</Text>
                                </View>
                            )}
                            {product.marqueInstrument && (
                                <View style={styles.musiqueMarqueBadge}>
                                    <Text style={styles.musiqueMarqueText}>🏷️ {product.marqueInstrument}</Text>
                                </View>
                            )}
                            {product.typeAmplification && (
                                <View style={styles.musiqueTypeBadge}>
                                    <Text style={styles.musiqueTypeText}>{product.typeAmplification}</Text>
                                </View>
                            )}
                        </View>

                        {/* Identité */}
                        {(product.typeInstrument || product.modeleInstrument) && (
                            <View style={styles.musiqueIdentity}>
                                <Text style={styles.musiqueIdentityText}>
                                    🎸 {product.typeInstrument || 'Instrument'} {product.modeleInstrument ? `• ${product.modeleInstrument}` : ''}
                                </Text>
                            </View>
                        )}

                        {/* Caractéristiques */}
                        <View style={styles.musiqueCaracs}>
                            {product.nombreCordes && (
                                <View style={styles.musiqueCaracItem}>
                                    <SafeIcon name="activity" size={14} color="#9C27B0" />
                                    <Text style={styles.musiqueCaracLabel}>{product.nombreCordes} cordes</Text>
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
                            {product.anneeInstrument && (
                                <View style={styles.musiqueCaracItem}>
                                    <SafeIcon name="calendar" size={14} color="#9C27B0" />
                                    <Text style={styles.musiqueCaracLabel}>Année {product.anneeInstrument}</Text>
                                </View>
                            )}
                        </View>

                        {/* Badges de confiance */}
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

                        {/* Accessoires */}
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
                            {product.domaineActivite && (
                                <View style={styles.emploiDomaineBadge}>
                                    <Text style={styles.emploiDomaineText}>📂 {product.domaineActivite}</Text>
                                </View>
                            )}
                            {isTeletravail && (
                                <View style={styles.emploiTeletravailBadge}>
                                    <Text style={styles.emploiTeletravailText}>🏠 Télétravail</Text>
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
                    </View>
                );
            }

            case 'formation_education': {
                const getNiveauColor = (niveau: string) => {
                    if (niveau === 'Débutant') return { bg: '#DBEAFE', text: '#1E40AF', border: '#3B82F6' };
                    if (niveau === 'Intermédiaire') return { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B' };
                    if (niveau === 'Avancé') return { bg: '#FED7AA', text: '#9A3412', border: '#F97316' };
                    if (niveau === 'Expert' || niveau === 'Professionnel') return { bg: '#F3E8FF', text: '#6B21A8', border: '#A855F7' };
                    return { bg: '#F3F4F6', text: '#374151', border: '#9CA3AF' };
                };

                const niveauColor = product.niveauFormation ? getNiveauColor(product.niveauFormation) : null;

                return (
                    <View style={{ gap: 12 }}>
                        {/* Badges principaux */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {product.niveauFormation && niveauColor && (
                                <View style={[styles.formationNiveauBadge, { backgroundColor: niveauColor.bg, borderColor: niveauColor.border }]}>
                                    <Text style={[styles.formationNiveauText, { color: niveauColor.text }]}>{product.niveauFormation}</Text>
                                </View>
                            )}
                            {product.modeFormation && (
                                <View style={styles.formationModeBadge}>
                                    <Text style={styles.formationModeText}>
                                        {product.modeFormation === 'En ligne' && '💻 '}
                                        {product.modeFormation === 'Présentiel' && '🏫 '}
                                        {product.modeFormation === 'Hybride' && '🔄 '}
                                        {product.modeFormation}
                                    </Text>
                                </View>
                            )}
                            {product.certificationFormation && (
                                <View style={styles.formationCertifBadge}>
                                    <Text style={styles.formationCertifText}>📜 {product.certificationFormation}</Text>
                                </View>
                            )}
                        </View>

                        {/* Identité */}
                        {(product.domaineFormation || product.typeFormation) && (
                            <View style={styles.formationIdentity}>
                                <Text style={styles.formationIdentityText}>
                                    🎓 {product.domaineFormation || product.typeFormation || 'Formation'}
                                </Text>
                            </View>
                        )}

                        {/* Informations */}
                        <View style={styles.formationInfos}>
                            {product.dureeFormation && (
                                <View style={styles.formationInfoItem}>
                                    <SafeIcon name="clock" size={14} color="#7C3AED" />
                                    <Text style={styles.formationInfoLabel}>Durée: </Text>
                                    <Text style={styles.formationInfoText}>{product.dureeFormation}</Text>
                                </View>
                            )}
                            {product.formateurNom && (
                                <View style={styles.formationInfoItem}>
                                    <SafeIcon name="user" size={14} color="#7C3AED" />
                                    <Text style={styles.formationInfoLabel}>Formateur: </Text>
                                    <Text style={styles.formationInfoText}>{product.formateurNom}</Text>
                                </View>
                            )}
                            {product.langueEnseignement && (
                                <View style={styles.formationInfoItem}>
                                    <SafeIcon name="globe" size={14} color="#7C3AED" />
                                    <Text style={styles.formationInfoLabel}>Langue: </Text>
                                    <Text style={styles.formationInfoText}>{product.langueEnseignement}</Text>
                                </View>
                            )}
                        </View>

                        {/* Programme/Matières */}
                        {product.matieresFormation && Array.isArray(product.matieresFormation) && product.matieresFormation.length > 0 && (
                            <View style={styles.formationProgramme}>
                                <Text style={styles.formationProgrammeTitle}>Programme :</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                                    {product.matieresFormation.map((mat, idx) => (
                                        <View key={idx} style={styles.formationMatiereTag}>
                                            <Text style={styles.formationMatiereText}>{mat}</Text>
                                        </View>
                                    ))}
                                </View>
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
                        {product.services && Array.isArray(product.services) && product.services.length > 0 && (
                            <View style={styles.servicesContainer}>
                                <Text style={styles.prestationLabel}>Services disponibles:</Text>
                                <View style={styles.tagsContainer}>
                                    {product.services.map((service: string, idx: number) => (
                                        <View key={idx} style={styles.serviceTag}>
                                            <Text style={styles.serviceText}>{service}</Text>
                                        </View>
                                    ))}
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
                    if (etat === 'Neuf') return { bg: '#D1FAE5', text: '#065F46', border: '#10B981' };
                    if (etat === 'Excellent état') return { bg: '#DBEAFE', text: '#1E40AF', border: '#3B82F6' };
                    if (etat === 'Bon état') return { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B' };
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

            case 'aliments':
            case 'agroalimentaire': {
                const getStockLevel = (stock: number) => {
                    if (stock > 50) return { label: 'En stock', color: '#10B981' };
                    if (stock > 10) return { label: 'Stock limité', color: '#F59E0B' };
                    if (stock > 0) return { label: 'Dernières unités', color: '#EF4444' };
                    return { label: 'Rupture', color: '#DC2626' };
                };

                const stockInfo = product.stockDisponible !== undefined ? getStockLevel(product.stockDisponible) : null;
                const prixUnitaire = product.prix && product.poids ? (parseFloat(product.prix) / parseFloat(product.poids)).toFixed(0) : null;

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
                                🍎 {product.categorieAliment || 'Aliment'} {product.origine ? `• ${product.origine}` : ''}
                            </Text>
                        </View>

                        {/* Quantité et Prix */}
                        <View style={styles.alimentQuantite}>
                            {product.poids && product.uniteMesure && (
                                <View style={styles.alimentQuantiteItem}>
                                    <SafeIcon name="weight" size={14} color="#84CC16" />
                                    <Text style={styles.alimentQuantiteText}>{product.poids} {product.uniteMesure}</Text>
                                </View>
                            )}
                            {prixUnitaire && product.uniteMesure && (
                                <View style={styles.alimentQuantiteItem}>
                                    <SafeIcon name="trending-up" size={14} color="#84CC16" />
                                    <Text style={styles.alimentQuantiteText}>{prixUnitaire} XAF/{product.uniteMesure}</Text>
                                </View>
                            )}
                            {product.conditionnement && (
                                <View style={styles.alimentQuantiteItem}>
                                    <SafeIcon name="box" size={14} color="#84CC16" />
                                    <Text style={styles.alimentQuantiteText}>{product.conditionnement}</Text>
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
                        {product.allergenes && (
                            <View style={styles.alimentAllergenes}>
                                <Text style={styles.alimentAllergenesText}>⚠️ Allergènes: {product.allergenes}</Text>
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

                        {/* ISBN si disponible */}
                        {product.isbn && (
                            <View style={styles.livreIsbnBadge}>
                                <Text style={styles.livreIsbnText}>ISBN: {product.isbn}</Text>
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
                        {product.typeDemenagement && (
                            <View style={styles.demenagementBadge}>
                                <Text style={styles.demenagementText}>📦 {product.typeDemenagement}</Text>
                            </View>
                        )}
                        {product.volumeDemenagement && (
                            <View style={styles.demenagementVolumeBadge}>
                                <Text style={styles.demenagementVolumeText}>📏 {product.volumeDemenagement}</Text>
                            </View>
                        )}
                        {product.servicesDemenagement && Array.isArray(product.servicesDemenagement) && product.servicesDemenagement.length > 0 && (
                            <View style={{ gap: 4 }}>
                                <Text style={{ fontSize: 11, fontWeight: '600', color: '#374151' }}>Services:</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                    {product.servicesDemenagement.slice(0, 4).map((service, idx) => (
                                        <Text key={idx} style={styles.demenagementServiceText}>✓ {service}</Text>
                                    ))}
                                </View>
                            </View>
                        )}
                        {product.typeVehiculeDemenagement && (
                            <Text style={styles.demenagementVehicule}>🚛 {product.typeVehiculeDemenagement}</Text>
                        )}
                    </View>
                );
            }

            case 'plomberie': {
                return (
                    <View style={{ gap: 12 }}>
                        {product.typePrestation && (
                            <View style={styles.plomberieBadge}>
                                <Text style={styles.plomberieText}>🔧 {product.typePrestation}</Text>
                            </View>
                        )}
                        {product.urgence && (
                            <View style={styles.plomberieUrgenceBadge}>
                                <Text style={styles.plomberieUrgenceText}>🚨 Urgence 24/7</Text>
                            </View>
                        )}
                        {product.specialitesPlomberie && Array.isArray(product.specialitesPlomberie) && product.specialitesPlomberie.length > 0 && (
                            <Text style={styles.plomberieSpecialites}>Spécialités: {product.specialitesPlomberie.slice(0, 3).join(', ')}</Text>
                        )}
                        {product.garantieTravaux && (
                            <Text style={styles.plomberieGarantie}>✓ Garantie {product.garantieTravaux}</Text>
                        )}
                    </View>
                );
            }

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

            case 'electricite': {
                return (
                    <View style={{ gap: 12 }}>
                        {product.typeElectrique && (
                            <View style={styles.electriciteBadge}>
                                <Text style={styles.electriciteText}>⚡ {product.typeElectrique}</Text>
                            </View>
                        )}
                        {product.marqueElectrique && (
                            <View style={styles.electriciteMarqueBadge}>
                                <Text style={styles.electriciteMarqueText}>🏷️ {product.marqueElectrique}</Text>
                            </View>
                        )}
                        {product.caracteristiques && (
                            <Text style={styles.electriciteCarac}>{product.caracteristiques}</Text>
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
                        {product.etatImageSon && (
                            <View style={[styles.imageSonBadge, { backgroundColor: etatColors.bg, borderColor: etatColors.border }]}>
                                <Text style={[styles.imageSonBadgeText, { color: etatColors.text }]}>{product.etatImageSon}</Text>
                            </View>
                        )}
                        {product.marqueImageSon && (
                            <View style={styles.imageSonMarqueBadge}>
                                <Text style={styles.imageSonMarqueText}>🏷️ {product.marqueImageSon}</Text>
                            </View>
                        )}
                        {product.typeImageSon && (
                            <Text style={styles.imageSonType}>📺 {product.typeImageSon}</Text>
                        )}
                        {product.diagonaleEcran && (
                            <Text style={styles.imageSonDiagonale}>📏 {product.diagonaleEcran}</Text>
                        )}
                        {product.garantieImageSon && (
                            <Text style={styles.imageSonGarantie}>✓ Garantie {product.garantieImageSon}</Text>
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
                        {product.typeDecoration && (
                            <View style={styles.decorationBadge}>
                                <Text style={styles.decorationText}>🖼️ {product.typeDecoration}</Text>
                            </View>
                        )}
                        {product.styleDecoration && (
                            <View style={styles.decorationStyleBadge}>
                                <Text style={styles.decorationStyleText}>{product.styleDecoration}</Text>
                            </View>
                        )}
                        {product.couleur && (
                            <Text style={styles.decorationCouleur}>🎨 {product.couleur}</Text>
                        )}
                        {product.materiau && (
                            <Text style={styles.decorationMateriau}>{product.materiau}</Text>
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
                    </View>
                );
            }

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

            case 'jouets_enfants': {
                return (
                    <View style={{ gap: 12 }}>
                        {product.typeJouet && (
                            <View style={styles.jouetBadge}>
                                <Text style={styles.jouetText}>🧸 {product.typeJouet}</Text>
                            </View>
                        )}
                        {product.ageJouet && (
                            <View style={styles.jouetAgeBadge}>
                                <Text style={styles.jouetAgeText}>🎂 {product.ageJouet}</Text>
                            </View>
                        )}
                        {product.etatJouet && (
                            <Text style={styles.jouetEtat}>État: {product.etatJouet}</Text>
                        )}
                        {product.normeSecurite && (
                            <Text style={styles.jouetNorme}>✓ Norme CE</Text>
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
                        {product.typeBijou && (
                            <View style={styles.bijouxBadge}>
                                <Text style={styles.bijouxText}>💍 {product.typeBijou}</Text>
                            </View>
                        )}
                        {product.materiauBijou && (
                            <View style={styles.bijouxMateriauBadge}>
                                <Text style={styles.bijouxMateriauText}>{product.materiauBijou}</Text>
                            </View>
                        )}
                        {product.poidsBijou && (
                            <Text style={styles.bijouxPoids}>⚖️ {product.poidsBijou}</Text>
                        )}
                        {product.certificat && (
                            <Text style={styles.bijouxCertif}>✓ Certifié</Text>
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

    // ========== STYLES RESTAURATION ========== //
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
    restaurantRegimes: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
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
    assuranceCompagnieBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10,
        backgroundColor: '#DBEAFE',
        borderWidth: 1,
        borderColor: '#3B82F6',
    },
    assuranceCompagnieText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#1E40AF',
    },
    assuranceCouverture: {
        fontSize: 11,
        fontWeight: '500',
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
});

export default ProductCard;

