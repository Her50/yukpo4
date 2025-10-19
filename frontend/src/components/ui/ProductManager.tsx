import { Badge } from '@/components/ui/badge';
import BusSeatSelector from '@/components/ui/BusSeatSelector';
import { Button } from '@/components/ui/buttons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import MapModal from '@/components/ui/MapModal';
import { useToast } from '@/components/ui/use-toast';
import { Check, ChevronDown, Download, Edit2, FileText, MapPin, Plus, Trash2, Upload, Video, X } from 'lucide-react';
import React, { useRef, useState } from 'react';

type ProductType =
    | 'immobilier_batiment'
    | 'immobilier_terrain'
    | 'automobile'
    | 'ticket_voyage'
    | 'covoiturage'
    | 'vetement'
    | 'chaussure'
    | 'electromenager'
    | 'mobilier'
    | 'aliments'
    | 'livres_fournitures'
    | 'quincaillerie'
    | 'prestation_service'
    | 'pharmacie'
    | 'hopital_clinique'
    | 'autre';

interface Product {
    id: string;
    type: ProductType;
    name: string;
    price: string;
    currency: string;
    description?: string;
    images: string[];
    videos: string[];

    // Champs immobilier
    superficie?: string;
    nbChambres?: string;
    nbSallesBain?: string;
    adresse?: string;
    quartier?: string;
    ville?: string;
    gpsImmobilier?: string;

    // Champs automobile
    marque?: string;
    modele?: string;
    annee?: string;
    kilometrage?: string;
    couleur?: string;
    typeCarburant?: string;
    transmission?: string;

    // Champs autres types (simplifié pour le frontend)
    [key: string]: any;
}

interface ProductManagerProps {
    products: Product[];
    onProductsChange: (products: Product[]) => void;
    readonly?: boolean;
    titreService?: string;
    descriptionService?: string;
}

const PRODUCT_TYPES = [
    { value: 'immobilier_batiment', label: 'Biens Immobiliers - Bâtiment', icon: '🏢', description: 'Appartements, villas, maisons' },
    { value: 'immobilier_terrain', label: 'Biens Immobiliers - Terrain', icon: '🏞️', description: 'Terrains, parcelles' },
    { value: 'automobile', label: 'Véhicules Automobiles', icon: '🚗', description: 'Voitures, motos' },
    { value: 'ticket_voyage', label: 'Billets de Transport', icon: '🎫', description: 'Tickets de bus, train' },
    { value: 'covoiturage', label: 'Services de Covoiturage', icon: '🚙', description: 'Trajets partagés' },
    { value: 'vetement', label: 'Articles Vestimentaires', icon: '👕', description: 'Vêtements' },
    { value: 'chaussure', label: 'Chaussures', icon: '👟', description: 'Chaussures' },
    { value: 'electromenager', label: 'Électroménager', icon: '🔌', description: 'Appareils électriques' },
    { value: 'mobilier', label: 'Mobilier et Décoration', icon: '🪑', description: 'Meubles' },
    { value: 'aliments', label: 'Produits Alimentaires', icon: '🍎', description: 'Aliments frais et secs' },
    { value: 'livres_fournitures', label: 'Livres et Articles Scolaires', icon: '📚', description: 'Livres, fournitures' },
    { value: 'quincaillerie', label: 'Quincaillerie et Matériaux de Construction', icon: '🔨', description: 'Outils, matériaux, peintures' },
    { value: 'prestation_service', label: 'Portfolio de Réalisations', icon: '🎨', description: 'Galerie de vos réalisations professionnelles' },
    { value: 'pharmacie', label: 'Pharmacies', icon: '💊', description: 'Pharmacies' },
    { value: 'hopital_clinique', label: 'Établissements de Santé', icon: '🏥', description: 'Hôpitaux, cliniques' },
    { value: 'autre', label: 'Autres Produits', icon: '📦', description: 'Autres' },
] as const;

const CURRENCIES = [
    { code: 'XAF', name: 'Franc CFA (XAF)', symbol: 'FCFA' },
    { code: 'USD', name: 'Dollar US (USD)', symbol: '$' },
    { code: 'EUR', name: 'Euro (EUR)', symbol: '€' },
    { code: 'GBP', name: 'Livre Sterling (GBP)', symbol: '£' },
];

