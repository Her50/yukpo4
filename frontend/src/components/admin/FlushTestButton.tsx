// @ts-check
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "react-toastify";

const FlushTestButton: React.FC = () => {
  const [loading, setLoading] = useState(false);

  const handleFlush = async () => {
    const confirm = window.confirm("⚠️ Êtes-vous sûr de vouloir supprimer les données de test ?");
    if (!confirm) return;

    setLoading(true);
    try {
      const res = await fetch("/admin/flush-test-data", {
        method: "POST",
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(data.status || "✅ Données supprimées.");
      } else {
        toast.error(data.error || "❌ Erreur serveur.");
      }
    } catch (err) {
      toast.error("❌ Impossible de contacter le backend.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleFlush} disabled={loading}>
      {loading ? "🧼 Nettoyage..." : "🧹 Supprimer données de test"}
    </Button>
  );
};

export default FlushTestButton;
