import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/buttons";

const AdminHistoryPanel: React.FC = () => {
  const [historique, setHistorique] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchHistorique = async () => {
    const res = await fetch("/api/admin/context");
    const data = await res.json();
    setHistorique(data.historique || []);
  };

  const deleteItem = async (index: number) => {
    const res = await fetch(`/api/admin/context/delete/${index}`, { method: "DELETE" });
    if (res.ok) fetchHistorique();
  };

  useEffect(() => {
    fetchHistorique();
  }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold">🧠 Historique IA (Yukpo)</h2>
      {historique.length === 0 && <p className="text-gray-500">Aucun enrichissement pour le moment.</p>}

      {historique.map((item, idx) => (
        <div key={idx} className="bg-white shadow p-4 rounded-xl space-y-2">
          <div className="text-sm text-gray-600">🕒 {item.timestamp}</div>
          <div className="text-md font-semibold">{item.type}</div>
          <pre className="bg-gray-100 p-2 rounded text-sm overflow-x-auto">{JSON.stringify(item.valeur, null, 2)}</pre>
          <Button size="sm" variant="destructive" onClick={() => deleteItem(idx)}>Supprimer</Button>
        </div>
      ))}
    </div>
  );
};

export default AdminHistoryPanel;