// Modèles Excel par type
const EXCEL_TEMPLATES: { [key: string]: string } = {
    immobilier_batiment: `Nom,Prix,Devise,Description,Superficie,Chambres,Salles de bain,Adresse,Quartier,Ville,GPS
Appartement F4,50000000,XAF,Bel appartement moderne avec balcon,120,4,2,Rue des Jardins,Bonanjo,Douala,4.0511°N 9.7679°E`,
    immobilier_terrain: `Nom,Prix,Devise,Description,Superficie,Adresse,Quartier,Ville,GPS
Terrain 500m²,25000000,XAF,Terrain viabilisé prêt à construire,500,Zone industrielle,Logpom,Douala,4.0881°N 9.7043°E`,
    automobile: `Nom,Prix,Devise,Description,Marque,Modèle,Année,Kilométrage,Couleur,Carburant,Transmission
Toyota Corolla,8500000,XAF,Voiture en excellent état avec révision complète,Toyota,Corolla,2018,65000,Blanche,Essence,Automatique`,
    aliments: `Nom,Prix,Devise,Description,Catégorie,Origine,Date expiration,Poids/Quantité,Conservation,Certification
Tomates fraîches,500,XAF,Tomates rouges mûres et juteuses du terroir,Légumes,Locale,2024-02-01,1kg,Frais,Bio`,
    mobilier: `Nom,Prix,Devise,Description,Type,Matériau,Dimensions,Couleur,État
Canapé 3 places,85000,XAF,Canapé confortable avec coussins moelleux,Salon,Tissu,200x90x85,Gris,Neuf`,
    livres_fournitures: `Nom,Prix,Devise,Description,Catégorie,Niveau,Matière,Auteur,Éditeur,ISBN,Année édition,État
Mathématiques Terminale C,8500,XAF,Manuel complet avec exercices corrigés,Livre scolaire,Secondaire,Mathématiques,CIAM,Edicef,978-2-7531-0584-3,2023,Neuf`,
    quincaillerie: `Nom,Prix,Devise,Description,Catégorie,Marque,Référence,Unité,Stock disponible
Marteau menuisier,5000,XAF,Marteau professionnel manche bois robuste,Outils,Stanley,STHT0-51309,Pièce,50`,
    prestation_service: `Nom,Prix,Devise
Portfolio Réalisation 1,0,XAF`,
    autre: `Nom,Prix,Devise,Description
Produit 1,10000,XAF,Description détaillée du produit`
};

