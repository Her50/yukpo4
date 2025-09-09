// 📁 src/components/admin/TokenStatusPanel.tsx
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/buttons";
import { Input } from "@/components/ui/input";
import { toast } from "react-toastify";
import axios from "axios";

export const TokenStatusPanel: React.FC<{ userId: number }> = ({ userId }) => {
  const [solde, setSolde] = useState<number | null>(null);
  const [montant, setMontant] = useState(50);
  const [loading, setLoading] = useState(false);

  const fetchSolde = async () => {
    try {
      const res = await axios.get(`/api/admin/solde-tokens?user_id=${userId}`);
      setSolde(res.data.solde);
    } catch (err) {
      toast.error("Échec de récupération du solde.");
    }
  };

  const recharger = async () => {
    try {
      setLoading(true);
      await axios.post("/api/admin/recharger", { user_id: userId, montant });
      toast.success("Crédits rechargés !");
      fetchSolde();
    } catch (err) {
      toast.error("Échec de la recharge.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSolde();
  }, []);

  return (
    <div className="p-4 border rounded-xl shadow bg-white space-y-4">
      <h2 className="text-xl font-semibold">💰 Gestion des crédits Yukpo</h2>
      <p>Crédits disponibles : <strong>{solde ?? "..."}</strong></p>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={1}
          value={montant}
          onChange={(e) => setMontant(Number(e.target.value))}
        />
        <Button onClick={recharger} disabled={loading}>
          {loading ? "Rechargement..." : "Recharger"}
        </Button>
      </div>
    </div>
  );
};

export default TokenStatusPanel;
