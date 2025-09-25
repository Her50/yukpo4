// src/pages/StartPage.tsx
import React from 'react';
import { useNavigation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import AppLayout from '@/components/layout/AppLayout';

const StartPage = () => {
  const navigate = useNavigation();

  return (
    <AppLayout padding>
      <View style="min-h-screen flex flex-col items-center justify-center gap-6 bg-white dark:bg-gray-950 py-10">
        <h1 style="text-4xl font-bold text-center text-gray-800 dark:text-white mb-4">
          🎯 Démarrer avec Yukpo
        </h1>
        <p style="text-lg text-center max-w-xl text-gray-600 dark:text-gray-300">
          Dites-nous ce que vous cherchez ou proposez : Yukpo vous guide.
        </Text>
        <View style="grid gap-6 mt-8 w-full max-w-xl">
          <Card>
            <CardContent style="flex flex-col items-center p-6 gap-4">
              <h2 style="text-xl font-semibold">🎯 Je suis prestataire</h2>
              <TouchableOpacity onClick={() => navigation.navigate('/creation-smart-service')}>
                Créer ou gérer mes services
              </TouchableOpacity>
            </CardContent>
          </Card>
          <Card>
            <CardContent style="flex flex-col items-center p-6 gap-4">
              <h2 style="text-xl font-semibold">🔍 Je cherche une solution</h2>
              <TouchableOpacity onClick={() => navigation.navigate('/recherche-besoin')}>
                Exprimer mon besoin
              </TouchableOpacity>
            </CardContent>
          </Card>
          <Card>
            <CardContent style="flex flex-col items-center p-6 gap-4">
              <h2 style="text-xl font-semibold">🧠 Accès IA Yukpo</h2>
              <TouchableOpacity onClick={() => navigation.navigate('/ia-hub')}>
                Outils intelligents Yukpo
              </TouchableOpacity>
            </CardContent>
          </Card>
        </View>
      </View>
    </AppLayout>
  );
};

export default StartPage;

