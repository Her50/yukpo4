import React from 'react';
import { LocationDisplay } from './LocationDisplay';

export const LocationDisplayDemo: React.FC = () => {
  // Données de test pour différents scénarios
  const testServices = [
    {
      id: 1,
      data: {
        gps_fixe: '3.848033,11.502075', // Coordonnées GPS de Yaoundé, Cameroun
        adresse: 'Yaoundé, Région du Centre, Cameroun'
      },
      user_id: 1
    },
    {
      id: 2,
      data: {
        gps_fixe: '4.0511,-9.7679', // Coordonnées GPS de Monrovia, Libéria
        adresse: 'Monrovia, Montserrado, Libéria'
      },
      user_id: 2
    },
    {
      id: 3,
      data: {
        gps_fixe: 'Non spécifié',
        adresse: 'Douala, Littoral, Cameroun'
      },
      user_id: 3
    },
    {
      id: 4,
      data: {
        gps_fixe: 'Non spécifié',
        adresse: 'Non spécifié'
      },
      user_id: 4
    },
    {
      id: 5,
      data: {
        gps_fixe: '48.8566,2.3522', // Paris, France
        adresse: 'Paris, Île-de-France, France'
      },
      user_id: 5
    },
    {
      id: 6,
      data: {
        gps_fixe: '40.7128,-74.0060', // New York, USA
        adresse: 'New York, NY, USA'
      },
      user_id: 6
    }
  ];

  const testPrestataires = new Map([
    [1, { gps: '3.848033,11.502075' }],
    [2, { gps: '4.0511,-9.7679' }],
    [3, { gps: '4.0511,9.7679' }], // Coordonnées GPS de Douala
    [4, { gps: 'Non spécifié' }],
    [5, { gps: '48.8566,2.3522' }],
    [6, { gps: '40.7128,-74.0060' }]
  ]);

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">
        🗺️ Démonstration LocationDisplay - Version Optimisée
      </h2>
      
      <div className="bg-green-50 p-4 rounded-lg mb-6">
        <h3 className="font-semibold text-green-800 mb-2">✨ Nouvelles fonctionnalités :</h3>
        <ul className="text-sm text-green-700 space-y-1">
          <li>✅ <strong>Pays et drapeau intégrés</strong> - Affichés directement après le nom du lieu</li>
          <li>✅ <strong>Niveau quartier</strong> - Géocodage jusqu'au niveau du quartier pour plus de précision</li>
          <li>✅ <strong>Google Maps optimisé</strong> - Chargement léger et centrage parfait sur le lieu</li>
                      <li>✅ <strong>Interface en 2 lignes</strong> - Icône et lieu sur la 1ère, détails sur la 2nde</li>
                      <li>✅ <strong>Affichage détaillé</strong> - Nom du lieu et drapeau et code pays en une ligne</li>
        </ul>
      </div>
      
      <div className="grid gap-4">
        {testServices.map((service, index) => (
          <div key={service.id} className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
            <h3 className="font-semibold text-gray-700 mb-2">
              Test {index + 1}: {service.data.adresse || 'Pas d\'adresse'}
            </h3>
            
            <div className="space-y-2">
              <div className="text-sm text-gray-600">
                <strong>GPS fixe:</strong> {service.data.gps_fixe}
              </div>
              
              <div className="text-sm text-gray-600">
                <strong>GPS prestataire:</strong> {testPrestataires.get(service.user_id)?.gps}
              </div>
              
              <div className="border-t pt-2">
                <strong>Affichage:</strong>
                <LocationDisplay 
                  service={service} 
                  prestataireInfo={testPrestataires.get(service.user_id)}
                  compact={false}
                  showMap={true}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-semibold text-blue-800 mb-2">🔧 Fonctionnalités techniques :</h3>
        <ul className="text-sm text-blue-700 space-y-1">
                      <li>✅ <strong>Géocodage niveau quartier</strong> - Priorité: neighbourhood puis sublocality puis locality</li>
          <li>✅ <strong>Pays et drapeau automatiques</strong> - Récupérés via Google Maps API</li>
          <li>✅ <strong>URL Google Maps simplifiée</strong> - Paramètres essentiels uniquement pour un chargement rapide</li>
          <li>✅ <strong>Zoom optimal (z=16)</strong> - Centrage parfait sur le lieu sans surcharge</li>
                      <li>✅ <strong>Fallback intelligent</strong> : Google Maps puis coordonnées puis adresse puis titre</li>
        </ul>
      </div>
      
      <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
        <h3 className="font-semibold text-yellow-800 mb-2">📍 Comment ça fonctionne maintenant :</h3>
        <ol className="text-sm text-yellow-700 space-y-1 list-decimal list-inside">
          <li>Le composant reçoit les données GPS et appelle l&apos;API Google Maps avec un niveau de détail élevé</li>
          <li>Il extrait le niveau quartier (neighbourhood) en priorité, puis sublocality, puis locality</li>
          <li>Il ajoute automatiquement le pays et le drapeau après le nom du lieu</li>
                      <li>Il affiche le tout sur 2 lignes : icône et lieu et pays/drapeau, puis détails complets</li>
          <li>Le bouton ouvre Google Maps avec une URL simplifiée pour un chargement rapide et un centrage parfait</li>
        </ol>
      </div>
      
      <div className="mt-6 p-4 bg-purple-50 rounded-lg">
        <h3 className="font-semibold text-purple-800 mb-2">🚀 Exemples d'affichage :</h3>
        <div className="text-sm text-purple-700 space-y-2">
          <div className="bg-white p-3 rounded border">
            <strong>Avant (niveau ville) :</strong> "Yaoundé, Cameroun"
          </div>
          <div className="bg-white p-3 rounded border">
            <strong>Maintenant (niveau quartier) :</strong> "Bastos, Yaoundé 🇨🇲 CM"
          </div>
          <div className="bg-white p-3 rounded border">
            <strong>Avant (niveau ville) :</strong> "Paris, France"
          </div>
          <div className="bg-white p-3 rounded border">
            <strong>Maintenant (niveau quartier) :</strong> "Le Marais, Paris 🇫🇷 FR"
          </div>
        </div>
      </div>
      
      <div className="mt-6 p-4 bg-indigo-50 rounded-lg">
        <h3 className="font-semibold text-indigo-800 mb-2">🎯 Optimisations Google Maps :</h3>
        <ul className="text-sm text-indigo-700 space-y-1">
          <li>🔧 <strong>URL simplifiée</strong> - Suppression des paramètres lourds qui ralentissaient le chargement</li>
          <li>🎯 <strong>Zoom optimal (z=16)</strong> - Parfait pour voir le lieu et ses environs immédiats</li>
          <li>⚡ <strong>Chargement rapide</strong> - Plus de paramètres complexes qui surchargent l'API</li>
          <li>📍 <strong>Centrage parfait</strong> - Le lieu est automatiquement centré sur la carte</li>
          <li>🌍 <strong>Langue française</strong> - Interface Google Maps en français</li>
        </ul>
      </div>
    </div>
  );
};

export default LocationDisplayDemo; 