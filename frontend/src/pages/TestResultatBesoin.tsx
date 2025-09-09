import React from 'react';
import { useNavigate } from 'react-router-dom';

const TestResultatBesoin: React.FC = () => {
  const navigate = useNavigate();

  const testWithData = () => {
    const testResults = [
      {
        id: "test_1",
        score: 0.95,
        metadata: {
          ia_response: JSON.stringify({
            intention: "recherche_besoin",
            titre: { valeur: "Recherche d'un plombier" },
            description: { valeur: "L'utilisateur cherche un plombier pour des travaux de plomberie." },
            category: { valeur: "Plomberie" },
            reponse_intelligente: { valeur: "Nous vous recommandons de contacter un plombier professionnel." },
            suggestions_complementaires: {
              valeur: [
                {
                  service: { valeur: "Réparation de fuites" },
                  description: { valeur: "Service de réparation de fuites d'eau par un plombier qualifié." }
                },
                {
                  service: { valeur: "Installation de chauffe-eau" },
                  description: { valeur: "Installation professionnelle de chauffe-eau pour assurer un fonctionnement optimal." }
                }
              ]
            }
          }),
          service_id: 123
        }
      },
      {
        id: "test_2",
        score: 0.92,
        metadata: {
          ia_response: JSON.stringify({
            intention: "creation_service",
            data: {
              titre_service: { valeur: "Services de plomberie à Yaoundé" },
              description: { valeur: "Je propose des services de plomberie dans la ville de Yaoundé, incluant l'installation, la réparation et l'entretien de systèmes de plomberie." },
              category: { valeur: "Plomberie" }
            }
          }),
          service_id: 456
        }
      }
    ];

    navigate('/resultat-besoin', {
      state: {
        results: testResults,
        type: 'recherche_besoin'
      }
    });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-4">Test ResultatBesoin</h1>
      
      <div className="space-y-4">
        <button
          onClick={testWithData}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Tester avec données
        </button>
        
        <button
          onClick={() => navigate('/resultat-besoin')}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Tester sans données
        </button>
        
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
        >
          Retour à l'accueil
        </button>
      </div>
    </div>
  );
};

export default TestResultatBesoin; 