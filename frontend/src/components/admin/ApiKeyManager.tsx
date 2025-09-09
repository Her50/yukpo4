// src/components/admin/ApiKeyManager.tsx
// @ts-check
import React, { useEffect, useState } from "react";
import { ROUTES } from "@/routes/AppRoutesRegistry"; // ✅ Import ajouté

const ApiKeyManager: React.FC = () => {
  const [keys, setKeys] = useState<{ [key: string]: { key: string; enabled: boolean } }>({});
  const [message, setMessage] = useState("");

  const loadKeys = async () => {
    const res = await fetch("/api/admin/api-keys");
    const data = await res.json();
    setKeys(data);
  };

  const save = async () => {
    await fetch("/api/admin/api-keys/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(keys),
    });
    setMessage("✅ Sauvegardé !");
  };

  useEffect(() => {
    loadKeys();
  }, []);

  return (
    <div className="p-4 border rounded shadow bg-white">
      <h1 className="text-xl mb-4 font-bold">🔐 Gestion des Clés API</h1>

      {Object.entries(keys).map(([k, v]) => (
        <div key={k} className="mb-4">
          <label className="font-semibold">{k}</label>
          <div className="flex items-center gap-4 mt-1">
            <input
              className="border p-1 w-full max-w-md"
              value={v.key}
              onChange={(e) => setKeys({ ...keys, [k]: { ...v, key: e.target.value } })}
            />
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={v.enabled}
                onChange={(e) =>
                  setKeys({ ...keys, [k]: { ...v, enabled: e.target.checked } })
                }
              />
              <span>Actif</span>
            </label>
          </div>
        </div>
      ))}

      <button
        onClick={save}
        className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
      >
        💾 Sauvegarder
      </button>

      {message && <p className="text-green-600 mt-2">{message}</p>}

      {/* 🚀 CONTEXTUAL BUTTONS */}
      <div className="mt-12 flex flex-wrap gap-4 justify-center border-t pt-6">
        <a
          href={ROUTES.SERVICES}
          className="px-4 py-2 bg-primary text-white rounded hover:bg-opacity-90 transition"
        >
          Découvrir d'autres services
        </a>
        <a
          href={ROUTES.PLANS}
          className="px-4 py-2 bg-yellow-400 text-black rounded hover:bg-yellow-500 transition"
        >
          Voir les formules
        </a>
        <a
          href={ROUTES.CONTACT}
          className="px-4 py-2 bg-gray-100 border rounded hover:bg-gray-200 transition"
        >
          Contacter l'équipe Yukpomnang
        </a>
      </div>
    </div>
  );
};

export default ApiKeyManager;
