// src/pages/admin/AdminPanel.tsx
import RequireAccess from '@/components/auth/RequireAccess';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';
import { Link } from 'react-router-dom';
import React, { useEffect } from 'react';

// Composants d'administration
import ApiKeyManager from "@/components/admin/ApiKeyManager";
import FixFrontendButton from "@/components/admin/FixFrontendButton";
import GlobalPromoManager from '@/components/admin/GlobalPromoManager';
import NotificationLog from "@/components/admin/NotificationLog";
import PayoutsPanel from "@/components/admin/PayoutsPanel"; // ✅ 2026-05-15 PR #4
import QuotaDashboard from "@/components/admin/QuotaDashboard";
import ScheduleManager from "@/components/admin/ScheduleManager";
import SchedulerStatusCard from "@/components/SchedulerStatusCard";

interface BlockStatus {
  status: string;
}

const AdminPanel: React.FC = () => {
  useEffect(() => {
    fetch("/api/admin/block-status")
      .then((res) => res.json())
      .then((data: BlockStatus[]) => {
        const pending = data.find((b) => b.status.includes("⏳"));
        if (pending) {
          window.location.href = "/admin/blocks-status";
        }
      });
  }, []);

  const handleVerifyBooks = async () => {
    try {
      const res = await fetch("/admin/verify-books");
      const data = await res.json();
      alert("📚 Vérification terminée. Résultat dans la console.");
      console.log(data);
    } catch (err) {
      console.error("❌ Erreur de vérification :", err);
    }
  };

  const handleExportTranslations = async () => {
    try {
      const lang = prompt("Langue du PDF (fr, en, ar, ff...) ?", "fr");
      if (!lang) return;
      const response = await fetch(`/admin/generate-pdf?lang=${lang}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `translations_${lang}.pdf`;
      link.click();
    } catch (err) {
      alert("Erreur lors de la génération du PDF");
      console.error(err);
    }
  };

  return (
    <RequireAccess role="user" plan="pro">
      <ResponsiveContainer className="pt-24 min-h-screen bg-white font-inter">
        <h1 className="text-3xl font-bold mb-6">🛠️ Console d'administration Yukpo</h1>

        {/* ✅ NOUVEAU: Lien vers la gestion des rôles */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <Link 
            to="/admin/user-roles" 
            className="text-blue-600 hover:text-blue-800 font-semibold text-lg flex items-center gap-2"
          >
            👤 Gérer les rôles utilisateurs →
          </Link>
          <p className="text-sm text-gray-600 mt-1">
            Liste et modifiez les rôles de tous les utilisateurs de la plateforme
          </p>
        </div>

        <div className="flex flex-col gap-4 mb-6">
          <button onClick={handleVerifyBooks}>📚 Vérifier disponibilité des livres</button>
          <a href="/admin/purge-log">🕓 Historique des purges</a>
          <a href="/admin/blocks-status">🧠 Blocs IA</a>
          <a href="/admin/translate/test">🌍 Tester traduction multilingue</a>
          <button onClick={handleExportTranslations}>📤 Générer PDF des traductions</button>
          {/* ✅ 2026-05-16 — Accès direct admin à Yukpo Librairie pour les tests.
              Le backend (super_librairie_dashboard) accepte explicitement les
              rôles 'admin' et 'super_admin' et prend le 1er super-librairie
              actif en base — pas besoin d'avoir un compte libraire dédié. */}
          <a
            href="https://bourse-du-livre-scolaire.yukpomnang.com/librairie"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-indigo-700 hover:text-indigo-900 font-semibold"
          >
            🏪 Espace Yukpo Librairie (test admin) ↗
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ScheduleManager />
          <SchedulerStatusCard />
          <QuotaDashboard />
          <FixFrontendButton />
          <ApiKeyManager />
        </div>

        <div className="mt-10">
          <h3 className="text-xl font-semibold mb-2">📢 Notifications</h3>
          <NotificationLog />
        </div>

        <div className="mt-10">
          <GlobalPromoManager />
        </div>

        {/* ✅ 2026-05-15 PR #4 — Payouts cash : badge "à traiter" si demandes
            pending → l'admin voit immédiatement la file d'attente. Inclut
            treasury summary (revenu net Yukpo vs dette wallet clients). */}
        <div className="mt-10">
          <PayoutsPanel />
        </div>
      </ResponsiveContainer>
    </RequireAccess>
  );
};

export default AdminPanel;
