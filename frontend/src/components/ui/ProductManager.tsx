import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/buttons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Check, ChevronDown, Edit2, Plus, Trash2, Upload, Video, X } from 'lucide-react';
import React, { useRef, useState } from 'react';

interface Product {
    id: string;
    name: string;
    price: string;
    currency: string;
    images: string[];
    videos: string[];
}

interface ProductManagerProps {
    products: Product[];
    onProductsChange: (products: Product[]) => void;
    readonly?: boolean;
}

const CURRENCIES = [
    { code: 'XAF', name: 'Franc CFA (XAF)', symbol: 'FCFA' },
    { code: 'USD', name: 'Dollar US (USD)', symbol: '$' },
    { code: 'EUR', name: 'Euro (EUR)', symbol: '€' },
    { code: 'GBP', name: 'Livre Sterling (GBP)', symbol: '£' },
    { code: 'CAD', name: 'Dollar Canadien (CAD)', symbol: 'C$' },
    { code: 'JPY', name: 'Yen Japonais (JPY)', symbol: '¥' },
    { code: 'CNY', name: 'Yuan Chinois (CNY)', symbol: '¥' },
    { code: 'INR', name: 'Roupie Indienne (INR)', symbol: '₹' },
    { code: 'BRL', name: 'Real Brésilien (BRL)', symbol: 'R$' },
    { code: 'AUD', name: 'Dollar Australien (AUD)', symbol: 'A$' },
];

const ProductManager: React.FC<ProductManagerProps> = ({
    products,
    onProductsChange,
    readonly = false
}) => {
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    const handleAddProduct = () => {
        const newProduct: Product = {
            id: Date.now().toString(),
            name: '',
            price: '',
            currency: 'XAF',
            images: [],
            videos: []
        };
        setEditingProduct(newProduct);
    };

    const handleEditProduct = (product: Product) => {
        setEditingProduct({ ...product });
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
                    {products.map((product) => (
                        <Card key={product.id} className="hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <h4 className="font-semibold text-gray-900">{product.name}</h4>
                                        <p className="text-sm text-blue-600 font-medium">
                                            {formatPrice(product.price, product.currency)}
                                        </p>
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
                    ))}
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
                                    onClick={() => setEditingProduct(null)}
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Informations de base */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="product-name">Nom du produit</Label>
                                    <Input
                                        id="product-name"
                                        value={editingProduct.name}
                                        onChange={(e) => setEditingProduct(prev => ({
                                            ...prev!,
                                            name: e.target.value
                                        }))}
                                        placeholder="Ex: T-shirt personnalisé"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="product-price">Prix</Label>
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
                                    onClick={() => setEditingProduct(null)}
                                >
                                    Annuler
                                </Button>
                                <Button onClick={handleSaveProduct}>
                                    <Check className="w-4 h-4 mr-2" />
                                    Enregistrer
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
};

export default ProductManager;





