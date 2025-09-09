// 📁 frontend/src/components/prestataire/UrgentAlertPanel.tsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/buttons';
import { useNavigate } from 'react-router-dom';

const UrgentAlertPanel: React.FC = () => {
  const [urgence, setUrgence] = useState<any | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUrgence = async () => {
      const res = await axios.get('/api/urgence/entrante');
      setUrgence(res.data);
    };
    fetchUrgence();
  }, []);

  const handleAccept = async () => {
    await axios.post('/api/urgence/repondre', {
      urgence_id: urgence.id,
      accepte: true
    });
    navigate(`/chat/${urgence.client_id}`);
  };

  const handleDecline = async () => {
    await axios.post('/api/urgence/repondre', {
      urgence_id: urgence.id,
      accepte: false
    });
    setUrgence(null);
  };

  if (!urgence) return null;

  return (
    <Card className="p-4 bg-red-50 dark:bg-red-900">
      <h2 className="text-xl font-bold">🚨 Demande urgente</h2>
      <p className="text-sm mt-2">{urgence.texte}</p>
      <div className="mt-4 flex gap-4">
        <Button onClick={handleAccept} variant="default">✅ Accepter & Chatter</Button>
        <Button onClick={handleDecline} variant="destructive">❌ Refuser</Button>
      </div>
    </Card>
  );
};

export default UrgentAlertPanel;
