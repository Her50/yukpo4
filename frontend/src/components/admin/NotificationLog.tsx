import React, { useEffect, useState } from 'react';

type Notification = {
  date: string;
  title: string;
  message: string;
};

const NotificationLog: React.FC = () => {
  const [logs, setLogs] = useState<Notification[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch("/dist/setup/notifications.json")
      .then(res => res.json())
      .then(setLogs)
      .catch(() => setLogs([]));
  }, []);

  const exportToCSV = () => {
    const csv = logs.map(log =>
      `${log.date},"${log.title.replace(/"/g, '""')}","${log.message.replace(/"/g, '""')}"`
    ).join('\n');

    const blob = new Blob(["Date,Title,Message\n" + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'notifications.csv';
    link.click();
  };

  const filteredLogs = logs.filter(n =>
    n.title.toLowerCase().includes(search.toLowerCase()) ||
    n.message.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">📢 Journal des Notifications</h2>

      <div className="flex flex-wrap gap-2 mb-4">
        <a
          href="/dist/reports/logs_cleared.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-purple-600 text-white px-3 py-1 rounded hover:bg-purple-700"
        >
          📄 Télécharger PDF post-suppression
        </a>

        <button
          className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
          onClick={() => {
            fetch("/api/admin/clear-notifications", { method: "GET" })
              .then(() => window.location.reload());
          }}
        >
          🧹 Supprimer tous les logs
        </button>

        <button
          onClick={exportToCSV}
          className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
        >
          ⬇️ Exporter CSV
        </button>
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="🔍 Filtrer..."
        className="mb-4 p-2 border rounded w-full"
      />

      <ul className="space-y-2">
        {filteredLogs.length === 0 ? (
          <p>Aucune notification enregistrée.</p>
        ) : (
          filteredLogs.map((notif, index) => (
            <li key={index} className="p-3 rounded border shadow-sm bg-white">
              <p className="font-semibold">{notif.title}</p>
              <p className="text-sm text-gray-600">{notif.date}</p>
              <p>{notif.message}</p>
            </li>
          ))
        )}
      </ul>
    </div>
  );
};

export default NotificationLog;
