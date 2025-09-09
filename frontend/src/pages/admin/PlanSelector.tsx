import React, { useEffect, useState } from "react";
import ResponsiveContainer from "@/components/layout/ResponsiveContainer";
import axios from "axios";

type AccessRegistry = {
  [plan: string]: {
    [permission: string]: boolean;
  };
};

const PlanSelector: React.FC = () => {
  const [data, setData] = useState<AccessRegistry>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchAccess = async () => {
      try {
        const res = await axios.get("/api/admin/access");
        setData(res.data);
      } catch (err) {
        console.error("Erreur de chargement", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAccess();
  }, []);

  const togglePermission = (plan: string, permission: string) => {
    setData((prev) => ({
      ...prev,
      [plan]: {
        ...prev[plan],
        [permission]: !prev[plan][permission],
      },
    }));
  };

  const save = async () => {
    setSaving(true);
    try {
      await axios.post("/api/admin/update-access", data);
      alert("✅ Sauvegarde réussie");
    } catch (err) {
      alert("❌ Erreur de sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ResponsiveContainer className="py-10">
        <p className="text-gray-600 text-center">⏳ Chargement des données...</p>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer className="py-8">
      <h1 className="text-xl font-bold mb-6 text-gray-800">⚙️ Gestion des Permissions par Plan</h1>
      <table className="w-full border border-gray-300">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 border text-left">Permission</th>
            {Object.keys(data).map((plan) => (
              <th key={plan} className="p-2 border text-center">{plan.toUpperCase()}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Object.keys(data[Object.keys(data)[0]] || {}).map((perm) => (
            <tr key={perm}>
              <td className="p-2 border font-medium">{perm}</td>
              {Object.keys(data).map((plan) => (
                <td className="p-2 border text-center" key={`${plan}-${perm}`}>
                  <input
                    type="checkbox"
                    checked={data[plan][perm]}
                    onChange={() => togglePermission(plan, perm)}
                    className="h-4 w-4"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-6 flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
        >
          {saving ? "⏳ Enregistrement..." : "💾 Enregistrer"}
        </button>
      </div>
    </ResponsiveContainer>
  );
};

export default PlanSelector;
