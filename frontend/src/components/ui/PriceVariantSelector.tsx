/**
 * PriceVariantSelector pour le frontend web
 * Sélecteur de variantes de prix pour les produits avec variantes (taille, pointure, quantité, etc.)
 * Adapté depuis mobile/src/components/PriceVariantSelector.tsx
 */

import React, { useState, useCallback } from 'react';
import { Plus, Edit2, Trash2, X, ImageIcon, Upload } from 'lucide-react';
import { Button } from '@/components/ui/buttons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'react-hot-toast';
import { cloudUploadService } from '@/services/cloudUploadService';

export interface PriceModality {
    valeur: string; // Ex: "38", "39", "40", "M", "L"
    prix: number; // Prix numérique (jamais string)
    devise: string; // Ex: "XAF", "EUR"
    stock?: number; // Stock disponible (optionnel)
    image?: string; // Image spécifique à cette modalité (URL CDN ou base64)
}

interface PriceVariantSelectorProps {
    label?: string;
    variable?: string; // Ex: "pointure", "taille", "quantite"
    modalites: PriceModality[];
    onChange: (modalites: PriceModality[]) => void;
    required?: boolean;
    availableCurrencies?: string[]; // Devises disponibles
    defaultCurrency?: string; // Devise par défaut
    helperText?: string;
    showEmptyStateDetails?: boolean;
}

const CURRENCIES = [
    { code: 'XAF', name: 'Franc CFA (XAF)', symbol: 'FCFA' },
    { code: 'EUR', name: 'Euro (EUR)', symbol: '€' },
    { code: 'USD', name: 'Dollar US (USD)', symbol: '$' },
];

