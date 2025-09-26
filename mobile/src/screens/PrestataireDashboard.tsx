// 📁 frontend/src/pages/PrestataireDashboard.tsx
import React from 'react';
import { Text } from 'react-native';
import { View } from 'react-native';
import AppLayout from '@/components/layout/AppLayout';
import UrgentAlertPanel from '@/components/prestataire/UrgentAlertPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const PrestataireDashboard: React.FC = () => {
  return (
    <AppLayout>
      <View style="max-w-6xl mx-auto px-4 py-8">
        <Text style="text-3xl font-bold mb-6">👤 Espace Prestataire</Text>

        <Tabs defaultValue="urgences" style="space-y-6">
          <TabsList>
            <TabsTrigger value="urgences">🆘 Urgences</TabsTrigger>
            <TabsTrigger value="services">📦 Mes Services</TabsTrigger>
            <TabsTrigger value="profil">👤 Mon Profil</TabsTrigger>
          </TabsList>

          <TabsContent value="urgences">
            <UrgentAlertPanel />
          </TabsContent>

          <TabsContent value="services">
            <Text style="text-gray-600">📦 Liste de vos services à venir ici.</Text>
          </TabsContent>

          <TabsContent value="profil">
            <Text style="text-gray-600">📝 Données de profil et informations personnelles.</Text>
          </TabsContent>
        </Tabs>
      </View>
    </AppLayout>
  );
};

export default PrestataireDashboard;





