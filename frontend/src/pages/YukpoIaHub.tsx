// src/pages/YukpoIaHub.tsx
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/buttons';

const YukpoIaHub = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen p-8 bg-white">
      <h1 className="text-3xl font-bold text-center text-gray-800 mb-8">Centre de solutions Yukpo</h1>
      <p className="text-center text-gray-600 mb-6">
        Yukpo met à votre disposition des outils puissants pour analyser, générer, orienter ou anticiper vos besoins.
      </p>
      <div className="grid gap-6 max-w-4xl mx-auto">
        <Card>
          <CardContent className="p-6 flex flex-col gap-4">
            <h2 className="text-xl font-semibold">🔎 Générateur de contenu intelligent</h2>
            <p>Rédigez des descriptions, des annonces ou des publications automatiquement grâce à Yukpo.</p>
            <Button onClick={() => navigate('/outil/contenu')}>Accéder</Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex flex-col gap-4">
            <h2 className="text-xl font-semibold">📊 Analyse de vos services</h2>
            <p>Comprenez l’impact de vos services grâce aux analyses avancées de Yukpo.</p>
            <Button onClick={() => navigate('/dashboardia')}>Explorer</Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex flex-col gap-4">
            <h2 className="text-xl font-semibold">🎙️ Assistant vocal Yukpo</h2>
            <p>Exprimez vos demandes oralement, Yukpo les comprend et vous guide.</p>
            <Button onClick={() => navigate('/vocal-assistant')}>Lancer</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default YukpoIaHub;
