import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/buttons';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Edit2, Save, X, Package, DollarSign, Hash } from 'lucide-react';

interface Produit {
  nom: string;
  categorie: string;
  quantite: number;
  unite: string;
  prix: {
    montant: number;
    devise: string;
  };
  marque?: string;
}

interface ProductListManagerProps {
  value: Produit[];
  onChange: (produits: Produit[]) => void;
  label?: string;
  readonly?: boolean;
}

const categories = ['Alimentaire', 'Électronique', 'Vêtements', 'Maison', 'Santé', 'Service', 'Transport', 'Éducation', 'Fournitures scolaires', 'Autre'];
const unites = ['pièce', 'kg', 'g', 'l', 'ml', 'm', 'cm', 'm²', 'm³', 'heure', 'jour', 'mois', 'année', 'lot', 'carton'];
const devises = ['XAF', 'EUR', 'USD'];

const ProductListManager: React.FC<ProductListManagerProps> = ({
  value = [],
  onChange,
  label = 'Liste des produits',
  readonly = false
}) => {
  const [produits, setProduits] = useState<Produit[]>(value);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingProduit, setEditingProduit] = useState<Produit | null>(null);
  const [newProduit, setNewProduit] = useState<Produit>({
    nom: '',
    categorie: 'Autre',
    quantite: 1,
    unite: 'pièce',
    prix: { montant: 0, devise: 'XAF' }
  });

  useEffect(() => {
    // Assurer que tous les produits ont une structure valide
    const produitsValides = Array.isArray(value) ? value.map(produit => ({
      ...produit,
      prix: produit.prix || { montant: 0, devise: 'XAF' },
      nom: produit.nom || '',
      categorie: produit.categorie || 'Autre',
      quantite: produit.quantite || 1,
      unite: produit.unite || 'pièce',
      marque: produit.marque || ''
    })) : [];
    
    setProduits(produitsValides);
  }, [value]);

  const ajouterProduit = () => {
    if (!newProduit.nom.trim()) return;
    
    const nouveauxProduits = [...produits, { ...newProduit }];
    setProduits(nouveauxProduits);
    onChange(nouveauxProduits);
    setNewProduit({
      nom: '',
      categorie: 'Autre',
      quantite: 1,
      unite: 'pièce',
      prix: { montant: 0, devise: 'XAF' }
    });
  };

  const supprimerProduit = (index: number) => {
    const nouveauxProduits = produits.filter((_, i) => i !== index);
    setProduits(nouveauxProduits);
    onChange(nouveauxProduits);
  };

  const modifierProduit = (index: number, produit: Produit) => {
    const nouveauxProduits = [...produits];
    nouveauxProduits[index] = produit;
    setProduits(nouveauxProduits);
    onChange(nouveauxProduits);
    setEditingIndex(null);
    setEditingProduit(null);
  };

  const commencerEdition = (index: number) => {
    setEditingIndex(index);
    setEditingProduit({ ...produits[index] });
  };

  const sauvegarderEdition = () => {
    if (editingIndex !== null && editingProduit) {
      modifierProduit(editingIndex, editingProduit);
    }
  };

  const annulerEdition = () => {
    setEditingIndex(null);
    setEditingProduit(null);
  };

  // Composant de carte produit moderne
  const ProductCard = useCallback(({ produit, index, isEditing }: { 
    produit: Produit; 
    index: number; 
    isEditing: boolean; 
  }) => {
    const produitValide = {
      ...produit,
      prix: produit.prix || { montant: 0, devise: 'XAF' },
      nom: produit.nom || '',
      categorie: produit.categorie || 'Autre',
      quantite: produit.quantite || 1,
      unite: produit.unite || 'pièce',
      marque: produit.marque || ''
    };

    if (isEditing && editingProduit) {
      return (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-lg p-4 shadow-lg">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-semibold text-blue-800 mb-1 block">Nom du produit</label>
              <Input
                value={editingProduit.nom}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setEditingProduit({ ...editingProduit, nom: e.target.value });
                }}
                placeholder="Nom du produit"
                className="w-full text-sm border-blue-200 focus:border-blue-400"
              />
            </div>
            
            <div>
              <label className="text-xs font-semibold text-blue-800 mb-1 block">Catégorie</label>
              <select
                value={editingProduit.categorie}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                  setEditingProduit({ ...editingProduit, categorie: e.target.value });
                }}
                className="w-full text-sm px-2 py-1 border border-blue-200 rounded focus:border-blue-400"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-blue-800 mb-1 block">Marque</label>
              <Input
                value={editingProduit.marque || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setEditingProduit({ ...editingProduit, marque: e.target.value });
                }}
                placeholder="Marque"
                className="w-full text-sm border-blue-200 focus:border-blue-400"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-blue-800 mb-1 block">Quantité</label>
              <div className="flex gap-1">
                <Input
                  type="number"
                  value={editingProduit.quantite}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    setEditingProduit({ ...editingProduit, quantite: parseInt(e.target.value) || 1 });
                  }}
                  className="w-16 text-sm border-blue-200 focus:border-blue-400"
                  min={1}
                />
                <select
                  value={editingProduit.unite}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                    setEditingProduit({ ...editingProduit, unite: e.target.value });
                  }}
                  className="w-20 text-sm px-1 py-1 border border-blue-200 rounded focus:border-blue-400"
                >
                  {unites.map(u => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-blue-800 mb-1 block">Prix</label>
              <div className="flex gap-1">
                <Input
                  type="number"
                  value={editingProduit.prix?.montant || 0}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    setEditingProduit({
                      ...editingProduit,
                      prix: { ...(editingProduit.prix || {}), montant: parseFloat(e.target.value) || 0 }
                    });
                  }}
                  className="w-20 text-sm border-blue-200 focus:border-blue-400"
                  min={0}
                />
                <select
                  value={editingProduit.prix?.devise || 'XAF'}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                    setEditingProduit({
                      ...editingProduit,
                      prix: { ...(editingProduit.prix || {}), devise: e.target.value }
                    });
                  }}
                  className="w-16 text-sm px-1 py-1 border border-blue-200 rounded focus:border-blue-400"
                >
                  {devises.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="flex gap-2 mt-3">
            <Button
              onClick={sauvegarderEdition}
              className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 text-xs flex items-center gap-1"
            >
              <Save className="w-3 h-3" />
              Sauvegarder
            </Button>
            <Button
              onClick={annulerEdition}
              className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 text-xs flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              Annuler
            </Button>
          </div>
        </div>
      );
    }

    // Affichage en lecture seule avec design moderne
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-all duration-200">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-4 h-4 text-blue-600" />
              <h3 className="font-semibold text-gray-800 text-sm">{produitValide.nom}</h3>
              {produitValide.marque && (
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                  {produitValide.marque}
                </span>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-xs text-gray-600">
              <div className="flex items-center gap-1">
                <Hash className="w-3 h-3 text-green-600" />
                <span className="font-medium">{produitValide.quantite} {produitValide.unite}</span>
              </div>
              
              <div className="flex items-center gap-1">
                <DollarSign className="w-3 h-3 text-orange-600" />
                <span className="font-medium">
                  {produitValide.prix.montant.toLocaleString()} {produitValide.prix.devise}
                </span>
              </div>
            </div>
            
            <div className="mt-2">
              <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                {produitValide.categorie}
              </span>
            </div>
          </div>
          
          {!readonly && (
            <div className="flex gap-1">
              <Button
                onClick={() => commencerEdition(index)}
                className="bg-blue-600 hover:bg-blue-700 text-white p-1 text-xs"
                size="sm"
              >
                <Edit2 className="w-3 h-3" />
              </Button>
              <Button
                onClick={() => supprimerProduit(index)}
                className="bg-red-600 hover:bg-red-700 text-white p-1 text-xs"
                size="sm"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }, [editingProduit, readonly]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
          <Package className="w-4 h-4 text-blue-600" />
          {label} ({produits.length})
        </h3>
      </div>

      {/* Liste des produits en cartes */}
      <div className="grid gap-3">
        {produits.map((produit, index) => (
          <ProductCard
            key={index}
            produit={produit}
            index={index}
            isEditing={editingIndex === index}
          />
        ))}
      </div>

      {/* Formulaire d'ajout de produit */}
      {!readonly && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="font-semibold text-gray-700 text-sm mb-3 flex items-center gap-2">
            <Plus className="w-4 h-4 text-green-600" />
            Ajouter un produit
          </h4>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-semibold text-gray-700 mb-1 block">Nom du produit</label>
              <Input
                value={newProduit.nom}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setNewProduit({ ...newProduit, nom: e.target.value });
                }}
                placeholder="Nom du produit"
                className="w-full text-sm"
              />
            </div>
            
            <div>
              <label className="text-xs font-semibold text-gray-700 mb-1 block">Catégorie</label>
              <select
                value={newProduit.categorie}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                  setNewProduit({ ...newProduit, categorie: e.target.value });
                }}
                className="w-full text-sm px-2 py-1 border rounded"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700 mb-1 block">Marque</label>
              <Input
                value={newProduit.marque || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setNewProduit({ ...newProduit, marque: e.target.value });
                }}
                placeholder="Marque"
                className="w-full text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700 mb-1 block">Quantité</label>
              <div className="flex gap-1">
                <Input
                  type="number"
                  value={newProduit.quantite}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    setNewProduit({ ...newProduit, quantite: parseInt(e.target.value) || 1 });
                  }}
                  className="w-16 text-sm"
                  min={1}
                />
                <select
                  value={newProduit.unite}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                    setNewProduit({ ...newProduit, unite: e.target.value });
                  }}
                  className="w-20 text-sm px-1 py-1 border rounded"
                >
                  {unites.map(u => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700 mb-1 block">Prix</label>
              <div className="flex gap-1">
                <Input
                  type="number"
                  value={newProduit.prix.montant}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    setNewProduit({
                      ...newProduit,
                      prix: { ...newProduit.prix, montant: parseFloat(e.target.value) || 0 }
                    });
                  }}
                  className="w-20 text-sm"
                  min={0}
                />
                <select
                  value={newProduit.prix.devise}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                    setNewProduit({
                      ...newProduit,
                      prix: { ...newProduit.prix, devise: e.target.value }
                    });
                  }}
                  className="w-16 text-sm px-1 py-1 border rounded"
                >
                  {devises.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <Button
            onClick={ajouterProduit}
            disabled={!newProduit.nom.trim()}
            className="mt-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 text-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Ajouter le produit
          </Button>
        </div>
      )}
    </div>
  );
};

export default ProductListManager;
