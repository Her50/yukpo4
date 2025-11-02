// Composant pour gérer PLUSIEURS vecteurs de caractéristiques produit
// Permet d'ajouter, modifier, supprimer plusieurs produits avec leurs caractéristiques
import { Button } from '@/components/ui/button';
import { AlertCircle, Check, Edit2, Plus, Sparkles, X } from 'lucide-react';
import React, { useState } from 'react';
import { IntelligentCharacteristicsSearch } from './IntelligentCharacteristicsSearch';

interface ProductCharacteristic {
    id: string;
    vector: string; // Ex: "Nike,Air Max,Noir,42"
    isFromAI: boolean; // Si sélectionné depuis suggestions IA
    isAIPreferred: boolean; // Si c'est la combinaison préférée de l'IA
}

interface MultiCharacteristicsManagerProps {
    characteristics: ProductCharacteristic[];
    onChange: (characteristics: ProductCharacteristic[]) => void;
    sessionId?: string;
    userLocation?: string;
    separateur?: string;
    label?: string;
    maxCharacteristics?: number; // Limite du nombre de produits
    readonly?: boolean;
}

export const MultiCharacteristicsManager: React.FC<MultiCharacteristicsManagerProps> = ({
    characteristics,
    onChange,
    sessionId,
    userLocation,
    separateur = ',',
    label = 'Produits / Caractéristiques',
    maxCharacteristics = 10,
    readonly = false,
}) => {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newVector, setNewVector] = useState('');

    // Ajouter une nouvelle caractéristique
    const handleAdd = () => {
        if (!newVector.trim()) return;

        const newCharacteristic: ProductCharacteristic = {
            id: Date.now().toString(),
            vector: newVector.trim(),
            isFromAI: false,
            isAIPreferred: false,
        };

        onChange([...characteristics, newCharacteristic]);
        setNewVector('');
        setShowAddForm(false);
    };

    // Sélectionner depuis suggestions IA
    const handleSelectFromAI = (combination: any) => {
        const vectorString = combination.product_vector.join(separateur);

        const newCharacteristic: ProductCharacteristic = {
            id: Date.now().toString(),
            vector: vectorString,
            isFromAI: true,
            isAIPreferred: combination.is_ai_preferred || false,
        };

        onChange([...characteristics, newCharacteristic]);
        setShowAddForm(false);
    };

    // Supprimer une caractéristique
    const handleRemove = (id: string) => {
        onChange(characteristics.filter(c => c.id !== id));
    };

    // Modifier une caractéristique
    const handleEdit = (id: string, newVector: string) => {
        onChange(
            characteristics.map(c =>
                c.id === id ? { ...c, vector: newVector.trim() } : c
            )
        );
        setEditingId(null);
    };

    // Analyser le vecteur pour affichage
    const parseVector = (vector: string) => {
        return vector.split(separateur).filter(v => v.trim());
    };

    return (
        <div className="w-full space-y-4">
            {/* En-tête */}
            <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-gray-700">
                    {label}
                    {characteristics.length > 0 && (
                        <span className="ml-2 text-xs font-normal text-gray-500">
                            ({characteristics.length} produit{characteristics.length > 1 ? 's' : ''})
                        </span>
                    )}
                </label>

                {!readonly && characteristics.length < maxCharacteristics && (
                    <Button
                        type="button"
                        onClick={() => setShowAddForm(!showAddForm)}
                        size="sm"
                        variant="outline"
                        className="flex items-center gap-1"
                    >
                        <Plus className="w-4 h-4" />
                        Ajouter un produit
                    </Button>
                )}
            </div>

            {/* Liste des caractéristiques */}
            {characteristics.length > 0 && (
                <div className="space-y-2">
                    {characteristics.map((char, index) => (
                        <div
                            key={char.id}
                            className={`p-3 rounded-lg border ${char.isAIPreferred
                                ? 'bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-300'
                                : char.isFromAI
                                    ? 'bg-blue-50 border-blue-200'
                                    : 'bg-white border-gray-200'
                                }`}
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                    {/* Numéro du produit */}
                                    <div className="text-xs font-semibold text-gray-500 mb-1">
                                        Produit #{index + 1}
                                        {char.isAIPreferred && (
                                            <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 bg-amber-200 text-amber-800 rounded-full">
                                                <Sparkles className="w-3 h-3" />
                                                Recommandé IA
                                            </span>
                                        )}
                                        {char.isFromAI && !char.isAIPreferred && (
                                            <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 bg-blue-200 text-blue-800 rounded-full text-xs">
                                                Suggestion IA
                                            </span>
                                        )}
                                    </div>

                                    {/* Edition du vecteur */}
                                    {editingId === char.id ? (
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                defaultValue={char.vector}
                                                onBlur={(e) => handleEdit(char.id, e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        handleEdit(char.id, e.currentTarget.value);
                                                    } else if (e.key === 'Escape') {
                                                        setEditingId(null);
                                                    }
                                                }}
                                                autoFocus
                                                className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            />
                                            <button
                                                onClick={() => setEditingId(null)}
                                                className="p-1 hover:bg-gray-100 rounded"
                                            >
                                                <Check className="w-4 h-4 text-green-600" />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex flex-wrap gap-1.5 items-center">
                                            {parseVector(char.vector).map((part, idx) => (
                                                <span
                                                    key={idx}
                                                    className="inline-flex items-center px-2 py-1 bg-white border border-gray-300 rounded text-xs font-medium text-gray-700"
                                                >
                                                    {part}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                {!readonly && (
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        {editingId !== char.id && (
                                            <button
                                                onClick={() => setEditingId(char.id)}
                                                className="p-1.5 hover:bg-white rounded transition-colors"
                                                title="Modifier"
                                            >
                                                <Edit2 className="w-4 h-4 text-gray-600" />
                                            </button>
                                        )}

                                        <button
                                            onClick={() => handleRemove(char.id)}
                                            className="p-1.5 hover:bg-red-50 rounded transition-colors"
                                            title="Supprimer"
                                        >
                                            <X className="w-4 h-4 text-red-600" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Formulaire d'ajout */}
            {showAddForm && !readonly && (
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-gray-700">
                            Ajouter un nouveau produit
                        </h4>
                        <button
                            onClick={() => {
                                setShowAddForm(false);
                                setNewVector('');
                            }}
                            className="text-gray-400 hover:text-gray-600"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <IntelligentCharacteristicsSearch
                        value={newVector}
                        onChange={setNewVector}
                        sessionId={sessionId}
                        userLocation={userLocation}
                        separateur={separateur}
                        label=""
                        onCombinationsReady={(combinations) => {
                            // Callback optionnel quand combinaisons chargées
                            console.log('[MultiManager] Combinaisons disponibles:', combinations.length);
                        }}
                    />

                    <div className="flex gap-2 mt-3">
                        <Button
                            type="button"
                            onClick={handleAdd}
                            disabled={!newVector.trim()}
                            size="sm"
                            className="flex items-center gap-1"
                        >
                            <Check className="w-4 h-4" />
                            Ajouter
                        </Button>

                        <Button
                            type="button"
                            onClick={() => {
                                setShowAddForm(false);
                                setNewVector('');
                            }}
                            size="sm"
                            variant="outline"
                        >
                            Annuler
                        </Button>
                    </div>
                </div>
            )}

            {/* Message si vide */}
            {characteristics.length === 0 && !showAddForm && !readonly && (
                <div className="p-6 border-2 border-dashed border-gray-300 rounded-lg text-center">
                    <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600 mb-3">
                        Aucun produit ajouté pour le moment
                    </p>
                    <Button
                        type="button"
                        onClick={() => setShowAddForm(true)}
                        size="sm"
                        variant="outline"
                        className="flex items-center gap-1 mx-auto"
                    >
                        <Plus className="w-4 h-4" />
                        Ajouter votre premier produit
                    </Button>
                </div>
            )}

            {/* Limite atteinte */}
            {characteristics.length >= maxCharacteristics && !readonly && (
                <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2 flex items-start gap-2">
                    <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                    <span>
                        Limite atteinte : {maxCharacteristics} produits maximum. Supprimez-en un pour en ajouter d'autres.
                    </span>
                </div>
            )}
        </div>
    );
};

export default MultiCharacteristicsManager;

