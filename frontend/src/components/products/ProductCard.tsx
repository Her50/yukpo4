import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/buttons/Button';
import { Card, CardContent } from '@/components/ui/card';
import { productDeliveryService } from '@/services/productDeliveryService';
import {
    Activity,
    Calendar,
    Droplet,
    Grid,
    Image as ImageIcon,
    MapPin,
    Maximize2,
    MessageCircle,
    Phone,
    PlayCircle,
    Tag,
    Truck,
    User
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import OrderDeliveryModal from '../delivery/OrderDeliveryModal';
import { CancellationBadgeAbsolute, DeliveryBadge } from './DeliveryBadge';

interface ProductCardProps {
    product: any;
    service: any;
    prestataire?: any;
    onChatPress?: () => void;
    onCallPress?: () => void;
    onGalleryPress?: () => void;
}

const ProductCard: React.FC<ProductCardProps> = ({
    product,
    service,
    prestataire,
    onChatPress,
    onCallPress,
    onGalleryPress
}) => {
    const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
    const [showOrderModal, setShowOrderModal] = useState(false);
    const [deliveryConfig, setDeliveryConfig] = useState<any>(null);
    const [selectedVariantIndex, setSelectedVariantIndex] = useState<number | null>(null);
    const autoScrollTimerRef = React.useRef<NodeJS.Timeout | null>(null);

    // ✅ PHASE 4: Gérer les produits depuis l'API (type Product) ou JSONB (fallback)
    // Si le produit vient de l'API, utiliser product.product_data pour les données
    const productData = product.product_data || product;

    // ✅ NOUVEAU 2026-01-04: Récupération des variants de prix
    const hasVariant = productData.has_variant || false;
    const variants = Array.isArray(productData.variants) ? productData.variants : [];
    const variantDimension = productData.variant_dimension || 'variante';

    // Récupérer la configuration de livraison
    useEffect(() => {
        const loadDeliveryConfig = async () => {
            // D'abord, vérifier si delivery_availability est déjà dans product (enrichi par backend)
            if (product.delivery_availability) {
                setDeliveryConfig(product.delivery_availability);
                return;
            }
            // ✅ PHASE 4: productData peut aussi avoir delivery_availability
            if (productData.delivery_availability) {
                setDeliveryConfig(productData.delivery_availability);
                return;
            }

            // Sinon, récupérer depuis l'API
            if (serviceId && productIndex !== undefined) {
                try {
                    const config = await productDeliveryService.getDeliveryConfig(serviceId, productIndex);
                    if (config) {
                        setDeliveryConfig(config);
                    }
                } catch (error) {
                    console.error('[ProductCard] Erreur chargement config livraison:', error);
                }
            }
        };

        loadDeliveryConfig();
    }, [product, productData, serviceId, productIndex]);

    const serviceId = service?.id;
    const productIndex = product.product_index ?? product.index ??
        (service?.data?.produits?.valeur ?
            service.data.produits.valeur.findIndex((p: any) => p === productData || p.nom === productData.nom) :
            undefined);
    const productName = productData.nom || productData.name || 'Produit';

    // ✅ Vérifier si c'est un produit (pas une prestation de service)
    // Par défaut, si le type n'est pas défini, on considère que c'est un produit
    const isProduct = productData.type !== 'prestation_service';

    // ✅ AMÉLIORATION: Extraire les images et vidéos avec support vidéo prioritaire (comme mobile)
    const images = productData.images || productData.imagesRealisations || [];
    const videos = productData.videos || productData.videosRealisations || [];
    // Vidéos en premier (comme mobile)
    const allMedia = [
        ...videos.map((v: string) => ({ type: 'video', uri: v })),
        ...images.map((i: string) => ({ type: 'image', uri: i }))
    ];
    const hasMedia = allMedia.length > 0;
    const hasVideo = videos.length > 0;

    // GPS prioritaire : produit > service gps_fixe > service gps
    const productGPS = productData.gps || productData.gpsFixe;
    const serviceGPS = service.data?.gps_fixe?.valeur || service.data?.gps_fixe || service.gps;
    const displayGPS = productGPS || serviceGPS;

    // ✅ NOUVEAU 2026-01-04: Calcul du prix d'affichage (minimum si variants, sinon prix unique)
    const displayPrice = hasVariant && variants.length > 0
        ? Math.min(...variants.map((v: any) => parseFloat(v.prix) || 0))
        : parseFloat(productData.prix) || 0;

    const devise = productData.devise || variants[0]?.devise || 'FCFA';

    // Formater le prix
    const formatPrice = () => {
        if (hasVariant && variants.length > 0) {
            return `À partir de ${displayPrice.toLocaleString()} ${devise}`;
        }
        if (!productData.prix) return null;
        return `${parseFloat(productData.prix).toLocaleString()} ${devise}`;
    };

    // Obtenir le style par type
    const getTypeStyle = () => {
        const styles = {
            immobilier_batiment: { icon: '🏢', color: 'bg-blue-50 text-blue-700 border-blue-200', label: 'Bâtiment' },
            immobilier_terrain: { icon: '🏞️', color: 'bg-green-50 text-green-700 border-green-200', label: 'Terrain' },
            automobile: { icon: '🚗', color: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Auto' },
            ticket_voyage: { icon: '🚌', color: 'bg-purple-50 text-purple-700 border-purple-200', label: 'Voyage' },
            covoiturage: { icon: '🚕', color: 'bg-pink-50 text-pink-700 border-pink-200', label: 'Covoiturage' },
            vetement: { icon: '👔', color: 'bg-red-50 text-red-700 border-red-200', label: 'Vêtement' },
            chaussure: { icon: '👟', color: 'bg-orange-50 text-orange-700 border-orange-200', label: 'Chaussure' },
            electromenager: { icon: '🔌', color: 'bg-teal-50 text-teal-700 border-teal-200', label: 'Électro' },
            image_son: { icon: '📺', color: 'bg-purple-50 text-purple-700 border-purple-200', label: 'Image/Son' },
            telephone: { icon: '📱', color: 'bg-orange-50 text-orange-700 border-orange-200', label: 'Téléphone' },
            ordinateur: { icon: '💻', color: 'bg-cyan-50 text-cyan-700 border-cyan-200', label: 'Ordinateur' },
            mobilier: { icon: '🪑', color: 'bg-orange-50 text-orange-700 border-orange-200', label: 'Mobilier' },
            decoration: { icon: '🖼️', color: 'bg-pink-50 text-pink-700 border-pink-200', label: 'Déco' },
            ustensiles_cuisine: { icon: '🍴', color: 'bg-red-50 text-red-700 border-red-200', label: 'Ustensiles' },
            aliments: { icon: '🍕', color: 'bg-yellow-50 text-yellow-700 border-yellow-200', label: 'Aliment' },
            livres_fournitures: { icon: '📚', color: 'bg-indigo-50 text-indigo-700 border-indigo-200', label: 'Livre' },
            quincaillerie: { icon: '🔧', color: 'bg-slate-50 text-slate-700 border-slate-200', label: 'Quincaillerie' },
            pharmacie: { icon: '💊', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Pharmacie' },
            hopital_clinique: { icon: '🏥', color: 'bg-red-50 text-red-700 border-red-200', label: 'Hôpital' },
            bien_etre_spa: { icon: '🧘', color: 'bg-teal-50 text-teal-700 border-teal-200', label: 'Spa' },
            prestation_service: { icon: '💼', color: 'bg-violet-50 text-violet-700 border-violet-200', label: 'Service' },
            demenagement: { icon: '🚚', color: 'bg-orange-50 text-orange-700 border-orange-200', label: 'Déménagement' },
            cosmetique_parfum: { icon: '✨', color: 'bg-pink-50 text-pink-700 border-pink-200', label: 'Cosmétique' },
            bijoux: { icon: '💎', color: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Bijoux' },
            autre: { icon: '📦', color: 'bg-gray-50 text-gray-700 border-gray-200', label: 'Produit' }
        };
        return styles[productData.type] || styles.autre;
    };

    const typeStyle = getTypeStyle();

    // ✅ AMÉLIORATION: Auto-scroll du carousel (comme mobile)
    useEffect(() => {
        if (allMedia.length <= 1) return;

        const startAutoScroll = () => {
            if (autoScrollTimerRef.current) {
                clearInterval(autoScrollTimerRef.current);
            }

            autoScrollTimerRef.current = setInterval(() => {
                setCurrentMediaIndex((prev) => {
                    const next = (prev + 1) % allMedia.length;
                    return next;
                });
            }, allMedia[currentMediaIndex]?.type === 'video' ? 8000 : 4000); // 8s pour vidéo, 4s pour image
        };

        startAutoScroll();
        return () => {
            if (autoScrollTimerRef.current) {
                clearInterval(autoScrollTimerRef.current);
            }
        };
    }, [allMedia.length, currentMediaIndex]);

    // Rendu spécialisé par type de produit
    const renderProductDetails = () => {
        switch (productData.type) {
            case 'immobilier_batiment':
            case 'immobilier_terrain':
                return (
                    <div className="flex flex-wrap gap-2 mt-2">
                        {productData.superficie && (
                            <Badge variant="secondary" className="text-xs">
                                <Maximize2 className="w-3 h-3 mr-1" />
                                {productData.superficie} m²
                            </Badge>
                        )}
                        {productData.nbPieces && (
                            <Badge variant="secondary" className="text-xs">
                                <Grid className="w-3 h-3 mr-1" />
                                {productData.nbPieces} pièces
                            </Badge>
                        )}
                        {productData.quartier && (
                            <Badge variant="secondary" className="text-xs">
                                <MapPin className="w-3 h-3 mr-1" />
                                {productData.quartier}
                            </Badge>
                        )}
                    </div>
                );

            case 'automobile':
                return (
                    <div className="flex flex-wrap gap-2 mt-2">
                        {productData.marque && (
                            <Badge variant="secondary" className="text-xs">
                                <Tag className="w-3 h-3 mr-1" />
                                {productData.marque}
                            </Badge>
                        )}
                        {productData.modele && (
                            <Badge variant="secondary" className="text-xs">
                                🚗 {productData.modele}
                            </Badge>
                        )}
                        {productData.annee && (
                            <Badge variant="secondary" className="text-xs">
                                <Calendar className="w-3 h-3 mr-1" />
                                {productData.annee}
                            </Badge>
                        )}
                        {productData.kilometrage && (
                            <Badge variant="secondary" className="text-xs">
                                <Activity className="w-3 h-3 mr-1" />
                                {productData.kilometrage} km
                            </Badge>
                        )}
                    </div>
                );

            case 'vetement':
            case 'chaussure':
                return (
                    <div className="flex flex-wrap gap-2 mt-2">
                        {productData.taille && (
                            <Badge variant="secondary" className="text-xs">
                                <Maximize2 className="w-3 h-3 mr-1" />
                                Taille {productData.taille}
                            </Badge>
                        )}
                        {productData.couleur && (
                            <Badge variant="secondary" className="text-xs">
                                <Droplet className="w-3 h-3 mr-1" />
                                {productData.couleur}
                            </Badge>
                        )}
                        {productData.marque && (
                            <Badge variant="secondary" className="text-xs">
                                <Tag className="w-3 h-3 mr-1" />
                                {productData.marque}
                            </Badge>
                        )}
                    </div>
                );

            case 'electromenager':
                return (
                    <div className="flex flex-wrap gap-2 mt-2">
                        {productData.marque && (
                            <Badge variant="secondary" className="text-xs">
                                <Tag className="w-3 h-3 mr-1" />
                                {productData.marque}
                            </Badge>
                        )}
                        {productData.modele && (
                            <Badge variant="secondary" className="text-xs">
                                📱 {productData.modele}
                            </Badge>
                        )}
                        {productData.etatProduit && (
                            <Badge variant="default" className="text-xs bg-green-50 text-green-700">
                                ✓ {productData.etatProduit}
                            </Badge>
                        )}
                    </div>
                );

            case 'pharmacie':
                return (
                    <div className="flex flex-wrap gap-2 mt-2">
                        {productData.typePharmacie && (
                            <Badge variant="default" className="text-xs bg-emerald-50 text-emerald-700">
                                🛡️ {productData.typePharmacie}
                            </Badge>
                        )}
                        {productData.joursGarde && (
                            <Badge variant="secondary" className="text-xs">
                                ⏰ Garde: {productData.joursGarde}
                            </Badge>
                        )}
                        {productData.telephoneUrgence && (
                            <Badge variant="default" className="text-xs bg-red-50 text-red-700">
                                <Phone className="w-3 h-3 mr-1" />
                                {productData.telephoneUrgence}
                            </Badge>
                        )}
                    </div>
                );

            case 'hopital_clinique':
                return (
                    <div className="flex flex-wrap gap-2 mt-2">
                        {productData.specialites && (
                            <Badge variant="default" className="text-xs bg-red-50 text-red-700">
                                ❤️ {productData.specialites}
                            </Badge>
                        )}
                        {productData.urgences === 'oui' && (
                            <Badge variant="default" className="text-xs bg-red-100 text-red-800">
                                🚨 Urgences 24/7
                            </Badge>
                        )}
                        {productData.medecinsDispo && (
                            <Badge variant="secondary" className="text-xs">
                                👨‍⚕️ {productData.medecinsDispo}
                            </Badge>
                        )}
                    </div>
                );

            case 'ticket_voyage':
                return (
                    <div className="flex flex-wrap gap-2 mt-2">
                        {productData.depart && (
                            <Badge variant="secondary" className="text-xs">
                                🚏 De: {productData.depart}
                            </Badge>
                        )}
                        {productData.destination && (
                            <Badge variant="secondary" className="text-xs">
                                🏁 À: {productData.destination}
                            </Badge>
                        )}
                        {productData.dateDepart && (
                            <Badge variant="secondary" className="text-xs">
                                📅 {productData.dateDepart}
                            </Badge>
                        )}
                        {productData.heureDepart && (
                            <Badge variant="secondary" className="text-xs">
                                ⏰ {productData.heureDepart}
                            </Badge>
                        )}
                    </div>
                );

            case 'covoiturage':
                return (
                    <div className="flex flex-wrap gap-2 mt-2">
                        {productData.pointDepart && (
                            <Badge variant="secondary" className="text-xs">
                                🚏 De: {productData.pointDepart}
                            </Badge>
                        )}
                        {productData.pointArrivee && (
                            <Badge variant="secondary" className="text-xs">
                                🏁 À: {productData.pointArrivee}
                            </Badge>
                        )}
                        {productData.nbPlacesDisponibles && (
                            <Badge variant="default" className="text-xs bg-pink-50 text-pink-700">
                                👥 {productData.nbPlacesDisponibles} places
                            </Badge>
                        )}
                    </div>
                );

            case 'mobilier':
                return (
                    <div className="flex flex-wrap gap-2 mt-2">
                        {productData.typeMobilier && (
                            <Badge variant="secondary" className="text-xs">
                                🪑 {productData.typeMobilier}
                            </Badge>
                        )}
                        {productData.materiau && (
                            <Badge variant="secondary" className="text-xs">
                                📦 {productData.materiau}
                            </Badge>
                        )}
                        {productData.dimensions && (
                            <Badge variant="secondary" className="text-xs">
                                📐 {productData.dimensions}
                            </Badge>
                        )}
                    </div>
                );

            case 'aliments':
                return (
                    <div className="flex flex-wrap gap-2 mt-2">
                        {productData.categorieAliment && (
                            <Badge variant="secondary" className="text-xs">
                                🍕 {productData.categorieAliment}
                            </Badge>
                        )}
                        {productData.origine && (
                            <Badge variant="secondary" className="text-xs">
                                🌍 {productData.origine}
                            </Badge>
                        )}
                        {productData.certification && (
                            <Badge variant="default" className="text-xs bg-green-50 text-green-700">
                                🏆 {productData.certification}
                            </Badge>
                        )}
                    </div>
                );

            case 'livres_fournitures':
                return (
                    <div className="flex flex-wrap gap-2 mt-2">
                        {productData.categorieLivre && (
                            <Badge variant="secondary" className="text-xs">
                                📚 {productData.categorieLivre}
                            </Badge>
                        )}
                        {productData.niveau && (
                            <Badge variant="default" className="text-xs bg-indigo-50 text-indigo-700">
                                🎓 {productData.niveau}
                            </Badge>
                        )}
                        {productData.matiereScolaire && (
                            <Badge variant="secondary" className="text-xs">
                                📝 {productData.matiereScolaire}
                            </Badge>
                        )}
                    </div>
                );

            case 'quincaillerie':
                return (
                    <div className="flex flex-wrap gap-2 mt-2">
                        {productData.categorieQuincaillerie && (
                            <Badge variant="secondary" className="text-xs">
                                🔧 {productData.categorieQuincaillerie}
                            </Badge>
                        )}
                        {productData.marqueQuincaillerie && (
                            <Badge variant="secondary" className="text-xs">
                                <Tag className="w-3 h-3 mr-1" />
                                {productData.marqueQuincaillerie}
                            </Badge>
                        )}
                        {productData.unite && (
                            <Badge variant="secondary" className="text-xs">
                                📦 Unité: {productData.unite}
                            </Badge>
                        )}
                    </div>
                );

            case 'image_son':
                return (
                    <div className="flex flex-wrap gap-2 mt-2">
                        {productData.marqueImageSon && (
                            <Badge variant="secondary" className="text-xs">
                                <Tag className="w-3 h-3 mr-1" />
                                {productData.marqueImageSon}
                            </Badge>
                        )}
                        {productData.typeImageSon && (
                            <Badge variant="secondary" className="text-xs">
                                📺 {productData.typeImageSon}
                            </Badge>
                        )}
                        {productData.diagonaleEcran && (
                            <Badge variant="secondary" className="text-xs">
                                📐 {productData.diagonaleEcran}"
                            </Badge>
                        )}
                        {productData.resolution && (
                            <Badge variant="default" className="text-xs bg-purple-50 text-purple-700">
                                🎬 {productData.resolution}
                            </Badge>
                        )}
                    </div>
                );

            case 'telephone':
                return (
                    <div className="flex flex-wrap gap-2 mt-2">
                        {productData.marqueTelephone && (
                            <Badge variant="secondary" className="text-xs">
                                <Tag className="w-3 h-3 mr-1" />
                                {productData.marqueTelephone}
                            </Badge>
                        )}
                        {productData.modeleTelephone && (
                            <Badge variant="secondary" className="text-xs">
                                📱 {productData.modeleTelephone}
                            </Badge>
                        )}
                        {productData.stockage && (
                            <Badge variant="default" className="text-xs bg-orange-50 text-orange-700">
                                💾 {productData.stockage}
                            </Badge>
                        )}
                        {productData.ram && (
                            <Badge variant="secondary" className="text-xs">
                                RAM: {productData.ram}
                            </Badge>
                        )}
                    </div>
                );

            case 'ordinateur':
                return (
                    <div className="flex flex-wrap gap-2 mt-2">
                        {productData.marqueOrdinateur && (
                            <Badge variant="secondary" className="text-xs">
                                <Tag className="w-3 h-3 mr-1" />
                                {productData.marqueOrdinateur}
                            </Badge>
                        )}
                        {productData.processeur && (
                            <Badge variant="default" className="text-xs bg-cyan-50 text-cyan-700">
                                🖥️ {productData.processeur}
                            </Badge>
                        )}
                        {productData.ramOrdinateur && (
                            <Badge variant="secondary" className="text-xs">
                                RAM: {productData.ramOrdinateur}
                            </Badge>
                        )}
                        {productData.stockageOrdinateur && (
                            <Badge variant="secondary" className="text-xs">
                                💾 {productData.stockageOrdinateur}
                            </Badge>
                        )}
                    </div>
                );

            case 'decoration':
                return (
                    <div className="flex flex-wrap gap-2 mt-2">
                        {productData.typeDecoration && (
                            <Badge variant="secondary" className="text-xs">
                                🖼️ {productData.typeDecoration}
                            </Badge>
                        )}
                        {productData.style && (
                            <Badge variant="default" className="text-xs bg-pink-50 text-pink-700">
                                ✨ {productData.style}
                            </Badge>
                        )}
                        {productData.couleurDecoration && (
                            <Badge variant="secondary" className="text-xs">
                                <Droplet className="w-3 h-3 mr-1" />
                                {productData.couleurDecoration}
                            </Badge>
                        )}
                    </div>
                );

            case 'ustensiles_cuisine':
                return (
                    <div className="flex flex-wrap gap-2 mt-2">
                        {productData.typeUstensile && (
                            <Badge variant="secondary" className="text-xs">
                                🍴 {productData.typeUstensile}
                            </Badge>
                        )}
                        {productData.materiauUstensile && (
                            <Badge variant="secondary" className="text-xs">
                                📦 {productData.materiauUstensile}
                            </Badge>
                        )}
                        {productData.marqueUstensile && (
                            <Badge variant="secondary" className="text-xs">
                                <Tag className="w-3 h-3 mr-1" />
                                {productData.marqueUstensile}
                            </Badge>
                        )}
                    </div>
                );

            case 'prestation_service':
                return (
                    <div className="flex flex-wrap gap-2 mt-2">
                        <Badge variant="default" className="text-xs bg-violet-50 text-violet-700">
                            💼 Prestation de service
                        </Badge>
                    </div>
                );

            case 'demenagement':
                return (
                    <div className="space-y-3 mt-2">
                        {/* Type de déménagement */}
                        {productData.typeDemenagement && (
                            <Badge variant="secondary" className="text-xs">
                                🚚 {productData.typeDemenagement}
                            </Badge>
                        )}

                        <div className="flex flex-wrap gap-2">
                            {/* Volume */}
                            {productData.volumeEstime && (
                                <Badge variant="secondary" className="text-xs">
                                    📦 {productData.volumeEstime} m³
                                </Badge>
                            )}

                            {/* Véhicule */}
                            {productData.typeVehicule && (
                                <Badge variant="secondary" className="text-xs">
                                    🚛 {productData.typeVehicule}
                                </Badge>
                            )}

                            {/* Déménageurs */}
                            {productData.nbDemenageurs && (
                                <Badge variant="secondary" className="text-xs">
                                    👥 {productData.nbDemenageurs} personnes
                                </Badge>
                            )}

                            {/* Distance */}
                            {productData.distanceKm && (
                                <Badge variant="secondary" className="text-xs">
                                    🗺️ Max {productData.distanceKm} km
                                </Badge>
                            )}
                        </div>

                        {/* Services inclus */}
                        {(productData.assuranceMarchandise || productData.serviceManutention || productData.montageDemontage ||
                            productData.emballageCartons || productData.gardeMeuble || productData.debarras) && (
                                <div className="mt-2">
                                    <p className="text-xs font-medium text-gray-600 mb-1">Services inclus:</p>
                                    <div className="flex flex-wrap gap-1">
                                        {productData.assuranceMarchandise && (
                                            <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                                ✓ Assurance
                                            </Badge>
                                        )}
                                        {productData.serviceManutention && (
                                            <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                                ✓ Manutention
                                            </Badge>
                                        )}
                                        {productData.montageDemontage && (
                                            <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                                ✓ Montage
                                            </Badge>
                                        )}
                                        {productData.emballageCartons && (
                                            <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                                ✓ Emballage
                                            </Badge>
                                        )}
                                        {productData.gardeMeuble && (
                                            <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                                ✓ Garde-meuble
                                            </Badge>
                                        )}
                                        {productData.debarras && (
                                            <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                                ✓ Débarras
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            )}
                    </div>
                );

            case 'cosmetique_parfum':
                return (
                    <div className="space-y-3 mt-2">
                        {/* Type de cosmétique */}
                        {productData.typeCosmetique && (
                            <Badge variant="secondary" className="text-xs">
                                ✨ {productData.typeCosmetique}
                            </Badge>
                        )}

                        <div className="flex flex-wrap gap-2">
                            {/* Marque */}
                            {productData.marqueCosmetique && (
                                <Badge variant="secondary" className="text-xs">
                                    🏷️ {productData.marqueCosmetique}
                                </Badge>
                            )}

                            {/* Volume */}
                            {productData.volumeCosmetique && productData.uniteCosmetique && (
                                <Badge variant="secondary" className="text-xs">
                                    <Droplet className="w-3 h-3 mr-1" />
                                    {productData.volumeCosmetique} {productData.uniteCosmetique}
                                </Badge>
                            )}

                            {/* Type de peau */}
                            {productData.typePeau && (
                                <Badge variant="secondary" className="text-xs">
                                    👤 Peau: {productData.typePeau}
                                </Badge>
                            )}

                            {/* Âge recommandé */}
                            {productData.ageRecommandé && (
                                <Badge variant="secondary" className="text-xs">
                                    <Calendar className="w-3 h-3 mr-1" />
                                    Âge: {productData.ageRecommandé}
                                </Badge>
                            )}
                        </div>

                        {/* Origine */}
                        {productData.origineCosmetique && (
                            <Badge variant="secondary" className="text-xs">
                                🌍 Origine: {productData.origineCosmetique}
                            </Badge>
                        )}

                        {/* Ingrédients */}
                        {productData.ingredientsCosmetique && (
                            <div className="mt-2">
                                <p className="text-xs font-medium text-gray-600 mb-1">Ingrédients:</p>
                                <p className="text-xs text-gray-500 italic line-clamp-2">
                                    {productData.ingredientsCosmetique}
                                </p>
                            </div>
                        )}
                    </div>
                );

            case 'bijoux':
                return (
                    <div className="space-y-3 mt-2">
                        {/* Type de bijou */}
                        {productData.typeBijou && (
                            <Badge variant="secondary" className="text-xs">
                                💎 {productData.typeBijou}
                            </Badge>
                        )}

                        <div className="flex flex-wrap gap-2">
                            {/* Matière */}
                            {productData.matiereBijou && (
                                <Badge variant="secondary" className="text-xs">
                                    💍 {productData.matiereBijou}
                                </Badge>
                            )}

                            {/* Poids */}
                            {productData.poidsBijou && productData.unitePoids && (
                                <Badge variant="secondary" className="text-xs">
                                    ⚖️ {productData.poidsBijou} {productData.unitePoids}
                                </Badge>
                            )}

                            {/* Taille */}
                            {productData.tailleBijou && (
                                <Badge variant="secondary" className="text-xs">
                                    <Maximize2 className="w-3 h-3 mr-1" />
                                    Taille: {productData.tailleBijou}
                                </Badge>
                            )}

                            {/* Style */}
                            {productData.styleBijou && (
                                <Badge variant="secondary" className="text-xs">
                                    ✨ {productData.styleBijou}
                                </Badge>
                            )}
                        </div>

                        {/* Origine */}
                        {productData.origineBijou && (
                            <Badge variant="secondary" className="text-xs">
                                🌍 Origine: {productData.origineBijou}
                            </Badge>
                        )}

                        {/* Certificat */}
                        {productData.certificatBijou && (
                            <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                🏆 Certifié: {productData.certificatBijou}
                            </Badge>
                        )}
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <Card className="overflow-hidden hover:shadow-xl transition-all duration-300 border-2 hover:border-blue-400">
            <div className="flex flex-col md:flex-row">
                {/* ✅ AMÉLIORATION: Section Image/Vidéo avec carousel automatique */}
                <div className="relative w-full md:w-2/5 h-64 md:h-auto overflow-hidden">
                    {/* Carousel automatique d'images et vidéos */}
                    {hasMedia ? (
                        <div className="relative w-full h-full">
                            {allMedia.map((media, index) => (
                                <div
                                    key={index}
                                    className={`absolute inset-0 transition-opacity duration-500 ${
                                        index === currentMediaIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'
                                    }`}
                                >
                                    {media.type === 'video' ? (
                                        <video
                                            src={media.uri}
                                            className="w-full h-full object-cover"
                                            autoPlay={index === currentMediaIndex}
                                            loop={false}
                                            muted
                                            playsInline
                                            onEnded={() => {
                                                // Passer à l'élément suivant après la fin de la vidéo
                                                setTimeout(() => {
                                                    setCurrentMediaIndex((prev) => (prev + 1) % allMedia.length);
                                                }, 500);
                                            }}
                                        />
                                    ) : (
                                        <img
                                            src={media.uri}
                                            alt={productData.nom || 'Produit'}
                                            className="w-full h-full object-cover"
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                            <ImageIcon className="w-16 h-16 text-gray-400" />
                        </div>
                    )}

                    {/* Badge type */}
                    <div className={`absolute top-3 left-3 flex items-center gap-1 px-3 py-1.5 rounded-lg border ${typeStyle.color} backdrop-blur-sm`}>
                        <span className="text-sm">{typeStyle.icon}</span>
                        <span className="text-xs font-semibold">{typeStyle.label}</span>
                    </div>

                    {/* ✅ Badge PROMOTION si produit en promotion */}
                    {(productData.en_promotion || productData.promotion_active) && (
                        <div className="absolute top-14 left-3 bg-gradient-to-r from-yellow-500 to-red-500 text-white px-3 py-1.5 rounded-lg backdrop-blur-sm shadow-lg flex items-center gap-1">
                            <span className="text-lg">⚡</span>
                            <span className="text-xs font-bold">PROMO</span>
                        </div>
                    )}

                    {/* ✅ AMÉLIORATION: Indicateurs de pagination (comme mobile) */}
                    {allMedia.length > 1 && (
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1 z-20">
                            {allMedia.map((_, index) => (
                                <div
                                    key={index}
                                    className={`w-2 h-2 rounded-full transition-all ${
                                        index === currentMediaIndex
                                            ? 'bg-white w-6'
                                            : 'bg-white bg-opacity-50'
                                    }`}
                                />
                            ))}
                        </div>
                    )}

                    {/* ✅ AMÉLIORATION: Badge nombre de médias cliquable (comme mobile) */}
                    {allMedia.length > 1 && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (onGalleryPress) onGalleryPress();
                            }}
                            className="absolute bottom-3 right-3 bg-black bg-opacity-70 hover:bg-opacity-90 px-2 py-1 rounded-lg flex items-center gap-1 transition-all z-20"
                        >
                            <ImageIcon className="w-3 h-3 text-white" />
                            <span className="text-xs text-white font-semibold">{allMedia.length}</span>
                        </button>
                    )}

                    {/* Indicateur vidéo si vidéo en cours */}
                    {allMedia[currentMediaIndex]?.type === 'video' && (
                        <div className="absolute top-3 right-3 bg-black bg-opacity-70 p-2 rounded-full z-20">
                            <PlayCircle className="w-5 h-5 text-white" />
                        </div>
                    )}

                    {/* Navigation manuelle si plusieurs médias */}
                    {allMedia.length > 1 && (
                        <>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setCurrentMediaIndex((prev) => (prev === 0 ? allMedia.length - 1 : prev - 1));
                                }}
                                className="absolute left-2 top-1/2 -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white p-2 rounded-full transition-all z-20"
                            >
                                ←
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setCurrentMediaIndex((prev) => (prev === allMedia.length - 1 ? 0 : prev + 1));
                                }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white p-2 rounded-full transition-all z-20"
                            >
                                →
                            </button>
                        </>
                    )}
                </div>

                {/* Section Informations */}
                <CardContent className="flex-1 p-6 relative">
                    {/* Badge taux d'annulation (position absolue en haut à gauche) */}
                    {deliveryConfig?.cancellation_rate !== undefined && (
                        <CancellationBadgeAbsolute cancellationRate={deliveryConfig.cancellation_rate} />
                    )}

                    {/* Nom du produit */}
                    <h3 className="text-xl font-bold text-gray-900 mb-2 line-clamp-2">
                        {productData.nom || productData.name || productData.titre || 'Produit'}
                    </h3>

                    {/* Badges de disponibilité */}
                    {deliveryConfig && (
                        <DeliveryBadge
                            deliveryConfig={{
                                is_immediately_available: deliveryConfig.is_immediately_available,
                                preparation_time_minutes: deliveryConfig.preparation_time_minutes,
                                availability_days: deliveryConfig.availability_days,
                                cancellation_rate: deliveryConfig.cancellation_rate,
                            }}
                        />
                    )}

                    {/* Description */}
                    {productData.description && (
                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                            {productData.description}
                        </p>
                    )}

                    {/* Détails spécifiques par type */}
                    {renderProductDetails()}

                    {/* ✅ NOUVEAU 2026-01-04: Affichage des variants de prix */}
                    {hasVariant && variants.length > 0 ? (
                        <div className="mt-3 mb-3">
                            {/* Titre de la section */}
                            <div className="flex items-center gap-2 mb-3">
                                <Tag className="w-4 h-4 text-gray-600" />
                                <h4 className="text-sm font-semibold text-gray-700">
                                    Prix selon {variantDimension}
                                </h4>
                            </div>

                            {/* Tableau des variants */}
                            <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden mb-3">
                                {/* En-tête du tableau */}
                                <div className="grid grid-cols-3 gap-2 bg-gray-100 px-3 py-2 border-b border-gray-200">
                                    <div className="text-xs font-semibold text-gray-700">Variante</div>
                                    <div className="text-xs font-semibold text-gray-700 text-center">Prix</div>
                                    <div className="text-xs font-semibold text-gray-700 text-right">Stock</div>
                                </div>

                                {/* Liste des variants (max 5 visibles) */}
                                <div className="divide-y divide-gray-200">
                                    {variants.slice(0, 5).map((variant: any, i: number) => {
                                        const isSelected = selectedVariantIndex === i;
                                        const stock = variant.stock || 0;
                                        const stockClass = stock > 5 
                                            ? 'bg-green-100 text-green-700 border-green-300' 
                                            : stock > 0 
                                                ? 'bg-yellow-100 text-yellow-700 border-yellow-300' 
                                                : 'bg-red-100 text-red-700 border-red-300';

                                        return (
                                            <div
                                                key={i}
                                                onClick={() => setSelectedVariantIndex(selectedVariantIndex === i ? null : i)}
                                                className={`grid grid-cols-3 gap-2 px-3 py-2 cursor-pointer transition-colors ${
                                                    isSelected ? 'bg-blue-50 border-l-2 border-blue-500' : 'hover:bg-gray-50'
                                                }`}
                                            >
                                                {/* Variante */}
                                                <div className="flex items-center gap-2 min-w-0">
                                                    {variant.image && (
                                                        <img
                                                            src={variant.image.startsWith('data:') 
                                                                ? variant.image 
                                                                : `data:image/jpeg;base64,${variant.image}`}
                                                            alt={variant.value || variant.valeur}
                                                            className="w-8 h-8 rounded object-cover"
                                                        />
                                                    )}
                                                    <span className="text-sm text-gray-900 truncate">
                                                        {variant.value || variant.valeur}
                                                    </span>
                                                </div>

                                                {/* Prix */}
                                                <div className="flex flex-col items-center justify-center">
                                                    <span className="text-sm font-semibold text-gray-900">
                                                        {parseFloat(variant.prix || 0).toLocaleString()}
                                                    </span>
                                                    <span className="text-xs text-gray-500">
                                                        {variant.devise || devise}
                                                    </span>
                                                </div>

                                                {/* Stock */}
                                                <div className="flex items-center justify-end">
                                                    <span className={`text-xs font-semibold px-2 py-1 rounded border ${stockClass}`}>
                                                        {stock > 0 ? stock : '0'}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Message si plus de 5 variants */}
                                {variants.length > 5 && (
                                    <div className="px-3 py-2 bg-gray-50 text-center border-t border-gray-200">
                                        <span className="text-xs text-gray-500">
                                            +{variants.length - 5} autre{variants.length - 5 > 1 ? 's' : ''} variante{variants.length - 5 > 1 ? 's' : ''}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Prix minimum */}
                            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2 rounded-lg shadow-md">
                                <Tag className="w-4 h-4" />
                                <span className="text-lg font-bold">{formatPrice()}</span>
                            </div>
                        </div>
                    ) : (
                        /* Prix unique (pas de variants) */
                        formatPrice() && (
                            <div className="mt-3 mb-3">
                                <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2 rounded-lg shadow-md">
                                    <Tag className="w-4 h-4" />
                                    <span className="text-lg font-bold">{formatPrice()}</span>
                                </div>
                            </div>
                        )
                    )}

                    {/* GPS et distance */}
                    {displayGPS && (
                        <div className="flex items-center gap-2 text-sm text-red-600 mb-3">
                            <MapPin className="w-4 h-4" />
                            <span className="font-medium">
                                {productData.quartier || productData.ville || 'Localisation disponible'}
                            </span>
                            {productData.distance && (
                                <span className="text-gray-500">• {productData.distance.toFixed(1)} km</span>
                            )}
                        </div>
                    )}

                    {/* Statistiques */}
                    <div className="flex items-center justify-around py-2 px-3 bg-gray-50 rounded-lg mb-3">
                        <div className="flex items-center gap-1.5">
                            <Activity className="w-4 h-4 text-gray-500" />
                            <span className="text-xs font-semibold text-gray-700">{productData.views || service.views || 0}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Tag className="w-4 h-4 text-gray-500" />
                            <span className="text-xs font-semibold text-gray-700">{productData.shares || 0}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="text-amber-500">⭐</span>
                            <span className="text-xs font-semibold text-gray-700">{productData.rating || service.rating || '—'}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <MessageCircle className="w-4 h-4 text-gray-500" />
                            <span className="text-xs font-semibold text-gray-700">{productData.reviews || 0}</span>
                        </div>
                    </div>

                    {/* Informations prestataire */}
                    {prestataire && (
                        <div className="flex items-center gap-3 py-3 border-t border-gray-200 mt-3">
                            <Avatar className="w-10 h-10">
                                <AvatarImage src={prestataire.avatar} alt={prestataire.name} />
                                <AvatarFallback>
                                    <User className="w-5 h-5" />
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                                <p className="text-sm font-semibold text-gray-900">{prestataire.name || 'Prestataire'}</p>
                                {prestataire.isOnline && (
                                    <div className="flex items-center gap-1">
                                        <div className="w-2 h-2 rounded-full bg-green-500" />
                                        <span className="text-xs text-green-600">En ligne</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-col gap-2 mt-4">
                        {/* ✅ NOUVEAU: Bouton "Se faire livrer" - Uniquement pour les produits (pas les prestations) */}
                        {serviceId && isProduct && (
                            <Button
                                onClick={() => setShowOrderModal(true)}
                                className="w-full bg-green-600 hover:bg-green-700"
                            >
                                <Truck className="w-4 h-4 mr-2" />
                                Se faire livrer
                            </Button>
                        )}

                        {/* Bouton principal - Chat */}
                        <Button
                            onClick={onChatPress}
                            className="w-full bg-blue-600 hover:bg-blue-700"
                        >
                            <MessageCircle className="w-4 h-4 mr-2" />
                            Discuter
                        </Button>

                        {/* Actions secondaires */}
                        <div className="grid grid-cols-4 gap-2">
                            {/* ✅ NOUVEAU: Bouton Galerie */}
                            {(images.length > 0 || videos.length > 0) && (
                                <Button
                                    onClick={onGalleryPress}
                                    variant="outline"
                                    size="sm"
                                    className="flex items-center justify-center"
                                >
                                    <ImageIcon className="w-4 h-4 text-purple-600" />
                                </Button>
                            )}

                            <Button
                                onClick={onCallPress}
                                variant="outline"
                                size="sm"
                                className="flex items-center justify-center"
                            >
                                <Phone className="w-4 h-4" />
                            </Button>

                            <Button
                                onClick={() => {
                                    // TODO: Implémenter partage
                                }}
                                variant="outline"
                                size="sm"
                                className="flex items-center justify-center"
                            >
                                <Tag className="w-4 h-4" />
                            </Button>

                            <Button
                                onClick={() => {
                                    // TODO: Implémenter notation/avis
                                }}
                                variant="outline"
                                size="sm"
                                className="flex items-center justify-center"
                            >
                                <span className="text-amber-500">⭐</span>
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </div>

            {/* ✅ Modal commande livraison - Uniquement pour les produits */}
            {serviceId && isProduct && (
                <OrderDeliveryModal
                    isOpen={showOrderModal}
                    onClose={() => setShowOrderModal(false)}
                    serviceId={serviceId}
                    productIndex={productIndex}
                    productName={productName}
                    onSuccess={(deliveryId) => {
                        console.log('Commande créée:', deliveryId);
                        // Optionnel : rediriger vers la page de suivi
                    }}
                />
            )}
        </Card>
    );
};

export default ProductCard;

