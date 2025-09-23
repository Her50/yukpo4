import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit3 } from 'lucide-react';
import PaymentMethodIcons from './PaymentMethodIcons';
import { Button } from '../ui/buttons/Button';
import { Card, CardContent } from '../ui/card';

interface SavedPaymentMethod {
  id: string;
  type: 'mobile' | 'card' | 'bank';
  name: string;
  details: string; // Numéro de téléphone masqué ou 4 derniers chiffres de carte
  isDefault: boolean;
  lastUsed?: string;
}

interface SavedPaymentMethodsProps {
  onSelectMethod: (method: SavedPaymentMethod) => void;
  onAddNew: () => void;
  selectedMethodId?: string;
}

const SavedPaymentMethods: React.FC<SavedPaymentMethodsProps> = ({
  onSelectMethod,
  onAddNew,
  selectedMethodId
}) => {
  const [savedMethods, setSavedMethods] = useState<SavedPaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);

  // Charger les moyens de paiement sauvegardés
  useEffect(() => {
    const loadSavedMethods = async () => {
      try {
        // Simuler le chargement depuis l'API
        const token = localStorage.getItem('token');
        if (!token) {
          setLoading(false);
          return;
        }

        // Pour l'instant, utiliser des données d'exemple
        // TODO: Remplacer par un appel API réel
        const mockMethods: SavedPaymentMethod[] = [
          {
            id: '1',
            type: 'mobile',
            name: 'MTN Mobile Money',
            details: '*** *** 1234',
            isDefault: true,
            lastUsed: '2024-01-15'
          },
          {
            id: '2',
            type: 'card',
            name: 'Visa **** 5678',
            details: '**** **** **** 5678',
            isDefault: false,
            lastUsed: '2024-01-10'
          }
        ];

        setSavedMethods(mockMethods);
      } catch (error) {
        console.error('Erreur lors du chargement des moyens de paiement:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSavedMethods();
  }, []);

  const handleDelete = async (methodId: string) => {
    try {
      // TODO: Appel API pour supprimer le moyen de paiement
      setSavedMethods(prev => prev.filter(method => method.id !== methodId));
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
    }
  };

  const handleSetDefault = async (methodId: string) => {
    try {
      // TODO: Appel API pour définir comme moyen par défaut
      setSavedMethods(prev => 
        prev.map(method => ({
          ...method,
          isDefault: method.id === methodId
        }))
      );
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
        <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
        <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
      </div>
    );
  }

  if (savedMethods.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-500 mb-4">
          <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
          <p>Aucun moyen de paiement sauvegardé</p>
        </div>
        <Button onClick={onAddNew} className="w-full">
          <Plus className="w-4 h-4 mr-2" />
          Ajouter un moyen de paiement
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">Moyens de paiement sauvegardés</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={onAddNew}
          className="text-xs"
        >
          <Plus className="w-3 h-3 mr-1" />
          Ajouter
        </Button>
      </div>

      <div className="space-y-2">
        {savedMethods.map((method) => (
          <Card
            key={method.id}
            className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
              selectedMethodId === method.id
                ? 'ring-2 ring-blue-500 bg-blue-50'
                : 'hover:bg-gray-50'
            }`}
            onClick={() => onSelectMethod(method)}
          >
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    <PaymentMethodIcons method={method.name} className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {method.name}
                      </p>
                      {method.isDefault && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                          Défaut
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">{method.details}</p>
                    {method.lastUsed && (
                      <p className="text-xs text-gray-400">
                        Dernière utilisation: {new Date(method.lastUsed).toLocaleDateString('fr-FR')}
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center space-x-1">
                  {!method.isDefault && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSetDefault(method.id);
                      }}
                      className="text-xs p-1 h-6 w-6"
                      title="Définir par défaut"
                    >
                      <Edit3 className="w-3 h-3" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(method.id);
                    }}
                    className="text-xs p-1 h-6 w-6 text-red-500 hover:text-red-700"
                    title="Supprimer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default SavedPaymentMethods;
