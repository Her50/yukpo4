import React, { useState, useEffect } from 'react';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/buttons";
import { FileTextIcon } from "lucide-react";
import ReportStats from "@/components/admin/ReportStats";
import PDFModal from '@/components/ui/PDFModal';

const AdminReportsPage: React.FC = () => {
  const [reports, setReports] = useState<string[]>([]);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

  useEffect(() => {
    fetch("/reports/list.json")
      .then((res) => res.json())
      .then((data) => setReports(data))
      .catch(() => setReports([]));
  }, []);

  const handleClearReports = () => {
    if (confirm("🗑 Supprimer tous les rapports ?")) {
      fetch("/api/admin/clear-reports", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
        },
      })
        .then(() => {
          alert("✅ Tous les rapports ont été supprimés.");
          window.location.reload();
        })
        .catch(() => alert("❌ Échec de la suppression."));
    }
  };

  const handleDownloadAudit = () => {
    fetch("/api/admin/download-audit")
      .then((res) => res.blob())
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "audit_pack_latest.zip";
        a.click();
        window.URL.revokeObjectURL(url);
      });
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">📄 Rapports Techniques Yukpomnang</h1>

      <div className="flex flex-wrap gap-4 justify-end">
        <a
          href="/dist/setup/all_reports.zip"
          download
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button variant="default">📦 Télécharger tout (ZIP)</Button>
        </a>
        <Button variant="destructive" onClick={handleClearReports}>
          🗑 Vider tous les rapports
        </Button>
        <Button onClick={handleDownloadAudit}>
          📥 Télécharger l'audit pack
        </Button>
        <Button 
          variant="outline" 
          onClick={() => setIsPdfModalOpen(true)}
          className="text-blue-600"
        >
          📄 logs_cleared.pdf
        </Button>
      </div>

      {reports.length === 0 ? (
        <p className="text-gray-500 italic">Aucun rapport trouvé dans dist/setup/</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {reports.map((file, idx) => (
            <Card key={idx} className="p-4 flex justify-between items-center">
              <CardContent className="flex items-center gap-3">
                <FileTextIcon className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-medium">{file}</span>
              </CardContent>
              <a
                href={`/dist/setup/${file}`}
                download
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="secondary">📥 Télécharger</Button>
              </a>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-6">
        <ReportStats />
      </div>

      <PDFModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        pdfUrl="/dist/reports/logs_cleared.pdf"
        title="Logs nettoyés"
      />
    </div>
  );
};

export default AdminReportsPage;