export const PriceVariantSelector: React.FC<PriceVariantSelectorProps> = ({
    label = 'Variantes de prix',
    variable = 'variante',
    modalites: modalitesProp,
    onChange,
    required = false,
    availableCurrencies = ['XAF', 'EUR', 'USD'],
    defaultCurrency = 'XAF',
    helperText,
    showEmptyStateDetails = true,
}) => {
    const modalites = modalitesProp || [];
    const [showModal, setShowModal] = useState(false);
    const [editingModality, setEditingModality] = useState<PriceModality | null>(null);
    const [editIndex, setEditIndex] = useState<number | null>(null);
    const [tempModality, setTempModality] = useState<Partial<PriceModality>>({
        valeur: '',
        prix: 0,
        devise: defaultCurrency,
        stock: undefined,
        image: undefined,
    });
    const [uploadingImage, setUploadingImage] = useState(false);

    // Ouvrir le modal pour ajouter une nouvelle modalité
    const openAddModal = useCallback(() => {
        setTempModality({
            valeur: '',
            prix: 0,
            devise: defaultCurrency,
            stock: undefined,
            image: undefined,
        });
        setEditingModality(null);
        setEditIndex(null);
        setShowModal(true);
    }, [defaultCurrency]);

    // Ouvrir le modal pour éditer une modalité existante
    const openEditModal = useCallback((modality: PriceModality, index: number) => {
        setTempModality({
            valeur: modality.valeur || '',
            prix: modality.prix || 0,
            devise: modality.devise || defaultCurrency,
            stock: modality.stock,
            image: modality.image,
        });
        setEditingModality(modality);
        setEditIndex(index);
        setShowModal(true);
    }, [defaultCurrency]);

    // Gérer l'upload d'image pour une modalité
    const handleImageUpload = useCallback(async (file: File) => {
        setUploadingImage(true);
        try {
            // Convertir en base64
            const reader = new FileReader();
            const base64 = await new Promise<string>((resolve, reject) => {
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            // Upload vers CDN
            const result = await cloudUploadService.uploadToCloud(base64, 'image', file.name);
            
            if (result.success && result.url) {
                setTempModality(prev => ({ ...prev, image: result.url }));
                toast.success('Image uploadée avec succès');
            } else {
                // Fallback base64
                setTempModality(prev => ({ ...prev, image: base64 }));
                toast.success('Image ajoutée (stockage local)');
            }
        } catch (error: any) {
            console.error('[PriceVariantSelector] Erreur upload image:', error);
            toast.error('Erreur lors de l\'upload de l\'image');
        } finally {
            setUploadingImage(false);
        }
    }, []);

    // Sauvegarder la modalité
    const saveModality = useCallback(() => {
        // Validation
        if (!tempModality.valeur || tempModality.valeur.trim() === '') {
            toast.error(`Veuillez entrer une valeur pour ${variable}`);
            return;
        }

        if (!tempModality.prix || tempModality.prix <= 0) {
            toast.error('Le prix doit être supérieur à 0');
            return;
        }

        if (!tempModality.devise) {
            toast.error('Veuillez sélectionner une devise');
            return;
        }

        // S'assurer que prix est un nombre
        const prix = typeof tempModality.prix === 'string' ? parseFloat(tempModality.prix) : tempModality.prix;
        if (isNaN(prix) || prix <= 0) {
            toast.error('Le prix doit être un nombre valide');
            return;
        }

        const newModality: PriceModality = {
            valeur: tempModality.valeur.trim(),
            prix: prix,
            devise: tempModality.devise!,
            stock: tempModality.stock && tempModality.stock > 0 ? tempModality.stock : undefined,
            image: tempModality.image,
        };

        const updated = [...modalites];
        if (editIndex !== null) {
            // Modifier existante
            updated[editIndex] = newModality;
        } else {
            // Ajouter nouvelle
            updated.push(newModality);
        }

        onChange(updated);
        setShowModal(false);
        toast.success(editIndex !== null ? 'Variante modifiée' : 'Variante ajoutée');
    }, [tempModality, editIndex, modalites, onChange, variable]);

    // Supprimer une modalité
    const removeModality = useCallback((index: number) => {
        const updated = modalites.filter((_, i) => i !== index);
        onChange(updated);
        toast.success('Variante supprimée');
    }, [modalites, onChange]);

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <Label>
                    {label} {required && <span className="text-red-600">*</span>}
                </Label>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={openAddModal}
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Ajouter une variante
                </Button>
            </div>

            {helperText && (
                <p className="text-xs text-gray-500">{helperText}</p>
            )}

            {/* Liste des modalités */}
            {modalites.length > 0 ? (
                <div className="space-y-2">
                    {modalites.map((modality, index) => (
                        <Card key={index} className="p-3">
                            <div className="flex items-center justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-gray-900">
                                            {modality.valeur}
                                        </span>
                                        <span className="text-sm text-gray-600">
                                            {modality.prix} {CURRENCIES.find(c => c.code === modality.devise)?.symbol || modality.devise}
                                        </span>
                                        {modality.stock !== undefined && (
                                            <span className="text-xs text-blue-600">
                                                (Stock: {modality.stock})
                                            </span>
                                        )}
                                    </div>
                                    {modality.image && (
                                        <div className="mt-2">
                                            <img
                                                src={modality.image}
                                                alt={modality.valeur}
                                                className="w-16 h-16 object-cover rounded border"
                                            />
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => openEditModal(modality, index)}
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removeModality(index)}
                                        className="text-red-600 hover:text-red-700"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            ) : (
                showEmptyStateDetails && (
                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
                        <p className="font-medium mb-1">Aucune variante de prix définie</p>
                        <p className="text-xs">
                            Ajoutez des variantes pour permettre aux clients de choisir différentes options (taille, pointure, quantité, etc.)
                        </p>
                    </div>
                )
            )}

            {/* Modal d'édition/ajout */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-md">
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                                {editIndex !== null ? 'Modifier la variante' : 'Nouvelle variante'}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setShowModal(false)}
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Valeur */}
                            <div>
                                <Label>
                                    Valeur ({variable}) <span className="text-red-600">*</span>
                                </Label>
                                <Input
                                    placeholder={`Ex: "38", "M", "1kg"`}
                                    value={tempModality.valeur || ''}
                                    onChange={(e) => setTempModality(prev => ({ ...prev, valeur: e.target.value }))}
                                />
                            </div>

                            {/* Prix */}
                            <div>
                                <Label>
                                    Prix <span className="text-red-600">*</span>
                                </Label>
                                <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="0"
                                    value={tempModality.prix || 0}
                                    onChange={(e) => setTempModality(prev => ({ 
                                        ...prev, 
                                        prix: parseFloat(e.target.value) || 0 
                                    }))}
                                />
                            </div>

                            {/* Devise */}
                            <div>
                                <Label>
                                    Devise <span className="text-red-600">*</span>
                                </Label>
                                <Select
                                    value={tempModality.devise || defaultCurrency}
                                    onValueChange={(value) => setTempModality(prev => ({ ...prev, devise: value }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableCurrencies.map(currency => {
                                            const currencyInfo = CURRENCIES.find(c => c.code === currency);
                                            return (
                                                <SelectItem key={currency} value={currency}>
                                                    {currencyInfo ? `${currencyInfo.symbol} - ${currencyInfo.name}` : currency}
                                                </SelectItem>
                                            );
                                        })}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Stock (optionnel) */}
                            <div>
                                <Label>Stock disponible (optionnel)</Label>
                                <Input
                                    type="number"
                                    min="0"
                                    placeholder="Laisser vide si illimité"
                                    value={tempModality.stock || ''}
                                    onChange={(e) => setTempModality(prev => ({ 
                                        ...prev, 
                                        stock: e.target.value ? parseInt(e.target.value) : undefined 
                                    }))}
                                />
                            </div>

                            {/* Image (optionnel) */}
                            <div>
                                <Label>Image spécifique (optionnel)</Label>
                                {tempModality.image ? (
                                    <div className="mt-2 relative">
                                        <img
                                            src={tempModality.image}
                                            alt="Preview"
                                            className="w-24 h-24 object-cover rounded border"
                                        />
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="absolute -top-2 -right-2"
                                            onClick={() => setTempModality(prev => ({ ...prev, image: undefined }))}
                                        >
                                            <X className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ) : (
                                    <label className="mt-2 cursor-pointer">
                                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-500 transition-colors">
                                            {uploadingImage ? (
                                                <div className="text-sm text-gray-600">Upload en cours...</div>
                                            ) : (
                                                <>
                                                    <Upload className="w-6 h-6 mx-auto mb-2 text-gray-400" />
                                                    <div className="text-sm text-gray-600">Cliquer pour uploader</div>
                                                </>
                                            )}
                                        </div>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            hidden
                                            disabled={uploadingImage}
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) handleImageUpload(file);
                                            }}
                                        />
                                    </label>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2 pt-4">
                                <Button
                                    variant="outline"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1"
                                >
                                    Annuler
                                </Button>
                                <Button
                                    onClick={saveModality}
                                    className="flex-1"
                                >
                                    {editIndex !== null ? 'Modifier' : 'Ajouter'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
};

