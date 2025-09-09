// @ts-check
import React, { useState } from "react";
import { toast } from "react-toastify";
import { Trash2 } from "lucide-react";

type Props = {
  onFlushSuccess?: () => void;
};

const FlushFloatingButton: React.FC<Props> = ({ onFlushSuccess }) => {
  const [loading, setLoading] = useState(false);

  const handleFlush = async () => {
    const confirm = window.confirm("⚠️ Confirmer la suppression des données de test ?");
    if (!confirm) return;

    setLoading(true);
    try {
      const res = await fetch("/admin/flush-test-data", { method: "POST" });
      const data = await res.json();

      if (res.ok) {
        toast.success(data.status || "✅ Données supprimées.");
        onFlushSuccess?.();
      } else {
        toast.error(data.error || "❌ Erreur serveur.");
      }
    } catch (e) {
      toast.error("❌ Erreur réseau");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleFlush}
      disabled={loading}
      title="Flush Test Data"
      className="fixed bottom-6 right-6 z-50 bg-red-600 hover:bg-red-700 text-white p-3 rounded-full shadow-xl flex items-center gap-2"
    >
      <Trash2 size={18} />
      {loading ? "..." : "Flush"}
    </button>
  );
};

export default FlushFloatingButton;
