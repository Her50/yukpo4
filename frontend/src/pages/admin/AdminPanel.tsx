// src/pages/admin/AdminPanel.tsx
import React, { useState, useEffect } from 'react';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';
import RequireAccess from '@/components/auth/RequireAccess';

// Composants d'administration
import FixFrontendButton from "@/components/admin/FixFrontendButton";
import SchedulerStatusCard from "@/components/SchedulerStatusCard";
import ScheduleManager from "@/components/admin/ScheduleManager";
import QuotaDashboard from "@/components/admin/QuotaDashboard";
import NotificationLog from "@/components/admin/NotificationLog";
import ApiKeyManager from "@/components/admin/ApiKeyManager";

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
        <h1 className="text-3xl font-bold mb-6">🛠️ Console d’administration Yukpomnang</h1>

        <div className="flex flex-col gap-4 mb-6">
          <button onClick={handleVerifyBooks}>📚 Vérifier disponibilité des livres</button>
          <a href="/admin/purge-log">🕓 Historique des purges</a>
          <a href="/admin/blocks-status">🧠 Blocs IA</a>
          <a href="/admin/translate/test">🌍 Tester traduction multilingue</a>
          <button onClick={handleExportTranslations}>📤 Générer PDF des traductions</button>
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
      </ResponsiveContainer>
    </RequireAccess>
  );
};

export default AdminPanel;
