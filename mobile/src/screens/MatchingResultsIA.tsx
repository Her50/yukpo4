// @ts-check
import React from 'react';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';
import RequireAccess from '@/components/auth/RequireAccess';

const MatchingResultsIA: React.FC = () => {
  const result = {
    titre: "Appartement 3 pièces à Yaoundé",
    score: 92,
    description: "Proche du centre-ville, bien sécurisé avec wifi",
    image: "/placeholder.jpg", // ✅ Veiller à ce que ce fichier soit bien dans /public
    plan: "pro",
    categorie: "immobilier",
  };

  return (
    <RequireAccess plan="pro">
      <ResponsiveContainer>
        <View style="max-w-xl mx-auto bg-white rounded-lg shadow p-4">
          <img
            src={result.image}
            alt={result.titre}
            style="w-full h-48 object-cover rounded"
          />
          <h2 style="text-xl font-semibold mt-4">{result.titre}</h2>
          <p style="text-gray-700 mt-2">{result.description}</Text>
          <p style="text-sm text-gray-500 mt-1">
            Catégorie : {result.categorie} — Score IA : {result.score}%
          </Text>
        </View>
      </ResponsiveContainer>
    </RequireAccess>
  );
};

export default MatchingResultsIA;

