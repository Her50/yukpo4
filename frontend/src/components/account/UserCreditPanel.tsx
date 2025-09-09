import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/buttons';

interface CreditInfo {
  solde: number;
}

const UserCreditPanel: React.FC<{ userId: string }> = ({ userId }) => {
  const [credit, setCredit] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchCredit = async () => {
    try {
      const res = await axios.get<CreditInfo>(`/api/user/credit/${userId}`);
      setCredit(res.data.solde);
    } catch (e) {
      console.error("❌ Erreur récupération crédit :", e);
    }
  };

  const consommerCredit = async () => {
    setLoading(true);
    try {
      await axios.post('/api/user/credit/consommer', {
        user_id: userId,
        montant: 1.0,
      });
      await fetchCredit(); // Refresh
    } catch (e) {
      console.error("❌ Erreur consommation crédit :", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCredit();
  }, [userId]);

  return (
    <Card className="p-4 space-y-4">
      <h2 className="text-lg font-semibold">🔐 Crédit IA actuel</h2>
      {credit !== null ? (
        <p className="text-2xl text-blue-600 font-bold">{credit.toFixed(2)} crédits</p>
      ) : (
        <p className="text-sm text-gray-500">Chargement du solde...</p>
      )}
      <Button onClick={consommerCredit} disabled={loading}>
        Utiliser 1 crédit IA
      </Button>
    </Card>
  );
};

export default UserCreditPanel;
