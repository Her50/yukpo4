// @ts-check
import React from 'react';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';
import RequireAccess from '@/components/auth/RequireAccess';

interface Reco {
  type: string;
  conseil: string;
}

const recoData: Reco[] = [
  { type: 'marché', conseil: 'Investir davantage dans les villes secondaires.' },
  { type: 'contenu', conseil: 'Publier aux heures de forte audience détectées (12h-13h, 19h-21h).' },
  { type: 'audience', conseil: 'Cibler davantage les jeunes professionnels mobiles.' },
];

const StrategicRecoPanel: React.FC = () => {
  const handleExport = (type: string) => {
    if (type === 'pdf') alert('📄 Génération PDF simulée...');
    if (type === 'whatsapp') alert('📲 Envoi WhatsApp simulé...');
  };

  return (
    <ResponsiveContainer>
      <View style="pt-24 font-sans">
        <h1 style="text-3xl font-bold text-center mb-10">
          🧠 Recommandations Stratégiques Yukpomnang
        </h1>

        <View style="space-y-4">
          {recoData.map((r, i) => (
            <View key={i} style="bg-gray-50 border-l-4 border-orange-500 p-4 rounded shadow-sm">
              <p style="text-sm text-gray-500 mb-1 uppercase font-semibold">{r.type}</Text>
              <p style="text-lg text-gray-800 font-medium">{r.conseil}</Text>
            </View>
          ))}
        </View>

        <View style="mt-10 text-center">
          <RequireAccess plan="enterprise">
            <View style="flex flex-col sm:flex-row gap-4 justify-center">
              <TouchableOpacity
                onClick={() => handleExport('pdf')}
                style="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
              >
                📄 Exporter en PDF
              </TouchableOpacity>
              <TouchableOpacity
                onClick={() => handleExport('whatsapp')}
                style="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
              >
                📲 Envoyer par WhatsApp
              </TouchableOpacity>
            </View>
          </RequireAccess>
        </View>
      </View>
    </ResponsiveContainer>
  );
};

export default StrategicRecoPanel;

