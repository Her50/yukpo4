// ✅ Étape 1 : FicheApercu.tsx — Aperçu dynamique de la fiche IA
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/buttons';
import { Download, Send } from 'lucide-react';

interface FicheApercuProps {
  donnees: Record<string, any>;
  onPartager?: () => void;
  onTelecharger?: () => void;
}

const FicheApercu: React.FC<FicheApercuProps> = ({ donnees, onPartager, onTelecharger }) => {
  return (
    <Card className="p-4 shadow-xl rounded-2xl w-full max-w-3xl mx-auto dark:bg-gray-900">
      <CardContent className="space-y-3">
        <h2 className="text-xl font-bold text-center">📄 Fiche Résumée Générée</h2>
        {Object.entries(donnees).map(([cle, val]) => (
          <div key={cle} className="flex justify-between border-b py-1">
            <span className="font-medium text-muted-foreground dark:text-gray-300">{cle}</span>
            <span className="text-right max-w-[60%] text-wrap dark:text-white">{String(val)}</span>
          </div>
        ))}
        <div className="flex justify-end space-x-2 pt-4">
          <Button onClick={onPartager} variant="outline">
            <Send className="mr-1 h-4 w-4" /> Partager
          </Button>
          <Button onClick={onTelecharger}>
            <Download className="mr-1 h-4 w-4" /> Télécharger
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default FicheApercu;