const ProductManager: React.FC<ProductManagerProps> = ({
    products,
    onProductsChange,
    readonly = false,
    titreService,
    descriptionService
}) => {
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [selectedType, setSelectedType] = useState<ProductType>('autre');
    const [currentStep, setCurrentStep] = useState<'type' | 'form'>('type');
    const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    const [showGPSModal, setShowGPSModal] = useState(false);
    const [showSeatSelector, setShowSeatSelector] = useState(false);
    const [selectedGPSLocation, setSelectedGPSLocation] = useState<{ lat: number; lng: number } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    const handleAddProduct = () => {
        setCurrentStep('type');
        setSelectedType('autre');
        const newProduct: Product = {
            id: Date.now().toString(),
            type: 'autre',
            name: '',
            price: '',
            currency: 'XAF',
            description: '',
            images: [],
            videos: []
        };
        setEditingProduct(newProduct);
    };

    const handleSelectType = (type: ProductType) => {
        setSelectedType(type);

        // ✅ Pour Prestation de Service : Pré-remplir automatiquement titre et description
        if (type === 'prestation_service') {
            setEditingProduct(prev => prev ? {
                ...prev,
                type,
                name: titreService || 'Réalisation',
                description: descriptionService || ''
            } : null);
        } else {
            setEditingProduct(prev => prev ? { ...prev, type } : null);
        }

        setCurrentStep('form');
    };

    const downloadExcelTemplate = (type: ProductType) => {
        const template = EXCEL_TEMPLATES[type] || EXCEL_TEMPLATES['autre'];
        const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `modele_${type}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast({
            title: "Modèle téléchargé",
            description: `Le modèle Excel pour ${PRODUCT_TYPES.find(t => t.value === type)?.label} a été téléchargé`,
        });
    };

    const handleEditProduct = (product: Product) => {
        setEditingProduct({ ...product });
        setSelectedType(product.type);
        setCurrentStep('form');
    };

    const handleDeleteProduct = (productId: string) => {
        onProductsChange(products.filter(p => p.id !== productId));
        toast({
            title: "Produit supprimé",
            description: "Le produit a été supprimé avec succès.",
        });
    };

    const handleSaveProduct = () => {
        if (!editingProduct?.name.trim() || !editingProduct?.price.trim()) {
            toast({
                title: "Erreur",
                description: "Veuillez remplir le nom et le prix du produit",
                variant: "destructive",
            });
            return;
        }

        const existingIndex = products.findIndex(p => p.id === editingProduct.id);
        if (existingIndex >= 0) {
            const updatedProducts = products.map((p, index) =>
                index === existingIndex ? editingProduct : p
            );
            onProductsChange(updatedProducts);
        } else {
            onProductsChange([...products, editingProduct]);
        }

        setEditingProduct(null);
        toast({
            title: "Produit enregistré",
            description: "Le produit a été enregistré avec succès.",
        });
    };

    const handleFileUpload = (files: FileList, type: 'images' | 'videos') => {
        if (!editingProduct) return;

        const fileArray = Array.from(files);
        const validFiles = fileArray.filter(file => {
            if (type === 'images') {
                return file.type.startsWith('image/');
            } else {
                return file.type.startsWith('video/');
            }
        });

        if (validFiles.length === 0) {
            toast({
                title: "Erreur",
                description: `Aucun fichier ${type === 'images' ? 'image' : 'vidéo'} valide sélectionné`,
                variant: "destructive",
            });
            return;
        }

        // Convertir les fichiers en base64
        const processFiles = async () => {
            const base64Files: string[] = [];

            for (const file of validFiles) {
                const base64 = await new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result as string);
                    reader.readAsDataURL(file);
                });
                base64Files.push(base64);
            }

            setEditingProduct(prev => ({
                ...prev!,
                [type]: [...(prev![type] || []), ...base64Files]
            }));
        };

        processFiles();
    };

    const removeMedia = (type: 'images' | 'videos', index: number) => {
        if (!editingProduct) return;

        setEditingProduct(prev => ({
            ...prev!,
            [type]: prev![type].filter((_, i) => i !== index)
        }));
    };

    const formatPrice = (price: string, currency: string) => {
        const currencyInfo = CURRENCIES.find(c => c.code === currency);
        const symbol = currencyInfo?.symbol || currency;
        return `${price} ${symbol}`;
    };

    return (
        <div className="space-y-4">
            {/* En-tête */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-gray-900">🛍️ Produits</h3>
                    <p className="text-sm text-gray-600">Gérez les produits de votre service</p>
                </div>
                {!readonly && (
                    <Button onClick={handleAddProduct} size="sm">
                        <Plus className="w-4 h-4 mr-2" />
                        Ajouter un produit
                    </Button>
                )}
            </div>

            {/* Liste des produits */}
            {products.length === 0 ? (
                <Card className="border-dashed border-2 border-gray-300">
                    <CardContent className="flex flex-col items-center justify-center py-8">
                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                            <Plus className="w-6 h-6 text-gray-400" />
                        </div>
                        <h4 className="text-lg font-medium text-gray-900 mb-2">Aucun produit</h4>
                        <p className="text-sm text-gray-600 text-center">
                            Ajoutez des produits pour enrichir votre service
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4">
                    {products.map((product) => {
                        const typeInfo = PRODUCT_TYPES.find(t => t.value === product.type);
                        return (
                            <Card key={product.id} className="hover:shadow-md transition-shadow">
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <div className="text-xs text-gray-500 mb-1">
                                                {typeInfo?.icon} {typeInfo?.label}
                                            </div>
                                            <h4 className="font-semibold text-gray-900">{product.name}</h4>
                                            <p className="text-sm text-blue-600 font-medium">
                                                {formatPrice(product.price, product.currency)}
                                            </p>
                                            {product.description && (
                                                <p className="text-sm text-gray-600 mt-1 line-clamp-2">{product.description}</p>
                                            )}
                                            <div className="flex items-center gap-4 mt-2">
                                                <Badge variant="secondary" className="text-xs">
                                                    📷 {product.images.length} image(s)
                                                </Badge>
                                                <Badge variant="secondary" className="text-xs">
                                                    🎥 {product.videos.length} vidéo(s)
                                                </Badge>
                                            </div>
                                        </div>
                                        {!readonly && (
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleEditProduct(product)}
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleDeleteProduct(product.id)}
                                                    className="text-red-600 hover:text-red-700"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Modal d'édition de produit */}
            {editingProduct && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                                {editingProduct.id ? 'Modifier le produit' : 'Nouveau produit'}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setEditingProduct(null);
                                        setCurrentStep('type');
                                    }}
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Étape 1: Sélection du type */}
                            {currentStep === 'type' && (
                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold">✨ Sélectionnez le type de produit <span className="text-red-600">*</span></h3>
                                    <p className="text-sm text-gray-600">Choisissez la catégorie qui correspond le mieux à votre produit</p>

                                    <div className="space-y-2">
                                        {PRODUCT_TYPES.map((type) => (
                                            <button
                                                key={type.value}
                                                onClick={() => handleSelectType(type.value as ProductType)}
                                                className={`w-full p-4 rounded-lg border-2 text-left transition-all ${selectedType === type.value
                                                    ? 'border-blue-500 bg-blue-50'
                                                    : 'border-gray-200 hover:border-gray-300'
                                                    }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3 flex-1">
                                                        <span className="text-2xl">{type.icon}</span>
                                                        <div className="flex-1">
                                                            <div className="font-semibold text-gray-900">{type.label}</div>
                                                            <div className="text-sm text-gray-600">{type.description}</div>
                                                        </div>
                                                    </div>
                                                    {selectedType === type.value && (
                                                        <Check className="w-5 h-5 text-blue-600" />
                                                    )}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Étape 2: Formulaire */}
                            {currentStep === 'form' && (
                                <div className="space-y-6">
                                    {/* Badge du type sélectionné */}
                                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xl">{PRODUCT_TYPES.find(t => t.value === selectedType)?.icon}</span>
                                            <span className="font-semibold text-blue-900">
                                                {PRODUCT_TYPES.find(t => t.value === selectedType)?.label}
                                            </span>
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentStep('type')}
                                        >
                                            Changer
                                        </Button>
                                    </div>

                                    {/* Boutons Excel */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <Button
                                            variant="outline"
                                            onClick={() => downloadExcelTemplate(selectedType)}
                                            className="w-full"
                                        >
                                            <Download className="w-4 h-4 mr-2" />
                                            Télécharger modèle Excel
                                        </Button>
                                        <Button
                                            variant="outline"
                                            onClick={() => {
                                                const input = document.createElement('input');
                                                input.type = 'file';
                                                input.accept = '.csv,.xlsx';
                                                input.onchange = (e) => {
                                                    const files = (e.target as HTMLInputElement).files;
                                                    if (files) {
                                                        toast({
                                                            title: "Import Excel",
                                                            description: "Fonctionnalité d'import en cours de développement",
                                                        });
                                                    }
                                                };
                                                input.click();
                                            }}
                                            className="w-full"
                                        >
                                            <FileText className="w-4 h-4 mr-2" />
                                            Importer Excel
                                        </Button>
                                    </div>

                                    <div className="text-center text-sm text-gray-500">
                                        ou remplir manuellement
                                    </div>

                                    {/* Informations de base - Cachées pour Prestation de Service */}
                                    {selectedType !== 'prestation_service' && (
                                        <>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <Label htmlFor="product-name">Nom du produit *</Label>
                                                    <Input
                                                        id="product-name"
                                                        value={editingProduct.name}
                                                        onChange={(e) => setEditingProduct(prev => ({
                                                            ...prev!,
                                                            name: e.target.value
                                                        }))}
                                                        placeholder="Ex: Appartement F4"
                                                    />
                                                </div>
                                                <div>
                                                    <Label htmlFor="product-price">Prix *</Label>
                                                    <Input
                                                        id="product-price"
                                                        type="number"
                                                        value={editingProduct.price}
                                                        onChange={(e) => setEditingProduct(prev => ({
                                                            ...prev!,
                                                            price: e.target.value
                                                        }))}
                                                        placeholder="0"
                                                    />
                                                </div>
                                            </div>

                                            {/* Description */}
                                            <div>
                                                <Label htmlFor="product-description">Description</Label>
                                                <textarea
                                                    id="product-description"
                                                    value={editingProduct.description || ''}
                                                    onChange={(e) => setEditingProduct(prev => ({
                                                        ...prev!,
                                                        description: e.target.value
                                                    }))}
                                                    placeholder="Décrivez ce produit..."
                                                    className="w-full p-2 border border-gray-300 rounded-md min-h-[80px]"
                                                />
                                            </div>
                                        </>
                                    )}

                                    {/* Prix pour Prestation de Service (optionnel) */}
                                    {selectedType === 'prestation_service' && (
                                        <div>
                                            <Label htmlFor="product-price">Prix de cette réalisation (optionnel)</Label>
                                            <div className="flex gap-2">
                                                <Input
                                                    id="product-price"
                                                    type="number"
                                                    value={editingProduct.price}
                                                    onChange={(e) => setEditingProduct(prev => ({
                                                        ...prev!,
                                                        price: e.target.value
                                                    }))}
                                                    placeholder="0"
                                                    className="flex-1"
                                                />
                                                <select
                                                    value={editingProduct.currency}
                                                    onChange={(e) => setEditingProduct(prev => ({
                                                        ...prev!,
                                                        currency: e.target.value
                                                    }))}
                                                    className="px-3 py-2 border border-gray-300 rounded-md"
                                                >
                                                    {CURRENCIES.map(c => (
                                                        <option key={c.code} value={c.code}>{c.code}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <p className="text-xs text-gray-500 mt-1">
                                                💡 Le titre et la description sont automatiquement repris du service principal
                                            </p>
                                        </div>
                                    )}

                                    {/* Champs spécifiques selon le type */}
                                    {selectedType === 'immobilier_batiment' && (
                                        <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                                            <h4 className="font-semibold text-gray-900">Caractéristiques du bien</h4>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div>
                                                    <Label>Superficie (m²)</Label>
                                                    <Input
                                                        type="number"
                                                        value={editingProduct.superficie || ''}
                                                        onChange={(e) => setEditingProduct(prev => ({
                                                            ...prev!,
                                                            superficie: e.target.value
                                                        }))}
                                                        placeholder="120"
                                                    />
                                                </div>
                                                <div>
                                                    <Label>Chambres</Label>
                                                    <Input
                                                        type="number"
                                                        value={editingProduct.nbChambres || ''}
                                                        onChange={(e) => setEditingProduct(prev => ({
                                                            ...prev!,
                                                            nbChambres: e.target.value
                                                        }))}
                                                        placeholder="4"
                                                    />
                                                </div>
                                                <div>
                                                    <Label>Salles de bain</Label>
                                                    <Input
                                                        type="number"
                                                        value={editingProduct.nbSallesBain || ''}
                                                        onChange={(e) => setEditingProduct(prev => ({
                                                            ...prev!,
                                                            nbSallesBain: e.target.value
                                                        }))}
                                                        placeholder="2"
                                                    />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div>
                                                    <Label>Quartier</Label>
                                                    <Input
                                                        value={editingProduct.quartier || ''}
                                                        onChange={(e) => setEditingProduct(prev => ({
                                                            ...prev!,
                                                            quartier: e.target.value
                                                        }))}
                                                        placeholder="Bonanjo"
                                                    />
                                                </div>
                                                <div>
                                                    <Label>Ville</Label>
                                                    <Input
                                                        value={editingProduct.ville || ''}
                                                        onChange={(e) => setEditingProduct(prev => ({
                                                            ...prev!,
                                                            ville: e.target.value
                                                        }))}
                                                        placeholder="Douala"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <Label>📍 Localisation GPS</Label>
                                                <Button
                                                    variant="outline"
                                                    className="w-full"
                                                    onClick={() => setShowGPSModal(true)}
                                                >
                                                    <MapPin className="w-4 h-4 mr-2" />
                                                    {editingProduct.gpsImmobilier ? 'Modifier la localisation' : 'Ajouter la localisation GPS'}
                                                </Button>
                                                {editingProduct.gpsImmobilier && (
                                                    <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-sm text-green-900">
                                                        ✓ Position enregistrée
                                                    </div>
                                                )}
                                                <p className="text-xs text-gray-500 mt-1">
                                                    💡 La localisation GPS aide les acheteurs à trouver le bien
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Champs pour Terrain */}
                                    {selectedType === 'immobilier_terrain' && (
                                        <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                                            <h4 className="font-semibold text-gray-900">Caractéristiques du terrain</h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <Label>Superficie (m²)</Label>
                                                    <Input
                                                        type="number"
                                                        value={editingProduct.superficie || ''}
                                                        onChange={(e) => setEditingProduct(prev => ({
                                                            ...prev!,
                                                            superficie: e.target.value
                                                        }))}
                                                        placeholder="500"
                                                    />
                                                </div>
                                                <div>
                                                    <Label>Ville</Label>
                                                    <Input
                                                        value={editingProduct.ville || ''}
                                                        onChange={(e) => setEditingProduct(prev => ({
                                                            ...prev!,
                                                            ville: e.target.value
                                                        }))}
                                                        placeholder="Douala"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <Label>📍 Localisation GPS</Label>
                                                <Button
                                                    variant="outline"
                                                    className="w-full"
                                                    onClick={() => setShowGPSModal(true)}
                                                >
                                                    <MapPin className="w-4 h-4 mr-2" />
                                                    {editingProduct.gpsImmobilier ? 'Modifier la localisation' : 'Ajouter la localisation GPS'}
                                                </Button>
                                                {editingProduct.gpsImmobilier && (
                                                    <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-sm text-green-900">
                                                        ✓ Position enregistrée
                                                    </div>
                                                )}
                                                <p className="text-xs text-gray-500 mt-1">
                                                    💡 La localisation GPS précise augmente la visibilité du terrain
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Sélection de devise */}
                                    <div>
                                        <Label>Devise</Label>
                                        <div className="relative">
                                            <Button
                                                variant="outline"
                                                className="w-full justify-between"
                                                onClick={() => setShowCurrencyDropdown(!showCurrencyDropdown)}
                                            >
                                                {CURRENCIES.find(c => c.code === editingProduct.currency)?.name || 'Sélectionner une devise'}
                                                <ChevronDown className="w-4 h-4" />
                                            </Button>
                                            {showCurrencyDropdown && (
                                                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                                    {CURRENCIES.map((currency) => (
                                                        <button
                                                            key={currency.code}
                                                            className="w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center justify-between"
                                                            onClick={() => {
                                                                setEditingProduct(prev => ({
                                                                    ...prev!,
                                                                    currency: currency.code
                                                                }));
                                                                setShowCurrencyDropdown(false);
                                                            }}
                                                        >
                                                            <div>
                                                                <div className="font-medium">{currency.code}</div>
                                                                <div className="text-sm text-gray-600">{currency.name}</div>
                                                            </div>
                                                            <div className="text-sm text-gray-500">{currency.symbol}</div>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Upload d'images */}
                                    <div>
                                        <Label>Images du produit</Label>
                                        <div
                                            className={`border-2 border-dashed border-gray-300 rounded-lg p-6 text-center ${dragActive ? 'border-blue-500 bg-blue-50' : ''
                                                }`}
                                            onDragEnter={(e) => {
                                                e.preventDefault();
                                                setDragActive(true);
                                            }}
                                            onDragLeave={(e) => {
                                                e.preventDefault();
                                                setDragActive(false);
                                            }}
                                            onDragOver={(e) => e.preventDefault()}
                                            onDrop={(e) => {
                                                e.preventDefault();
                                                setDragActive(false);
                                                handleFileUpload(e.dataTransfer.files, 'images');
                                            }}
                                        >
                                            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                                            <p className="text-sm text-gray-600 mb-2">
                                                Glissez-déposez des images ou cliquez pour sélectionner
                                            </p>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => fileInputRef.current?.click()}
                                            >
                                                Sélectionner des images
                                            </Button>
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                multiple
                                                accept="image/*"
                                                className="hidden"
                                                onChange={(e) => e.target.files && handleFileUpload(e.target.files, 'images')}
                                            />
                                        </div>

                                        {/* Aperçu des images */}
                                        {editingProduct.images.length > 0 && (
                                            <div className="grid grid-cols-4 gap-2 mt-4">
                                                {editingProduct.images.map((image, index) => (
                                                    <div key={index} className="relative group">
                                                        <img
                                                            src={image}
                                                            alt={`Produit ${index + 1}`}
                                                            className="w-full h-20 object-cover rounded-lg"
                                                        />
                                                        <Button
                                                            variant="destructive"
                                                            size="sm"
                                                            className="absolute -top-2 -right-2 w-6 h-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                                            onClick={() => removeMedia('images', index)}
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Upload de vidéos */}
                                    <div>
                                        <Label>Vidéos du produit</Label>
                                        <div
                                            className={`border-2 border-dashed border-gray-300 rounded-lg p-6 text-center ${dragActive ? 'border-blue-500 bg-blue-50' : ''
                                                }`}
                                            onDragEnter={(e) => {
                                                e.preventDefault();
                                                setDragActive(true);
                                            }}
                                            onDragLeave={(e) => {
                                                e.preventDefault();
                                                setDragActive(false);
                                            }}
                                            onDragOver={(e) => e.preventDefault()}
                                            onDrop={(e) => {
                                                e.preventDefault();
                                                setDragActive(false);
                                                handleFileUpload(e.dataTransfer.files, 'videos');
                                            }}
                                        >
                                            <Video className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                                            <p className="text-sm text-gray-600 mb-2">
                                                Glissez-déposez des vidéos ou cliquez pour sélectionner
                                            </p>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    const input = document.createElement('input');
                                                    input.type = 'file';
                                                    input.multiple = true;
                                                    input.accept = 'video/*';
                                                    input.onchange = (e) => {
                                                        const files = (e.target as HTMLInputElement).files;
                                                        if (files) handleFileUpload(files, 'videos');
                                                    };
                                                    input.click();
                                                }}
                                            >
                                                Sélectionner des vidéos
                                            </Button>
                                        </div>

                                        {/* Aperçu des vidéos */}
                                        {editingProduct.videos.length > 0 && (
                                            <div className="grid grid-cols-2 gap-2 mt-4">
                                                {editingProduct.videos.map((video, index) => (
                                                    <div key={index} className="relative group">
                                                        <video
                                                            src={video}
                                                            className="w-full h-32 object-cover rounded-lg"
                                                            controls
                                                        />
                                                        <Button
                                                            variant="destructive"
                                                            size="sm"
                                                            className="absolute -top-2 -right-2 w-6 h-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                                            onClick={() => removeMedia('videos', index)}
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex justify-end gap-2 pt-4 border-t">
                                        <Button
                                            variant="outline"
                                            onClick={() => {
                                                setEditingProduct(null);
                                                setCurrentStep('type');
                                            }}
                                        >
                                            Annuler
                                        </Button>
                                        <Button onClick={handleSaveProduct}>
                                            <Check className="w-4 h-4 mr-2" />
                                            Enregistrer
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Modal GPS pour immobilier */}
            {showGPSModal && (
                <MapModal
                    onClose={() => setShowGPSModal(false)}
                    onSelect={(coordinatesString) => {
                        const firstPoint = coordinatesString.split('|')[0].split(',');
                        if (firstPoint.length === 2) {
                            const lat = parseFloat(firstPoint[0]);
                            const lng = parseFloat(firstPoint[1]);
                            setSelectedGPSLocation({ lat, lng });
                            setEditingProduct(prev => ({
                                ...prev!,
                                gpsImmobilier: coordinatesString
                            }));
                        }
                        setShowGPSModal(false);
                    }}
                    currentLocation={selectedGPSLocation}
                    title="Localisation du bien immobilier"
                    allowZoneSelection={true}
                />
            )}

            {/* Sélecteur de place pour bus */}
            <BusSeatSelector
                isOpen={showSeatSelector}
                onClose={() => setShowSeatSelector(false)}
                onSelectSeat={(seatLabel) => {
                    setEditingProduct(prev => ({
                        ...prev!,
                        numeroPlace: seatLabel
                    }));
                    setShowSeatSelector(false);
                }}
            />
        </div>
    );
};

export default ProductManager;

















