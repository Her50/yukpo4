// src/pages/YukpoIaHub.tsx
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useNavigation } from 'react-router-dom';
import { Button } from '@/components/ui/buttons';

const YukpoIaHub = () => {
  const navigate = useNavigation();

  return (
    <View style="min-h-screen p-8 bg-white">
      <h1 style="text-3xl font-bold text-center text-gray-800 mb-8">Centre de solutions Yukpo</h1>
      <p style="text-center text-gray-600 mb-6">
        Yukpo met à votre disposition des outils puissants pour analyser, générer, orienter ou anticiper vos besoins.
      </Text>
      <View style="grid gap-6 max-w-4xl mx-auto">
        <Card>
          <CardContent style="p-6 flex flex-col gap-4">
            <h2 style="text-xl font-semibold">🔎 Générateur de contenu intelligent</h2>
            <Text>Rédigez des descriptions, des annonces ou des publications automatiquement grâce à Yukpo.</Text>
            <TouchableOpacity onClick={() => navigation.navigate('/outil/contenu')}>Accéder</TouchableOpacity>
          </CardContent>
        </Card>
        <Card>
          <CardContent style="p-6 flex flex-col gap-4">
            <h2 style="text-xl font-semibold">📊 Analyse de vos services</h2>
            <Text>Comprenez l’impact de vos services grâce aux analyses avancées de Yukpo.</Text>
            <TouchableOpacity onClick={() => navigation.navigate('/dashboardia')}>Explorer</TouchableOpacity>
          </CardContent>
        </Card>
        <Card>
          <CardContent style="p-6 flex flex-col gap-4">
            <h2 style="text-xl font-semibold">🎙️ Assistant vocal Yukpo</h2>
            <Text>Exprimez vos demandes oralement, Yukpo les comprend et vous guide.</Text>
            <TouchableOpacity onClick={() => navigation.navigate('/vocal-assistant')}>Lancer</TouchableOpacity>
          </CardContent>
        </Card>
      </View>
    </View>
  );
};

export default YukpoIaHub;

