// ✅ Étape 2 : ValidationPanel.tsx — Analyse IA de cohérence des valeurs
import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import axios from 'axios';

interface ValidationPanelProps {
  valeurs: Record<string, any>;
}

const ValidationPanel: React.FC<ValidationPanelProps> = ({ valeurs }) => {
  const [score, setScore] = useState<number | null>(null);
  const [details, setDetails] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const analyser = async () => {
      try {
        const res = await axios.post('/api/ia/valider-coherence', { valeurs });
        setScore(res.data.score);
        setDetails(res.data.details);
      } catch (e) {
        setScore(null);
        setDetails('Erreur lors de l’analyse IA.');
      } finally {
        setLoading(false);
      }
    };
    analyser();
  }, [valeurs]);

  return (
    <Card className="mt-6 shadow-lg dark:bg-gray-800">
      <CardContent className="p-4">
        <h3 className="text-lg font-bold mb-2">🔍 Validation IA de cohérence</h3>
        {loading ? (
          <Skeleton className="w-full h-6" />
        ) : (
          <div className="flex items-center space-x-2">
            {score && score > 80 ? (
              <CheckCircle className="text-green-500" />
            ) : (
              <AlertCircle className="text-yellow-500" />
            )}
            <span className="dark:text-gray-100">
              Score IA : <strong>{score ?? '—'}%</strong> — {details}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ValidationPanel;

