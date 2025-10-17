import * as React from "react";
import { useState, useEffect } from 'react';
import { Text } from 'react-native';
import { View } from 'react-native';
import { TouchableOpacity } from 'react-native';
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
    // Note: window.print() n'existe pas en React Native
    // Dans React Native, on utiliserait react-native-print ou expo-print
    console.log('Fonctionnalité d\'impression non disponible sur mobile');
  };

  const handleSendPdf = () => {
    setIsPdfModalOpen(true);
  };

  return (
    <View style="p-6 min-h-screen bg-white">
      <Text style="text-2xl font-bold mb-6">🛡️ Tableau de Sécurité IA</Text>

      {stats && (
        <View style="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-center">
          <View style="bg-red-100 p-4 rounded shadow">🚨 Infractions : {stats.infractions}</View>
          <View style="bg-yellow-100 p-4 rounded shadow">🧠 Comportements suspects : {stats.comportements}</View>
          <View style="bg-orange-100 p-4 rounded shadow">⚠️ Menaces : {stats.menaces}</View>
          <View style="bg-purple-100 p-4 rounded shadow">🔒 Blocages actifs : {stats.blocages}</View>
          <View style="bg-blue-100 p-4 rounded shadow">📢 Alertes envoyées : {stats.alertes}</View>
        </View>
      )}

      <View style="mt-8 flex flex-wrap gap-4">
        <TouchableOpacity onPress={fetchStats}>🔄 Recharger</TouchableOpacity>
        <TouchableOpacity onPress={handlePrint}>🖨️ Imprimer</TouchableOpacity>
        <TouchableOpacity onPress={handleSendPdf}>📧 Envoyer PDF</TouchableOpacity>
      </View>

      {/* 🚀 CONTEXTUAL BUTTONS */}
      <View style="mt-10 flex flex-wrap gap-4 justify-center">
        <a
          href={ROUTES.SERVICES}
          style=""
        >
          découvrir d'autres services
        </a>
        <a
          href={ROUTES.PLANS}
          style=""
        >
          Voir les formules
        </a>
        <a
          href={ROUTES.CONTACT}
          style=""
        >
          contacter l'équipe yukpomnang
        </a>
      </View>

      <TextDFModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        pdfUrl="/dist/reports/security_report.pdf"
        title="Rapport de sécurité"
      />
    </View>
  );
};

export default SecurityDashboard;




