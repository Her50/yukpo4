// @ts-check
import React, { useEffect, useState } from "react";
import ResponsiveContainer from "@/components/layout/ResponsiveContainer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/buttons";
import { ROUTES } from "@/routes/AppRoutesRegistry";

const AuditDashboard: React.FC = () => {
  const [logs, setLogs] = useState<string[]>([]);

  const load = async () => {
    try {
      const res = await fetch("/api/admin/audit-anomalies");
      const json = await res.json();
      setLogs(json.anomalies || []);
    } catch (err) {
      console.error("Erreur lors du chargement des anomalies :", err);
    }
  };

  const exportCSV = () => {
    const csv = logs.map((log, i) => `${i + 1},"${log.replace(/"/g, '""')}"`).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "audit_anomalies.csv";
    a.click();
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <ResponsiveContainer className="py-8">
      <h1 className="text-2xl font-bold mb-4">
        🧠 Anomalies détectées par{" "}
        <span className="bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 bg-clip-text text-transparent">
          Yukpo
        </span>
      </h1>

      <Button onClick={exportCSV} className="mb-4">
        📤 Export CSV
      </Button>

      <div className="grid gap-2">
        {logs.length > 0 ? (
          logs.map((log, i) => (
            <Card key={i}>
              <CardContent>{log}</CardContent>
            </Card>
          ))
        ) : (
          <p className="text-gray-600 italic">Aucune anomalie détectée.</p>
        )}
      </div>

      {/* 🚀 CONTEXTUAL BUTTONS */}
      <div className="mt-6 flex flex-wrap gap-4 justify-center">
        <a href={ROUTES.SERVICES} className="text-primary underline">
          Découvrir d'autres services
        </a>
        <a href={ROUTES.PLANS} className="text-yellow-600 underline">
          Voir les formules
        </a>
        <a href={ROUTES.CONTACT} className="text-gray-800 underline">
          Contacter l'équipe Yukpo
        </a>
      </div>
    </ResponsiveContainer>
  );
};

export default AuditDashboard;
