import React, { useEffect, useState } from "react";
import axios from "axios";
import { useUserSWR } from "@/hooks/useUserSWR";
import { useUserCredit } from "@/hooks/useUserCredit";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

type UsageLog = {
  date: string;
  usage_type: string;
  montant: number;
  moteur: string;
};

const SoldeDetailPage: React.FC = () => {
  const { user, mutate } = useUserSWR();
  const { creditDevise, devise } = useUserCredit();
  const [logs, setLogs] = useState<UsageLog[]>([]);

  useEffect(() => {
    if (!user?.id) return;
    mutate(); // force le rafraîchissement du user/tokens à chaque affichage
    axios.get(`/api/user/credit/history/${user.id}`).then((res) => {
      const data = Array.isArray(res.data) ? res.data : [];
      setLogs(data);
    });
  }, [user, mutate]);

  const handleExportCSV = () => {
    const csv = logs
      .map((log) =>
        [new Date(log.date).toLocaleString(), log.usage_type, log.moteur, log.montant.toFixed(2)].join(",")
      )
      .join("\n");

    const header = "Date,Type,Moteur,Montant (crédits)\n";
    const blob = new Blob([header + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "usage-ia.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const chartData = logs
    .map((log) => ({
      date: new Date(log.date).toLocaleDateString(),
      montant: log.montant,
    }))
    .reverse();

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">🧾 Historique IA & Solde</h1>

      <div className="flex items-center justify-between bg-white dark:bg-gray-800 p-4 rounded shadow text-gray-800 dark:text-white">
        <p>
          💰 Solde disponible :{" "}
          <span className="font-bold text-green-600">
            {creditDevise !== null ? `${creditDevise.toFixed(0)} ${devise}` : "Chargement..."}
          </span>
        </p>
        <button
          onClick={handleExportCSV}
          className="px-3 py-1 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
        >
          📤 Exporter CSV
        </button>
      </div>

      <div className="bg-white dark:bg-gray-900 p-4 rounded shadow">
        <h2 className="text-lg mb-2 font-semibold text-gray-800 dark:text-white">
          📈 Évolution des crédits consommés
        </h2>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="montant" stroke="#f87171" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-gray-500">Pas encore d'historique IA.</p>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white dark:bg-gray-900 rounded shadow text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="p-2">Date</th>
              <th>Type</th>
              <th>Moteur</th>
              <th>Montant (crédits)</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr>
                <td colSpan={4} className="p-3 text-gray-500 italic">
                  Aucun historique disponible
                </td>
              </tr>
            )}
            {logs.map((log, i) => (
              <tr key={i} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                <td className="p-2">{new Date(log.date).toLocaleString()}</td>
                <td>{log.usage_type}</td>
                <td>{log.moteur}</td>
                <td className="text-red-600 font-semibold">{log.montant.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SoldeDetailPage;
