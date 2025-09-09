// @ts-check
import React, { useState } from "react";
import { ACCESS_REGISTRY, AccessRule } from "@/lib/accessregistry";

const ROLES = ["admin", "client", "user"];
const PLANS = ["free", "pro", "enterprise"];

const AccessAuditTable: React.FC = () => {
  const [filterRole, setFilterRole] = useState("");
  const [filterPlan, setFilterPlan] = useState("");
  const [rules] = useState<AccessRule[]>([...ACCESS_REGISTRY]);

  const filteredRules = rules.filter((rule) => {
    return (
      (!filterRole || rule.role === filterRole) &&
      (!filterPlan || rule.plan === filterPlan)
    );
  });

  const handleExportCSV = () => {
    const header = [`Export ACCESS_REGISTRY`, `Rôle: ${filterRole || "tous"}`, `Plan: ${filterPlan || "tous"}`];
    const rows = [
      ["Component", "Role", "Plan"],
      ...filteredRules.map((r) => [r.component, r.role, r.plan]),
    ];
    const csv = [header.join(","), "", ...rows.map((r) => r.join(","))].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "access_registry.csv";
    link.click();
  };

  const resetFilters = () => {
    setFilterPlan("");
    setFilterRole("");
  };

  return (
    <div className="p-6 max-w-6xl mx-auto bg-white rounded shadow">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
        <h2 className="text-xl font-bold">🔐 Console des accès configurés</h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleExportCSV}
            className="text-sm bg-gray-200 px-3 py-1 rounded hover:bg-gray-300"
            aria-label="Exporter les accès en CSV"
          >
            📤 Export CSV
          </button>
          <button
            onClick={resetFilters}
            className="text-sm bg-gray-100 px-3 py-1 rounded hover:bg-gray-200"
            aria-label="Réinitialiser les filtres"
          >
            ♻️ Réinitialiser
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 mb-4">
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="border px-2 py-1 rounded text-sm"
        >
          <option value="">🔎 Filtrer par rôle</option>
          {ROLES.sort().map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>

        <select
          value={filterPlan}
          onChange={(e) => setFilterPlan(e.target.value)}
          className="border px-2 py-1 rounded text-sm"
        >
          <option value="">🔎 Filtrer par plan</option>
          {PLANS.sort().map((plan) => (
            <option key={plan} value={plan}>
              {plan}
            </option>
          ))}
        </select>
      </div>

      <p className="text-xs text-gray-500 mb-2">
        {filteredRules.length} règle(s) affichée(s) sur {rules.length}
      </p>

      <div className="overflow-x-auto">
        <table className="w-full border text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="border px-2 py-1">🧩 Composant</th>
              <th className="border px-2 py-1">👤 Rôle</th>
              <th className="border px-2 py-1">📦 Plan</th>
            </tr>
          </thead>
          <tbody>
            {filteredRules.map((rule) => (
              <tr key={rule.component} className="border-t hover:bg-gray-50">
                <td className="border px-2 py-1">{rule.component}</td>
                <td className="border px-2 py-1">{rule.role}</td>
                <td className="border px-2 py-1">{rule.plan}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredRules.length === 0 && (
        <div className="text-center text-sm text-gray-500 mt-4">
          Aucun résultat pour ce filtre.
        </div>
      )}
    </div>
  );
};

export default AccessAuditTable;
