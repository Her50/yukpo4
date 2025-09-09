
// 📁 src/components/admin/AdminCreditPanel.tsx
import React, { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/buttons';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

const AdminCreditPanel: React.FC = () => {
  const [userId, setUserId] = useState('');
  const [montant, setMontant] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRecharge = async () => {
    if (!userId || !montant) {
      toast.error('Veuillez renseigner tous les champs.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/admin/recharger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('jwt')}`
        },
        body: JSON.stringify({ user_id: parseInt(userId), montant: parseInt(montant) })
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success('✅ Crédits rechargés avec succès');
      setUserId('');
      setMontant('');
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la recharge');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="max-w-md mx-auto mt-10 p-6">
      <CardContent className="space-y-4">
        <h2 className="text-xl font-semibold">🔋 Recharge de crédits</h2>
        <Input
          placeholder="ID utilisateur"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
        />
        <Input
          placeholder="Montant à ajouter"
          type="number"
          value={montant}
          onChange={(e) => setMontant(e.target.value)}
        />
        <Button onClick={handleRecharge} disabled={loading}>
          {loading ? 'Rechargement...' : 'Recharger'}
        </Button>
      </CardContent>
    </Card>
  );
};

export default AdminCreditPanel;
