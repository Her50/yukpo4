// @ts-nocheck
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import axios from "axios";

const AdminServiceMediaViewer = () => {
  const { id } = useParams(); // id du service
  const [medias, setMedias] = useState([]);

  useEffect(() => {
    const fetchMedias = async () => {
      try {
        const res = await axios.get(`/api/media/by-service/${id}`);
        setMedias(res.data || []);
      } catch {
        alert("Erreur de récupération des fichiers média.");
      }
    };
    fetchMedias();
  }, [id]);

  return (
    <AppLayout padding>
      <div className="max-w-5xl mx-auto py-8">
        <h1 className="text-2xl font-bold mb-4">📦 Fichiers liés au service #{id}</h1>

        {medias.length === 0 ? (
          <p className="text-gray-500">Aucun média trouvé.</p>
        ) : (
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {medias.map((m) => (
              <div key={m.id} className="border rounded p-3 shadow-sm space-y-2">
                <p className="text-sm text-gray-700">🆔 {m.id}</p>
                <p className="text-xs text-gray-400">{m.uploaded_at}</p>
                {m.type === "image" && <img src={`/${m.path}`} alt="media" className="rounded" />}
                {m.type === "audio" && <audio controls src={`/${m.path}`} />}
                {m.type === "video" && <video controls width="100%" src={`/${m.path}`} />}
                <p className="text-sm font-mono text-blue-600 truncate">{m.path}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default AdminServiceMediaViewer;
