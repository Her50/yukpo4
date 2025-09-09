// @ts-check
import React, { useEffect, useState } from "react";
import ResponsiveContainer from "@/components/layout/ResponsiveContainer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/buttons";
import { ROUTES } from "@/routes/AppRoutesRegistry";

type LogEntry = {
  path: string;
  score: number;
  timestamp: string;
};

type InfractionLog = {
  ip: string;
  logs: LogEntry[];
};

const InfractionDashboard: React.FC = () => {
  const [logs, setLogs] = useState<InfractionLog[]>([]);
  const [filterIp, setFilterIp] = useState("");
  const [minScore, setMinScore] = useState(0);
  const [days, setDays] = useState(90);

  useEffect(() => {
    fetch("/api/admin/infractions")
      .then((res) => res.json())
      .then(setLogs)
      .catch(console.error);
  }, []);

  const filtered = logs.filter((log) => {
    return (
      log.ip.includes(filterIp) &&
      log.logs.some((l) => l.score >= minScore)
    );
  });

  const handlePurge = async () => {
    const res = await fetch("/api/admin/purge-infractions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ days }),
    });
    const data = await res.json();
    alert("✅ Purge terminée : " + data.purged + " éléments archivés.");
  };

  const exportCSV = () => {
    const csv = filtered
      .map((log) =>
        log.logs
          .map((l) => `${log.ip},${l.path},${l.score},${l.timestamp}`)
          .join("\n")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "infractions.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ResponsiveContainer className="py-8 text-white dark:bg-black min-h-screen">
      <h1 className="text-2xl font-bold mb-4">🛡️ Infractions détectées</h1>

      <div className="flex flex-wrap gap-4 mb-6 items-center">
        <Button variant="destructive" onClick={handlePurge}>
          🧹 Purger les anciennes
        </Button>
        <input
          type="number"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="border p-2 rounded"
          placeholder="Jours"
        />
        <Button
          variant="outline"
          onClick={() =>
            window.open("/api/admin/export-infractions", "_blank")
          }
        >
          📦 Télécharger ZIP
        </Button>
        <input
          className="border p-2 rounded"
          placeholder="Filtrer par IP"
          value={filterIp}
          onChange={(e) => setFilterIp(e.target.value)}
        />
        <input
          type="number"
          className="border p-2 rounded"
          placeholder="Score min"
          value={minScore}
          onChange={(e) => setMinScore(parseInt(e.target.value) || 0)}
        />
        <Button onClick={exportCSV}>📝 Exporter CSV</Button>
      </div>

      {filtered.map((entry, i) => (
        <Card key={i} className="mb-4 bg-gray-900">
          <CardContent>
            <p className="font-bold text-lg">
              IP: {entry.ip}{" "}
              {entry.logs.length >= 3 && (
                <span className="text-red-400">🚨 Récidiviste</span>
              )}
            </p>
            <ul className="text-sm mt-2 ml-4 list-disc">
              {entry.logs.map((l, j) => (
                <li key={j}>
                  🔒 {l.path} — score: {l.score} — {l.timestamp}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}

      {filtered.length === 0 && (
        <p className="text-center text-gray-400">Aucune infraction trouvée.</p>
      )}

      {/* 🚀 CONTEXTUAL BUTTONS */}
      <div className="mt-6 flex flex-wrap gap-4 justify-center">
        <a href={ROUTES.SERVICES}>Découvrir d'autres services</a>
        <a href={ROUTES.PLANS}>Voir les formules</a>
        <a href={ROUTES.CONTACT}>Contacter l'équipe Yukpo</a>
      </div>
    </ResponsiveContainer>
  );
};

export default InfractionDashboard;
