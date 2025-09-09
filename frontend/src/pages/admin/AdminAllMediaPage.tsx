// @ts-nocheck
import React, { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import axios from "axios";

const AdminAllMediaPage = () => {
  const [medias, setMedias] = useState([]);
  const [filter, setFilter] = useState({ type: "", serviceId: "" });

  const fetchAll = async () => {
    try {
      const res = await axios.get("/api/media/all");
      setMedias(res.data || []);
    } catch {
      alert("Erreur lors du chargement des médias.");
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const handleDelete = async (id) => {
    const ok = confirm("Supprimer ce fichier ?");
    if (!ok) return;
    try {
      await axios.delete(`/api/media/delete/${id}`);
      setMedias((prev) => prev.filter((m) => m.id !== id));
    } catch {
      alert("Erreur lors de la suppression.");
    }
  };

  const filtered = medias.filter((m) =>
    (!filter.type || m.type === filter.type) &&
    (!filter.serviceId || m.service_id == filter.serviceId)
  );

  return (
    <AppLayout padding>
      <div className="max-w-6xl mx-auto py-6">
        <h1 className="text-2xl font-bold mb-4">📂 Tous les fichiers média de la plateforme</h1>

        <div className="flex gap-4 mb-6">
          <Input
            placeholder="Type (image, audio, video)"
            value={filter.type}
            onChange={(e) => setFilter({ ...filter, type: e.target.value })}
          />
          <Input
            placeholder="Service ID"
            value={filter.serviceId}
            onChange={(e) => setFilter({ ...filter, serviceId: e.target.value })}
          />
        </div>

        {filtered.length === 0 ? (
          <p className="text-gray-400 text-sm">Aucun média ne correspond aux filtres actuels.</p>
        ) : (
          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((m) => (
              <div key={m.id} className="border rounded p-3 shadow-sm space-y-2">
                <p className="text-sm text-gray-700">🆔 #{m.id} — Service {m.service_id}</p>
                <p className="text-xs text-gray-400">{m.uploaded_at}</p>

                {m.type === "image" && <img src={`/${m.path}`} className="rounded" />}
                {m.type === "audio" && <audio controls src={`/${m.path}`} />}
                {m.type === "video" && <video controls width="100%" src={`/${m.path}`} />}

                <p className="text-xs truncate text-blue-600">{m.path}</p>

                <div className="flex gap-2 mt-2">
                  <Button size="sm" variant="outline" onClick={() => window.open(`/${m.path}`, "_blank")}>
                    📥 Télécharger
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(m.id)}>
                    🗑 Supprimer
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default AdminAllMediaPage;
