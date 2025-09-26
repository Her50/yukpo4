import React, { useState, useEffect } from 'react';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';

import { Button } from "@/components/ui/buttons";
import { ROUTES } from "@/routes/AppRoutesRegistry"; // ✅ Import ajouté
import PDFModal from '@/components/ui/PDFModal';

interface SecurityStats {
  infractions: number;
  comportements: number;
  menaces: number;
  blocages: number;
  alertes: number;
}

const SecurityDashboard: React.FC = () => {
  const [stats, setStats] = useState<SecurityStats | null>(null);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

  const fetchStats = async () => {
    const res = await fetch("/api/admin/security-dashboard");
    const json = await res.json();
    setStats(json);
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const handleSendPdf = () => {
    setIsPdfModalOpen(true);
  };

  return (
    <div className="p-6 min-h-screen bg-white">
      <h1 className="text-2xl font-bold mb-6">🛡️ Tableau de Sécurité IA</h1>

      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-center">
          <div className="bg-red-100 p-4 rounded shadow">🚨 Infractions : {stats.infractions}</div>
          <div className="bg-yellow-100 p-4 rounded shadow">🧠 Comportements suspects : {stats.comportements}</div>
          <div className="bg-orange-100 p-4 rounded shadow">⚠️ Menaces : {stats.menaces}</div>
          <div className="bg-purple-100 p-4 rounded shadow">🔒 Blocages actifs : {stats.blocages}</div>
          <div className="bg-blue-100 p-4 rounded shadow">📢 Alertes envoyées : {stats.alertes}</div>
        </div>
      )}

      <div className="mt-8 flex flex-wrap gap-4">
        <Button onClick={fetchStats}>🔄 Recharger</Button>
        <Button onClick={handlePrint}>🖨️ Imprimer</Button>
        <Button onClick={handleSendPdf}>📧 Envoyer PDF</Button>
      </div>

      {/* 🚀 CONTEXTUAL BUTTONS */}
      <div className="mt-10 flex flex-wrap gap-4 justify-center">
        <a
          href={ROUTES.SERVICES}
          className=""
        >
          découvrir d'autres services
        </a>
        <a
          href={ROUTES.PLANS}
          className=""
        >
          Voir les formules
        </a>
        <a
          href={ROUTES.CONTACT}
          className=""
        >
          contacter l'équipe yukpomnang
        </a>
      </div>

      <PDFModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        pdfUrl="/dist/reports/security_report.pdf"
        title="Rapport de sécurité"
      />
    </div>
  );
};

export default SecurityDashboard;