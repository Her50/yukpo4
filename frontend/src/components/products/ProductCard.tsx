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
    const autoScrollTimerRef = React.useRef<NodeJS.Timeout | null>(null);

    // Récupérer la configuration de livraison
    useEffect(() => {
        const loadDeliveryConfig = async () => {
            // D'abord, vérifier si delivery_availability est déjà dans product (enrichi par backend)
            if (product.delivery_availability) {
                setDeliveryConfig(product.delivery_availability);
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
    }, [product, serviceId, productIndex]);

    // Obtenir service_id et product_index
    const serviceId = service?.id;
    const productIndex = product.product_index ?? product.index ??
        (service?.data?.produits?.valeur ?
            service.data.produits.valeur.findIndex((p: any) => p === product || p.nom === product.nom) :
            undefined);
    const productName = product.nom || product.name || 'Produit';

    // ✅ Vérifier si c'est un produit (pas une prestation de service)
    // Par défaut, si le type n'est pas défini, on considère que c'est un produit
    const isProduct = product.type !== 'prestation_service';

    // ✅ AMÉLIORATION: Extraire les images et vidéos avec support vidéo prioritaire (comme mobile)
    const images = product.images || product.imagesRealisations || [];
    const videos = product.videos || product.videosRealisations || [];
    // Vidéos en premier (comme mobile)
    const allMedia = [
        ...videos.map((v: string) => ({ type: 'video', uri: v })),
        ...images.map((i: string) => ({ type: 'image', uri: i }))
    ];
    const hasMedia = allMedia.length > 0;
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
        return styles[product.type] || styles.autre;
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
        switch (product.type) {
            case 'immobilier_batiment':
            case 'immobilier_terrain':
                return (
                    <div className="flex flex-wrap gap-2 mt-2">
                        {product.superficie && (
                            <Badge variant="secondary" className="text-xs">
                                <Maximize2 className="w-3 h-3 mr-1" />
                                {product.superficie} m²
                            </Badge>
                        )}
                        {product.nbPieces && (
                            <Badge variant="secondary" className="text-xs">
                                <Grid className="w-3 h-3 mr-1" />
                                {product.nbPieces} pièces
                            </Badge>
                        )}
                        {product.quartier && (
                            <Badge variant="secondary" className="text-xs">
                                <MapPin className="w-3 h-3 mr-1" />
                                {product.quartier}
                            </Badge>
                        )}
                    </div>
                );

            case 'automobile':
                return (
                    <div className="flex flex-wrap gap-2 mt-2">
                        {product.marque && (
                            <Badge variant="secondary" className="text-xs">
                                <Tag className="w-3 h-3 mr-1" />
                                {product.marque}
                            </Badge>
                        )}
                        {product.modele && (
                            <Badge variant="secondary" className="text-xs">
                                🚗 {product.modele}
                            </Badge>
                        )}
                        {product.annee && (
                            <Badge variant="secondary" className="text-xs">
                                <Calendar className="w-3 h-3 mr-1" />
                                {product.annee}
                            </Badge>
                        )}
                        {product.kilometrage && (
                            <Badge variant="secondary" className="text-xs">
                                <Activity className="w-3 h-3 mr-1" />
                                {product.kilometrage} km
                            </Badge>
                        )}
                    </div>
                );

            case 'vetement':
            case 'chaussure':
                return (
                    <div className="flex flex-wrap gap-2 mt-2">
                        {product.taille && (
                            <Badge variant="secondary" className="text-xs">
                                <Maximize2 className="w-3 h-3 mr-1" />
                                Taille {product.taille}
                            </Badge>
                        )}
                        {product.couleur && (
                            <Badge variant="secondary" className="text-xs">
                                <Droplet className="w-3 h-3 mr-1" />
                                {product.couleur}
                            </Badge>
                        )}
                        {product.marque && (
                            <Badge variant="secondary" className="text-xs">
                                <Tag className="w-3 h-3 mr-1" />
                                {product.marque}
                            </Badge>
                        )}
                    </div>
                );

            case 'electromenager':
                return (
                    <div className="flex flex-wrap gap-2 mt-2">
                        {product.marque && (
                            <Badge variant="secondary" className="text-xs">
                                <Tag className="w-3 h-3 mr-1" />
                                {product.marque}
                            </Badge>
                        )}
                        {product.modele && (
                            <Badge variant="secondary" className="text-xs">
                                📱 {product.modele}
                            </Badge>
                        )}
                        {product.etatProduit && (
                            <Badge variant="default" className="text-xs bg-green-50 text-green-700">
                                ✓ {product.etatProduit}
                            </Badge>
                        )}
                    </div>
                );

            case 'pharmacie':
                return (
                    <div className="flex flex-wrap gap-2 mt-2">
                        {product.typePharmacie && (
                            <Badge variant="default" className="text-xs bg-emerald-50 text-emerald-700">
                                🛡️ {product.typePharmacie}
                            </Badge>
                        )}
                        {product.joursGarde && (
                            <Badge variant="secondary" className="text-xs">
                                ⏰ Garde: {product.joursGarde}
                            </Badge>
                        )}
                        {product.telephoneUrgence && (
                            <Badge variant="default" className="text-xs bg-red-50 text-red-700">
                                <Phone className="w-3 h-3 mr-1" />
                                {product.telephoneUrgence}
                            </Badge>
                        )}
                    </div>
                );

            case 'hopital_clinique':
                return (
                    <div className="flex flex-wrap gap-2 mt-2">
                        {product.specialites && (
                            <Badge variant="default" className="text-xs bg-red-50 text-red-700">
                                ❤️ {product.specialites}
                            </Badge>
                        )}
                        {product.urgences === 'oui' && (
                            <Badge variant="default" className="text-xs bg-red-100 text-red-800">
                                🚨 Urgences 24/7
                            </Badge>
                        )}
                        {product.medecinsDispo && (
                            <Badge variant="secondary" className="text-xs">
                                👨‍⚕️ {product.medecinsDispo}
                            </Badge>
                        )}
                    </div>
                );

            case 'ticket_voyage':
                return (
                    <div className="flex flex-wrap gap-2 mt-2">
                        {product.depart && (
                            <Badge variant="secondary" className="text-xs">
                                🚏 De: {product.depart}
                            </Badge>
                        )}
                        {product.destination && (
                            <Badge variant="secondary" className="text-xs">
                                🏁 À: {product.destination}
                            </Badge>
                        )}
                        {product.dateDepart && (
                            <Badge variant="secondary" className="text-xs">
                                📅 {product.dateDepart}
                            </Badge>
                        )}
                        {product.heureDepart && (
                            <Badge variant="secondary" className="text-xs">
                                ⏰ {product.heureDepart}
                            </Badge>
                        )}
                    </div>
                );

            case 'covoiturage':
                return (
                    <div className="flex flex-wrap gap-2 mt-2">
                        {product.pointDepart && (
                            <Badge variant="secondary" className="text-xs">
                                🚏 De: {product.pointDepart}
                            </Badge>
                        )}
                        {product.pointArrivee && (
                            <Badge variant="secondary" className="text-xs">
                                🏁 À: {product.pointArrivee}
                            </Badge>
                        )}
                        {product.nbPlacesDisponibles && (
                            <Badge variant="default" className="text-xs bg-pink-50 text-pink-700">
                                👥 {product.nbPlacesDisponibles} places
                            </Badge>
                        )}
                    </div>
                );

            case 'mobilier':
                return (
                    <div className="flex flex-wrap gap-2 mt-2">
                        {product.typeMobilier && (
                            <Badge variant="secondary" className="text-xs">
                                🪑 {product.typeMobilier}
                            </Badge>
                        )}
                        {product.materiau && (
                            <Badge variant="secondary" className="text-xs">
                                📦 {product.materiau}
                            </Badge>
                        )}
                        {product.dimensions && (
                            <Badge variant="secondary" className="text-xs">
                                📐 {product.dimensions}
                            </Badge>
                        )}
                    </div>
                );

            case 'aliments':
                return (
                    <div className="flex flex-wrap gap-2 mt-2">
                        {product.categorieAliment && (
                            <Badge variant="secondary" className="text-xs">
                                🍕 {product.categorieAliment}
                            </Badge>
                        )}
                        {product.origine && (
                            <Badge variant="secondary" className="text-xs">
                                🌍 {product.origine}
                            </Badge>
                        )}
                        {product.certification && (
                            <Badge variant="default" className="text-xs bg-green-50 text-green-700">
                                🏆 {product.certification}
                            </Badge>
                        )}
                    </div>
                );

            case 'livres_fournitures':
                return (
                    <div className="flex flex-wrap gap-2 mt-2">
                        {product.categorieLivre && (
                            <Badge variant="secondary" className="text-xs">
                                📚 {product.categorieLivre}
                            </Badge>
                        )}
                        {product.niveau && (
                            <Badge variant="default" className="text-xs bg-indigo-50 text-indigo-700">
                                🎓 {product.niveau}
                            </Badge>
                        )}
                        {product.matiereScolaire && (
                            <Badge variant="secondary" className="text-xs">
                                📝 {product.matiereScolaire}
                            </Badge>
                        )}
                    </div>
                );

            case 'quincaillerie':
                return (
                    <div className="flex flex-wrap gap-2 mt-2">
                        {product.categorieQuincaillerie && (
                            <Badge variant="secondary" className="text-xs">
                                🔧 {product.categorieQuincaillerie}
                            </Badge>
                        )}
                        {product.marqueQuincaillerie && (
                            <Badge variant="secondary" className="text-xs">
                                <Tag className="w-3 h-3 mr-1" />
                                {product.marqueQuincaillerie}
                            </Badge>
                        )}
                        {product.unite && (
                            <Badge variant="secondary" className="text-xs">
                                📦 Unité: {product.unite}
                            </Badge>
                        )}
                    </div>
                );

            case 'image_son':
                return (
                    <div className="flex flex-wrap gap-2 mt-2">
                        {product.marqueImageSon && (
                            <Badge variant="secondary" className="text-xs">
                                <Tag className="w-3 h-3 mr-1" />
                                {product.marqueImageSon}
                            </Badge>
                        )}
                        {product.typeImageSon && (
                            <Badge variant="secondary" className="text-xs">
                                📺 {product.typeImageSon}
                            </Badge>
                        )}
                        {product.diagonaleEcran && (
                            <Badge variant="secondary" className="text-xs">
                                📐 {product.diagonaleEcran}"
                            </Badge>
                        )}
                        {product.resolution && (
                            <Badge variant="default" className="text-xs bg-purple-50 text-purple-700">
                                🎬 {product.resolution}
                            </Badge>
                        )}
                    </div>
                );

            case 'telephone':
                return (
                    <div className="flex flex-wrap gap-2 mt-2">
                        {product.marqueTelephone && (
                            <Badge variant="secondary" className="text-xs">
                                <Tag className="w-3 h-3 mr-1" />
                                {product.marqueTelephone}
                            </Badge>
                        )}
                        {product.modeleTelephone && (
                            <Badge variant="secondary" className="text-xs">
                                📱 {product.modeleTelephone}
                            </Badge>
                        )}
                        {product.stockage && (
                            <Badge variant="default" className="text-xs bg-orange-50 text-orange-700">
                                💾 {product.stockage}
                            </Badge>
                        )}
                        {product.ram && (
                            <Badge variant="secondary" className="text-xs">
                                RAM: {product.ram}
                            </Badge>
                        )}
                    </div>
                );

            case 'ordinateur':
                return (
                    <div className="flex flex-wrap gap-2 mt-2">
                        {product.marqueOrdinateur && (
                            <Badge variant="secondary" className="text-xs">
                                <Tag className="w-3 h-3 mr-1" />
                                {product.marqueOrdinateur}
                            </Badge>
                        )}
                        {product.processeur && (
                            <Badge variant="default" className="text-xs bg-cyan-50 text-cyan-700">
                                🖥️ {product.processeur}
                            </Badge>
                        )}
                        {product.ramOrdinateur && (
                            <Badge variant="secondary" className="text-xs">
                                RAM: {product.ramOrdinateur}
                            </Badge>
                        )}
                        {product.stockageOrdinateur && (
                            <Badge variant="secondary" className="text-xs">
                                💾 {product.stockageOrdinateur}
                            </Badge>
                        )}
                    </div>
                );

            case 'decoration':
                return (
                    <div className="flex flex-wrap gap-2 mt-2">
                        {product.typeDecoration && (
                            <Badge variant="secondary" className="text-xs">
                                🖼️ {product.typeDecoration}
                            </Badge>
                        )}
                        {product.style && (
                            <Badge variant="default" className="text-xs bg-pink-50 text-pink-700">
                                ✨ {product.style}
                            </Badge>
                        )}
                        {product.couleurDecoration && (
                            <Badge variant="secondary" className="text-xs">
                                <Droplet className="w-3 h-3 mr-1" />
                                {product.couleurDecoration}
                            </Badge>
                        )}
                    </div>
                );

            case 'ustensiles_cuisine':
                return (
                    <div className="flex flex-wrap gap-2 mt-2">
                        {product.typeUstensile && (
                            <Badge variant="secondary" className="text-xs">
                                🍴 {product.typeUstensile}
                            </Badge>
                        )}
                        {product.materiauUstensile && (
                            <Badge variant="secondary" className="text-xs">
                                📦 {product.materiauUstensile}
                            </Badge>
                        )}
                        {product.marqueUstensile && (
                            <Badge variant="secondary" className="text-xs">
                                <Tag className="w-3 h-3 mr-1" />
                                {product.marqueUstensile}
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
                        {product.typeDemenagement && (
                            <Badge variant="secondary" className="text-xs">
                                🚚 {product.typeDemenagement}
                            </Badge>
                        )}

                        <div className="flex flex-wrap gap-2">
                            {/* Volume */}
                            {product.volumeEstime && (
                                <Badge variant="secondary" className="text-xs">
                                    📦 {product.volumeEstime} m³
                                </Badge>
                            )}

                            {/* Véhicule */}
                            {product.typeVehicule && (
                                <Badge variant="secondary" className="text-xs">
                                    🚛 {product.typeVehicule}
                                </Badge>
                            )}

                            {/* Déménageurs */}
                            {product.nbDemenageurs && (
                                <Badge variant="secondary" className="text-xs">
                                    👥 {product.nbDemenageurs} personnes
                                </Badge>
                            )}

                            {/* Distance */}
                            {product.distanceKm && (
                                <Badge variant="secondary" className="text-xs">
                                    🗺️ Max {product.distanceKm} km
                                </Badge>
                            )}
                        </div>

                        {/* Services inclus */}
                        {(product.assuranceMarchandise || product.serviceManutention || product.montageDemontage ||
                            product.emballageCartons || product.gardeMeuble || product.debarras) && (
                                <div className="mt-2">
                                    <p className="text-xs font-medium text-gray-600 mb-1">Services inclus:</p>
                                    <div className="flex flex-wrap gap-1">
                                        {product.assuranceMarchandise && (
                                            <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                                ✓ Assurance
                                            </Badge>
                                        )}
                                        {product.serviceManutention && (
                                            <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                                ✓ Manutention
                                            </Badge>
                                        )}
                                        {product.montageDemontage && (
                                            <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                                ✓ Montage
                                            </Badge>
                                        )}
                                        {product.emballageCartons && (
                                            <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                                ✓ Emballage
                                            </Badge>
                                        )}
                                        {product.gardeMeuble && (
                                            <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                                ✓ Garde-meuble
                                            </Badge>
                                        )}
                                        {product.debarras && (
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
                        {product.typeCosmetique && (
                            <Badge variant="secondary" className="text-xs">
                                ✨ {product.typeCosmetique}
                            </Badge>
                        )}

                        <div className="flex flex-wrap gap-2">
                            {/* Marque */}
                            {product.marqueCosmetique && (
                                <Badge variant="secondary" className="text-xs">
                                    🏷️ {product.marqueCosmetique}
                                </Badge>
                            )}

                            {/* Volume */}
                            {product.volumeCosmetique && product.uniteCosmetique && (
                                <Badge variant="secondary" className="text-xs">
                                    <Droplet className="w-3 h-3 mr-1" />
                                    {product.volumeCosmetique} {product.uniteCosmetique}
                                </Badge>
                            )}

                            {/* Type de peau */}
                            {product.typePeau && (
                                <Badge variant="secondary" className="text-xs">
                                    👤 Peau: {product.typePeau}
                                </Badge>
                            )}

                            {/* Âge recommandé */}
                            {product.ageRecommandé && (
                                <Badge variant="secondary" className="text-xs">
                                    <Calendar className="w-3 h-3 mr-1" />
                                    Âge: {product.ageRecommandé}
                                </Badge>
                            )}
                        </div>

                        {/* Origine */}
                        {product.origineCosmetique && (
                            <Badge variant="secondary" className="text-xs">
                                🌍 Origine: {product.origineCosmetique}
                            </Badge>
                        )}

                        {/* Ingrédients */}
                        {product.ingredientsCosmetique && (
                            <div className="mt-2">
                                <p className="text-xs font-medium text-gray-600 mb-1">Ingrédients:</p>
                                <p className="text-xs text-gray-500 italic line-clamp-2">
                                    {product.ingredientsCosmetique}
                                </p>
                            </div>
                        )}
                    </div>
                );

            case 'bijoux':
                return (
                    <div className="space-y-3 mt-2">
                        {/* Type de bijou */}
                        {product.typeBijou && (
                            <Badge variant="secondary" className="text-xs">
                                💎 {product.typeBijou}
                            </Badge>
                        )}

                        <div className="flex flex-wrap gap-2">
                            {/* Matière */}
                            {product.matiereBijou && (
                                <Badge variant="secondary" className="text-xs">
                                    💍 {product.matiereBijou}
                                </Badge>
                            )}

                            {/* Poids */}
                            {product.poidsBijou && product.unitePoids && (
                                <Badge variant="secondary" className="text-xs">
                                    ⚖️ {product.poidsBijou} {product.unitePoids}
                                </Badge>
                            )}

                            {/* Taille */}
                            {product.tailleBijou && (
                                <Badge variant="secondary" className="text-xs">
                                    <Maximize2 className="w-3 h-3 mr-1" />
                                    Taille: {product.tailleBijou}
                                </Badge>
                            )}

                            {/* Style */}
                            {product.styleBijou && (
                                <Badge variant="secondary" className="text-xs">
                                    ✨ {product.styleBijou}
                                </Badge>
                            )}
                        </div>

                        {/* Origine */}
                        {product.origineBijou && (
                            <Badge variant="secondary" className="text-xs">
                                🌍 Origine: {product.origineBijou}
                            </Badge>
                        )}

                        {/* Certificat */}
                        {product.certificatBijou && (
                            <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                🏆 Certifié: {product.certificatBijou}
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
                                            alt={product.nom || 'Produit'}
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
                    {(product.en_promotion || product.promotion_active) && (
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
                        {product.nom || product.name || product.titre || 'Produit'}
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
                    {product.description && (
                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                            {product.description}
                        </p>
                    )}

                    {/* Détails spécifiques par type */}
                    {renderProductDetails()}

                    {/* Prix */}
                    {formatPrice() && (
                        <div className="mt-3 mb-3">
                            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2 rounded-lg shadow-md">
                                <Tag className="w-4 h-4" />
                                <span className="text-lg font-bold">{formatPrice()}</span>
                            </div>
                        </div>
                    )}

                    {/* GPS et distance */}
                    {displayGPS && (
                        <div className="flex items-center gap-2 text-sm text-red-600 mb-3">
                            <MapPin className="w-4 h-4" />
                            <span className="font-medium">
                                {product.quartier || product.ville || 'Localisation disponible'}
                            </span>
                            {product.distance && (
                                <span className="text-gray-500">• {product.distance.toFixed(1)} km</span>
                            )}
                        </div>
                    )}

                    {/* Statistiques */}
                    <div className="flex items-center justify-around py-2 px-3 bg-gray-50 rounded-lg mb-3">
                        <div className="flex items-center gap-1.5">
                            <Activity className="w-4 h-4 text-gray-500" />
                            <span className="text-xs font-semibold text-gray-700">{product.views || service.views || 0}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Tag className="w-4 h-4 text-gray-500" />
                            <span className="text-xs font-semibold text-gray-700">{product.shares || 0}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="text-amber-500">⭐</span>
                            <span className="text-xs font-semibold text-gray-700">{product.rating || service.rating || '—'}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <MessageCircle className="w-4 h-4 text-gray-500" />
                            <span className="text-xs font-semibold text-gray-700">{product.reviews || 0}</span>
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

