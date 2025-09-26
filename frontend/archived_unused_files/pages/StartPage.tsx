// src/pages/StartPage.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import AppLayout from '@/components/layout/AppLayout';

const StartPage = () => {
  const navigate = useNavigate();

  return (
    <AppLayout padding>
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-white dark:bg-gray-950 py-10">
        <h1 className="text-4xl font-bold text-center text-gray-800 dark:text-white mb-4">
          🎯 Démarrer avec Yukpo
        </h1>
        <p className="text-lg text-center max-w-xl text-gray-600 dark:text-gray-300">
          Dites-nous ce que vous cherchez ou proposez : Yukpo vous guide.
        </p>
        <div className="grid gap-6 mt-8 w-full max-w-xl">
          <Card>
            <CardContent className="flex flex-col items-center p-6 gap-4">
              <h2 className="text-xl font-semibold">🎯 Je suis prestataire</h2>
              <Button onClick={() => navigate('/creation-smart-service')}>
                Créer ou gérer mes services
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col items-center p-6 gap-4">
              <h2 className="text-xl font-semibold">🔍 Je cherche une solution</h2>
              <Button onClick={() => navigate('/recherche-besoin')}>
                Exprimer mon besoin
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col items-center p-6 gap-4">
              <h2 className="text-xl font-semibold">🧠 Accès IA Yukpo</h2>
              <Button onClick={() => navigate('/ia-hub')}>
                Outils intelligents Yukpo
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default StartPage;
