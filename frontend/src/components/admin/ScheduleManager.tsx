// @ts-check
import React, { useEffect, useState } from "react";

const ScheduleManager: React.FC = () => {
  const [enabled, setEnabled] = useState(true);
  const [info, setInfo] = useState({ last_run: "-", next_run: "-" });

  const load = () => {
    fetch("/api/admin/scheduler-status")
      .then(res => res.json())
      .then(data => {
        setEnabled(data.enabled);
        setInfo(data);
      });
  };

  const toggle = () => {
    fetch("/api/admin/scheduler-toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !enabled })
    }).then(() => load());
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="p-4 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded shadow">
      <h2 className="text-xl font-semibold mb-2">⏱️ Résumés IA automatiques</h2>
      <p>Status : <strong>{enabled ? "✅ Activé" : "🕸️ Désactivé"}</strong></p>
      <p>Dernier : {info.last_run} | Prochain : {info.next_run}</p>
      <button onClick={toggle} className="mt-3 px-4 py-2 bg-blue-600 text-white rounded">
        {enabled ? "Désactiver" : "Activer"}
      </button>
    </div>
  );
};

export default ScheduleManager;
