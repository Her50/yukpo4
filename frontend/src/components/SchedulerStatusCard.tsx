// @ts-check
import React, { useEffect, useState } from "react";

type StatusData = {
  enabled: boolean;
  last_run: string;
  next_run: string;
};

const SchedulerStatusCard: React.FC = () => {
  const [data, setData] = useState<StatusData | null>(null);

  useEffect(() => {
    fetch("/api/admin/scheduler-status")
      .then((res) => res.json())
      .then((d) => setData(d));
  }, []);

  if (!data) {
    return (
      <div className="p-4">
        <p>Chargement...</p>
        <button
          onClick={() =>
            fetch("/api/admin/run-summary-now", { method: "POST" })
              .then((res) => res.text())
              .then((msg) => alert(msg))
          }
          className="mt-3 px-4 py-2 bg-indigo-600 text-white rounded"
        >
          🧠 Résumer maintenant
        </button>
      </div>
    );
  }

  const lastRun = new Date(data.last_run);
  const now = new Date();
  const hoursAgo = Math.floor((now.getTime() - lastRun.getTime()) / (1000 * 3600));
  const showAlert = hoursAgo > 48;

  return (
    <div className="p-4 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 border rounded shadow">
      <h3 className="text-lg font-semibold mb-2">🕐 Statut de la Planification IA</h3>

      <p>
        État :{" "}
        <span className={data.enabled ? "text-green-600" : "text-red-500"}>
          {data.enabled ? "✅ Activée" : "⛔ Désactivée"}
        </span>
      </p>

      <p>
        Dernière exécution :{" "}
        <span className={showAlert ? "text-red-500 font-bold" : ""}>
          {isNaN(lastRun.getTime()) ? "Non disponible" : lastRun.toLocaleString()} ({hoursAgo}h)
        </span>
      </p>

      <p>Prochaine prévue : {data.next_run}</p>

      {showAlert && (
        <p className="text-red-500 mt-2">🚨 Plus de 48h depuis le dernier résumé</p>
      )}

      <button
        onClick={() =>
          fetch("/api/admin/run-summary-now", { method: "POST" })
            .then((res) => res.text())
            .then((msg) => alert(msg))
        }
        className="mt-3 px-4 py-2 bg-indigo-600 text-white rounded"
      >
        🧠 Résumer maintenant
      </button>
    </div>
  );
};

export default SchedulerStatusCard;
