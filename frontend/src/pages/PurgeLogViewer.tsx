import React, { useState, useEffect } from 'react';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';
import PDFModal from '@/components/ui/PDFModal';


interface PurgeLog {
  date: string;
  action: string;
  details: string;
}

const PurgeLogViewer: React.FC = () => {
  const [logs, setLogs] = useState<PurgeLog[]>([]);
  const [filterDate, setFilterDate] = useState({ start: "", end: "" });
  const [filterAction, setFilterAction] = useState("");
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

  const reloadData = () => {
    fetch("/api/admin/purge-log")
      .then(res => res.json())
      .then(data => {
        try {
          const parsed: PurgeLog[] = JSON.parse(data.json);
          setLogs(parsed);
        } catch {
          setLogs([]);
        }
      });
  };

  const printPage = () => window.print();

  useEffect(() => {
    reloadData();
  }, []);

  const filtered = logs.filter((log) => {
    const logDate = new Date(log.date).toISOString().slice(0, 10);
    const inRange =
      (!filterDate.start || logDate >= filterDate.start) &&
      (!filterDate.end || logDate <= filterDate.end);
    const actionMatch = !filterAction || log.action.toLowerCase().includes(filterAction.toLowerCase());
    return inRange && actionMatch;
  });

  const downloadCSV = () => window.open("/dist/setup/purge_log.csv", "_blank");
  const downloadPDF = () => {
    setIsPdfModalOpen(true);
  };

  return (
    <div className="p-4 bg-white dark:bg-gray-900 min-h-screen text-gray-900 dark:text-gray-100">
      <div className="flex justify-between items-center mb-4 gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">Historique des purges</h1>
        <div className="flex gap-2">
          <button onClick={reloadData} className="">
            🔄 Recharger les données
          </button>
          <button onClick={printPage} className="">
            🖨️ Imprimer cette page
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-3 items-center">
        <div>
          <label className="block text-sm font-medium">Date de début</label>
          <input
            type="date"
            className="p-2 border rounded bg-white dark:bg-gray-800"
            value={filterDate.start}
            onChange={(e) => setFilterDate({ ...filterDate, start: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Date de fin</label>
          <input
            type="date"
            className="p-2 border rounded bg-white dark:bg-gray-800"
            value={filterDate.end}
            onChange={(e) => setFilterDate({ ...filterDate, end: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Filtrer par action</label>
          <input
            type="text"
            placeholder="Ex : purge, suppression, mail"
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="p-2 border rounded bg-white dark:bg-gray-800"
          />
        </div>
        <button onClick={downloadCSV} className="">
          📥 Télécharger CSV
        </button>
        <button onClick={downloadPDF} className="">
          📄 Exporter PDF
        </button>
      </div>

      <table className="w-full text-left border border-gray-300 dark:border-gray-700 rounded">
        <thead>
          <tr className="bg-gray-200 dark:bg-gray-800">
            <th className="p-2">Date</th>
            <th className="p-2">Action</th>
            <th className="p-2">Détails</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((log, idx) => (
            <tr key={idx} className="border-b border-gray-300 dark:border-gray-700">
              <td className="p-2">{log.date}</td>
              <td className="p-2">{log.action}</td>
              <td className="p-2">{log.details}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <PDFModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        pdfUrl="/dist/reports/logs_cleared.pdf"
        title="Rapport des purges"
      />
    </div>
  );
};

export default PurgeLogViewer;