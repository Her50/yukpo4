// 📁 frontend/src/pages/PrestataireDashboard.tsx
import React from 'react';
import AppLayout from '@/components/layout/AppLayout';
import UrgentAlertPanel from '@/components/prestataire/UrgentAlertPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const PrestataireDashboard: React.FC = () => {
  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">👤 Espace Prestataire</h1>

        <Tabs defaultValue="urgences" className="space-y-6">
          <TabsList>
            <TabsTrigger value="urgences">🆘 Urgences</TabsTrigger>
            <TabsTrigger value="services">📦 Mes Services</TabsTrigger>
            <TabsTrigger value="profil">👤 Mon Profil</TabsTrigger>
          </TabsList>

          <TabsContent value="urgences">
            <UrgentAlertPanel />
          </TabsContent>

          <TabsContent value="services">
            <p className="text-gray-600">📦 Liste de vos services à venir ici.</p>
          </TabsContent>

          <TabsContent value="profil">
            <p className="text-gray-600">📝 Données de profil et informations personnelles.</p>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default PrestataireDashboard;
