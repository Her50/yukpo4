// @ts-check
import React, { useEffect, useState } from "react";
import ResponsiveContainer from "@/components/layout/ResponsiveContainer";
import {
  subscribeAccessUpdates,
  unsubscribeAccessUpdates,
} from "@/utils/ws";
import protectionMapRaw from "@/access/protected_components.json";
import RequireAccess from "@/components/auth/RequireAccess";

const protectionMap: Record<string, boolean> = protectionMapRaw;

type AccessItem = {
  component: string;
  role: string;
  plan: string;
};

const ROLES = ["admin", "user", "client", "public"];
const PLANS = ["free", "pro", "enterprise"];

const AdminAccessAuditPage: React.FC = () => {
  const [accessList, setAccessList] = useState<AccessItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [updatedRecently, setUpdatedRecently] = useState(false);

  const fetchAccess = async () => {
    setLoading(true);
    try {
      const res = await fetch("/admin/access-registry");
      const data = await res.json();
      setAccessList(data.access || []);
    } catch (e) {
      console.error("Erreur fetch access:", e);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch("/admin/save-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(accessList),
      });
      if (res.ok) {
        setSaveMessage("✅ Accès sauvegardés !");
        await fetchAccess();
      } else {
        const err = await res.text();
        setSaveMessage(`❌ Erreur : ${err}`);
      }
    } catch {
      setSaveMessage("❌ Erreur réseau");
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMessage(null), 4000);
    }
  };

  useEffect(() => {
    const onAccessUpdate = (data: string) => {
      try {
        const parsed = JSON.parse(data);
        if (parsed?.type === "access_update" && parsed?.access) {
          setAccessList(parsed.access);
          setUpdatedRecently(true);
          setTimeout(() => setUpdatedRecently(false), 2000);
        }
      } catch (e) {
        console.error("Erreur WebSocket:", e);
      }
    };

    subscribeAccessUpdates(onAccessUpdate);
    fetchAccess();
    return () => unsubscribeAccessUpdates(onAccessUpdate);
  }, []);

  const updateField = (index: number, field: keyof AccessItem, value: string) => {
    const updated = [...accessList];
    updated[index][field] = value;
    setAccessList(updated);
  };

  const handleAddRow = () => {
    setAccessList([...accessList, { component: "", role: "public", plan: "free" }]);
  };

  const handleDeleteRow = (index: number) => {
    const updated = [...accessList];
    updated.splice(index, 1);
    setAccessList(updated);
  };

  const isProtected = (componentName: string) => protectionMap[componentName] === true;

  return (
    <ResponsiveContainer className="py-8">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">🔐 Audit des Accès</h1>
        <div className="flex space-x-2">
          <button onClick={handleAddRow} className="text-sm bg-gray-100 px-3 py-1 rounded">
            ➕ Ajouter une ligne
          </button>
          <button onClick={fetchAccess} disabled={loading} className="text-sm bg-gray-100 px-3 py-1 rounded">
            🔁 Recharger
          </button>
          <button onClick={handleSave} disabled={saving} className="text-sm bg-blue-600 text-white px-4 py-1 rounded">
            💾 Enregistrer
          </button>
        </div>
      </div>

      {updatedRecently && <div className="text-green-600 mb-2">✅ Mis à jour via WebSocket</div>}
      {saveMessage && <div className="text-sm font-semibold text-blue-800 mb-2">{saveMessage}</div>}

      <table className="w-full text-sm border border-gray-300">
        <thead className="bg-gray-100">
          <tr>
            <th>🧱 Composant</th>
            <th>🧑‍🤝‍🧑 Rôle</th>
            <th>📦 Plan</th>
            <th>⚠️ Protégé</th>
            <th>❌</th>
          </tr>
        </thead>
        <tbody>
          {accessList.map((item, idx) => (
            <tr key={idx} className="border-t">
              <td>
                <input
                  className="border rounded px-2 py-1 w-full"
                  value={item.component}
                  onChange={(e) => updateField(idx, "component", e.target.value)}
                />
              </td>
              <td>
                <select
                  className="border rounded px-2 py-1 w-full"
                  value={item.role}
                  onChange={(e) => updateField(idx, "role", e.target.value)}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </td>
              <td>
                <select
                  className="border rounded px-2 py-1 w-full"
                  value={item.plan}
                  onChange={(e) => updateField(idx, "plan", e.target.value)}
                >
                  {PLANS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </td>
              <td className="text-center">
                {isProtected(item.component) ? "✅" : "⚠️"}
              </td>
              <td className="text-center">
                <button
                  onClick={() => handleDeleteRow(idx)}
                  className="text-red-600 hover:text-red-800"
                  title="Supprimer"
                >
                  🗑️
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ResponsiveContainer>
  );
};

const ProtectedAuditAccessPage: React.FC = () => (
  <RequireAccess role="admin" anyOf={["admin"]}>
    <AdminAccessAuditPage />
  </RequireAccess>
);

export default ProtectedAuditAccessPage;
