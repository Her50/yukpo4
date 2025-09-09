import React, { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import FicheApercu from '@/components/ai/FicheApercu';
import ValidationPanel from '@/components/ai/ValidationPanel';
import IARecorder from '@/components/ai/IARecorder';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

const IADashboard: React.FC = () => {
  const [valeurs, setValeurs] = useState<Record<string, any>>({
    nom: 'Service de nettoyage',
    localisation: 'Bonapriso, Douala',
    prix: 15000,
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">🧠 Espace IA Yukpo</h1>
      <Tabs defaultValue="fiche" className="w-full">
        <TabsList className="grid grid-cols-3 gap-2 mb-6">
          <TabsTrigger value="fiche">📄 Aperçu Fiche IA</TabsTrigger>
          <TabsTrigger value="validation">✅ Validation</TabsTrigger>
          <TabsTrigger value="recorder">🎙️ Enregistreur IA</TabsTrigger>
        </TabsList>

        <TabsContent value="fiche">
          <Card className="shadow-xl">
            <CardContent className="p-4">
              <FicheApercu donnees={valeurs} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="validation">
          <Card className="shadow-xl">
            <CardContent className="p-4">
              <ValidationPanel valeurs={valeurs} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recorder">
          <Card className="shadow-xl">
            <CardContent className="p-4">
              <IARecorder
                onTranscription={(texte) => {
                  setValeurs((prev) => ({
                    ...prev,
                    texte_contexte: texte,
                  }));
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Separator className="my-8" />
    </div>
  );
};

export default IADashboard;
