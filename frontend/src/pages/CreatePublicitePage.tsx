import { AlertCircle, ArrowLeft, DollarSign, Globe, Info, MapPin, Package, Video, Zap } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Button } from '../components/ui/buttons/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { apiGet, apiPost } from '../services/apiService';

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

interface Product {
    id: string;
    nom: string;
    prix?: string;
    devise?: string;
    serviceId: string;
    serviceTitre: string;
    productIndex: number;
}

const CreatePublicitePage: React.FC = () => {
    const navigate = useNavigate();

    // ✅ Mode: 'create', 'edit', ou 'relance'
    const searchParams = new URLSearchParams(window.location.search);
    const publiciteId = searchParams.get('publiciteId');
    const relanceId = searchParams.get('relanceId');
    const mode = publiciteId ? 'edit' : relanceId ? 'relance' : 'create';

    const [loading, setLoading] = useState(false);
    const [produitsList, setProduitsList] = useState<Product[]>([]);
    const [selectedProduits, setSelectedProduits] = useState<string[]>([]);
    const [videos, setVideos] = useState<File[]>([]);
    const [titre, setTitre] = useState('');
    const [description, setDescription] = useState('');
    const [duree, setDuree] = useState('7');
    const [zoneGeographique, setZoneGeographique] = useState('local');
    const [coutEstime, setCoutEstime] = useState(0);
    const [userCurrency, setUserCurrency] = useState('FCFA');
    const [userBalance, setUserBalance] = useState(0);

    useEffect(() => {
        loadMesServicesEtProduits();
        loadUserData();

        // Si mode modification ou relance, charger les données de la publicité
        if (mode === 'edit' && publiciteId) {
            loadPubliciteData(publiciteId);
        } else if (mode === 'relance' && relanceId) {
            loadPubliciteData(relanceId);
        }
    }, []);

    useEffect(() => {
        calculateCost();
    }, [duree, userCurrency, videos]);

    const loadUserData = async () => {
        try {
            // Récupérer devise et solde de l'utilisateur
            const [profileResponse, balanceResponse] = await Promise.all([
                apiGet('/api/users/profile'),
                apiGet('/api/users/balance')
            ]);

            if (profileResponse.success && profileResponse.data?.devise_preferee) {
                setUserCurrency(profileResponse.data.devise_preferee);
            }

            if (balanceResponse.success) {
                setUserBalance(balanceResponse.data?.tokens_balance || 0);
            }
        } catch (error) {
            console.error('[CreatePublicite] Erreur chargement données utilisateur:', error);
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
            toast.error('Impossible de charger la publicité');
            setLoading(false);
        }
    };

    const loadMesServicesEtProduits = async () => {
        try {
            setLoading(true);
            // ✅ PHASE 5: Utiliser getProductsByUser (plus de fallback JSONB)
            const token = localStorage.getItem('token');
            if (!token) {
                setLoading(false);
                return;
            }
            
            // Extraire userId depuis le token JWT
            const payload = JSON.parse(atob(token.split('.')[1]));
            const userId = payload.user_id || payload.id;
            
            if (userId) {
                const { productsService } = await import('@/services/productsService');
                const products = await productsService.getProductsByUser(userId);
                const allProducts: Product[] = products.map((product) => ({
                    ...product.product_data,
                    id: `${product.service_id}_${product.product_index}`,
                    serviceId: product.service_id.toString(),
                    serviceTitre: '', // Pourra être enrichi si nécessaire
                    productIndex: product.product_index
                }));
                setProduitsList(allProducts);
                console.log('[CreatePublicite] ✅ Produits chargés depuis API:', allProducts.length);
            }
            setLoading(false);
        } catch (error) {
            console.error('[CreatePublicite] Erreur chargement:', error);
            setLoading(false);
            toast.error('Impossible de charger vos produits');
        }
    };

    const calculateCost = () => {
        const nbJours = parseInt(duree) || 7;
        const nbVideos = videos.length;

        // Calcul en FCFA: Base + coût vidéos
        const coutBase = nbJours * PRICE_PER_DAY_FCFA;
        const coutVideos = nbVideos * 2000; // 2000 FCFA par vidéo
        const totalFCFA = coutBase + coutVideos;

        const exchangeRate = EXCHANGE_RATES[userCurrency] || 1;
        const totalInUserCurrency = Math.round(totalFCFA / exchangeRate);
        setCoutEstime(totalInUserCurrency);
    };

    const handleVideoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files) {
            const newVideos = Array.from(files).filter(file =>
                file.type.startsWith('video/') && file.size <= 50 * 1024 * 1024 // 50 MB max
            );
            setVideos([...videos, ...newVideos]);
        }
    };

    const removeVideo = (index: number) => {
        setVideos(videos.filter((_, i) => i !== index));
    };

    const toggleProduitSelection = (produitId: string) => {
        if (selectedProduits.includes(produitId)) {
            setSelectedProduits(selectedProduits.filter(id => id !== produitId));
        } else {
            setSelectedProduits([...selectedProduits, produitId]);
        }
    };

    const handleSubmit = async () => {
        // Validation
        if (selectedProduits.length === 0) {
            toast.error('Veuillez sélectionner au moins un produit');
            return;
        }

        if (!titre.trim()) {
            toast.error('Veuillez entrer un titre pour la publicité');
            return;
        }

        // Vérifier le solde
        const exchangeRate = EXCHANGE_RATES[userCurrency] || 1;
        const coutEnFCFA = Math.round(coutEstime * exchangeRate);

        if (userBalance < coutEnFCFA) {
            const confirmRecharge = window.confirm(
                `💸 Solde insuffisant\n\n` +
                `Coût : ${coutEstime.toLocaleString()} ${userCurrency}\n` +
                `Solde : ${Math.round(userBalance / exchangeRate).toLocaleString()} ${userCurrency}\n\n` +
                `Voulez-vous recharger votre compte ?`
            );

            if (confirmRecharge) {
                navigate('/recharge-tokens');
            }
            return;
        }

        // Confirmation
        const confirm = window.confirm(
            `💰 Créer cette publicité ?\n\n` +
            `Produits : ${selectedProduits.length}\n` +
            `Vidéos : ${videos.length}\n` +
            `Durée : ${duree} jours\n` +
            `Zone : ${getZoneLabel(zoneGeographique)}\n\n` +
            `Coût : ${coutEstime.toLocaleString()} ${userCurrency}\n` +
            `Solde après : ${Math.round((userBalance - coutEnFCFA) / exchangeRate).toLocaleString()} ${userCurrency}`
        );

        if (!confirm) return;

        try {
            setLoading(true);

            // Convertir les vidéos en base64
            const videoPromises = videos.map(video => {
                return new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(video);
                });
            });

            const videoBase64Array = await Promise.all(videoPromises);

            // ✅ CORRECTION 413: Limiter la taille des vidéos
            console.log('[CreatePublicite] 🔄 Vérification taille vidéos...');
            const { limitVideos } = await import('../utils/mediaCompression');
            const limitedVideos = limitVideos(videoBase64Array);

            if (limitedVideos.length < videoBase64Array.length) {
                toast.warning(`${videoBase64Array.length - limitedVideos.length} vidéo(s) ignorée(s) (trop volumineuse, max 5MB)`);
            }

            const publiciteData = {
                titre,
                description,
                produits_indexes: selectedProduits,
                videos: limitedVideos.map(v => v.split(',')[1]), // Retirer le préfixe data:...
                duree_jours: parseInt(duree),
                cout: coutEnFCFA,
                zone_geographique: zoneGeographique,
                devise_utilisateur: userCurrency
            };

            // ✅ Appel API selon le mode
            const response = mode === 'edit' && publiciteId
                ? await apiPost(`/api/publicites/${publiciteId}/update`, publiciteData)
                : await apiPost('/api/publicites/create', publiciteData);

            if (response.success) {
                toast.success(mode === 'edit' ? '✅ Publicité modifiée avec succès !' : '✅ Publicité créée avec succès !');
                navigate('/dashboard-publicite');
            } else {
                toast.error(response.error || 'Impossible de créer la publicité');
            }

            setLoading(false);
        } catch (error) {
            console.error('[CreatePublicite] Erreur création:', error);
            toast.error('Une erreur est survenue');
            setLoading(false);
        }
    };

    const getZoneLabel = (zone: string): string => {
        const labels: { [key: string]: string } = {
            'local': 'Local (ville)',
            'regional': 'Régional (pays)',
            'international': 'International'
        };
        return labels[zone] || zone;
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 py-8 px-4">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => navigate(-1)}
                        className="rounded-full"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">
                            {mode === 'edit' ? 'Modifier une Publicité' :
                                mode === 'relance' ? 'Relancer une Publicité' :
                                    'Créer une Publicité'}
                        </h1>
                        <p className="text-gray-600">Boostez vos produits</p>
                    </div>
                </div>

                {/* Info tarification */}
                <Card className="mb-6 bg-blue-50 border-blue-200">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-blue-900">
                            <Info className="w-5 h-5" />
                            Tarification
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-blue-800 space-y-1">
                        <p>• 500 FCFA par jour</p>
                        <p>• +2 000 FCFA par vidéo</p>
                        <p>• Conversion automatique en {userCurrency}</p>
                        <p>• Facturation journalière</p>
                    </CardContent>
                </Card>

                {/* Formulaire */}
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>📝 Informations générales</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Titre de la publicité <span className="text-red-500">*</span>
                            </label>
                            <Input
                                placeholder="Ex: Promotion Immobilier - 20% de remise"
                                value={titre}
                                onChange={(e) => setTitre(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Description
                            </label>
                            <Textarea
                                placeholder="Décrivez votre offre promotionnelle..."
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={3}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Durée (jours) <span className="text-red-500">*</span>
                            </label>
                            <div className="flex gap-2 flex-wrap">
                                {['7', '14', '30', '60', '90'].map((d) => (
                                    <Button
                                        key={d}
                                        type="button"
                                        variant={duree === d ? "default" : "outline"}
                                        onClick={() => setDuree(d)}
                                        className="flex-1 min-w-[100px]"
                                    >
                                        {d} jours
                                    </Button>
                                ))}
                            </div>
                        </div>

                        {/* Zone géographique */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Zone géographique <span className="text-red-500">*</span>
                            </label>
                            <p className="text-sm text-gray-500 mb-3">Sélectionnez la zone d'impact</p>
                            <div className="space-y-2">
                                {[
                                    { value: 'local', icon: MapPin, label: 'Local (ville)' },
                                    { value: 'regional', icon: Globe, label: 'Régional (pays)' },
                                    { value: 'international', icon: Globe, label: 'International' }
                                ].map(({ value, icon: Icon, label }) => (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => setZoneGeographique(value)}
                                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border-2 transition-colors ${zoneGeographique === value
                                            ? 'border-blue-500 bg-blue-50'
                                            : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                    >
                                        <Icon className={`w-5 h-5 ${zoneGeographique === value ? 'text-blue-500' : 'text-gray-400'}`} />
                                        <span className={`font-medium ${zoneGeographique === value ? 'text-blue-900' : 'text-gray-700'}`}>
                                            {label}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Sélection des produits */}
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Package className="w-5 h-5" />
                            Produits à promouvoir ({selectedProduits.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="text-center py-8">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                            </div>
                        ) : produitsList.length === 0 ? (
                            <div className="text-center py-12">
                                <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                <p className="text-gray-600 font-semibold mb-2">Aucun produit disponible</p>
                                <p className="text-sm text-gray-500">Créez d'abord un service avec des produits</p>
                            </div>
                        ) : (
                            <div className="max-h-96 overflow-y-auto space-y-2">
                                {produitsList.map((produit) => {
                                    const isSelected = selectedProduits.includes(produit.id);
                                    return (
                                        <button
                                            key={produit.id}
                                            type="button"
                                            onClick={() => toggleProduitSelection(produit.id)}
                                            className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-colors text-left ${isSelected
                                                ? 'border-blue-500 bg-blue-50'
                                                : 'border-gray-200 hover:border-gray-300'
                                                }`}
                                        >
                                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
                                                }`}>
                                                {isSelected && (
                                                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <p className="font-semibold text-gray-900">{produit.nom || 'Produit'}</p>
                                                <p className="text-sm text-gray-500">Service: {produit.serviceTitre}</p>
                                                {produit.prix && (
                                                    <p className="text-sm font-semibold text-blue-600 mt-1">
                                                        {produit.prix} {produit.devise || 'FCFA'}
                                                    </p>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Vidéos */}
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Video className="w-5 h-5" />
                            Vidéos promotionnelles ({videos.length})
                        </CardTitle>
                        <CardDescription>Maximum 30 secondes par vidéo</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-gray-400 transition-colors">
                            <Video className="w-8 h-8 text-blue-500 mb-2" />
                            <span className="text-sm font-medium text-gray-600">Ajouter une vidéo</span>
                            <input
                                type="file"
                                accept="video/*"
                                multiple
                                onChange={handleVideoUpload}
                                className="hidden"
                            />
                        </label>

                        {videos.length > 0 && (
                            <div className="grid grid-cols-2 gap-4 mt-4">
                                {videos.map((video, index) => (
                                    <div key={index} className="relative bg-gray-100 rounded-lg p-2">
                                        <p className="text-sm font-medium text-gray-700 truncate">{video.name}</p>
                                        <p className="text-xs text-gray-500">{(video.size / 1024 / 1024).toFixed(2)} MB</p>
                                        <button
                                            type="button"
                                            onClick={() => removeVideo(index)}
                                            className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Résumé */}
                <Card className="mb-6 bg-green-50 border-green-200">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-green-900">
                            <DollarSign className="w-5 h-5" />
                            Résumé et facturation
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex justify-between">
                            <span className="text-gray-700">Produits sélectionnés</span>
                            <span className="font-semibold">{selectedProduits.length}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-700">Vidéos ajoutées</span>
                            <span className="font-semibold">{videos.length}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-700">Durée</span>
                            <span className="font-semibold">{duree} jours</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-700">Zone</span>
                            <span className="font-semibold">{getZoneLabel(zoneGeographique)}</span>
                        </div>
                        <div className="border-t border-green-300 pt-3 mt-3 flex justify-between items-center">
                            <span className="text-lg font-bold text-gray-900">Coût total</span>
                            <span className="text-2xl font-bold text-green-700">
                                {coutEstime.toLocaleString()} {userCurrency}
                            </span>
                        </div>
                    </CardContent>
                </Card>

                {/* Bouton de soumission */}
                <Button
                    onClick={handleSubmit}
                    disabled={loading || selectedProduits.length === 0 || !titre.trim()}
                    className="w-full h-12 text-lg"
                    size="lg"
                >
                    {loading ? (
                        'Traitement en cours...'
                    ) : mode === 'edit' ? (
                        <>
                            <span className="mr-2">💾</span>
                            Enregistrer les modifications
                        </>
                    ) : mode === 'relance' ? (
                        <>
                            <span className="mr-2">🔄</span>
                            Relancer la publicité
                        </>
                    ) : (
                        <>
                            <Zap className="w-5 h-5 mr-2" />
                            Créer la publicité
                        </>
                    )}
                </Button>

                {/* Avertissement solde */}
                {userBalance < (coutEstime * (EXCHANGE_RATES[userCurrency] || 1)) && (
                    <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-yellow-800">
                            <p className="font-semibold mb-1">Solde insuffisant</p>
                            <p>Votre solde actuel ne permet pas de créer cette publicité. Veuillez recharger votre compte.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CreatePublicitePage;

