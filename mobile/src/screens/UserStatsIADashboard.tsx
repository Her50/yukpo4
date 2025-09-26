import * as React from "react";
import { useState, useEffect } from 'react';
import { Text } from 'react-native';
import { View } from 'react-native';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';

import { ROUTES } from '@/routes/AppRoutesRegistry'; // ✅ Import ajouté

const stats = [
  { label: 'Biens consultés', value: 123, color: '#4CAF50' },
  { label: 'Demandes envoyées', value: 47, color: '#2196F3' },
  { label: 'Matchs Yukpomnang proposés', value: 31, color: '#FF9800' },
  { label: 'Contenus Yukpomnang générés', value: 8, color: '#E91E63' },
];

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View
      style={{
        background: '#fff',
        borderRadius: '12px',
        padding: '20px',
        textAlign: 'center',
        boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
        borderTop: `4px solid ${color}`,
      }}
    >
      <View style={{ fontSize: '40px', fontWeight: 700, color }}>{value}</View>
      <View style={{ marginTop: '8px', fontSize: '16px', fontWeight: 600 }}>{label}</View>
    </View>
  );
}

const UserStatsIADashboard: React.FC = () => {
  return (
    <View style="">
      <Text style="text-3xl font-bold text-center mb-10">📊 Mon tableau Yukpomnang personnalisé</Text>

      <View style="">
        {stats.map((item, index) => (
          <StatCard key={index} label={item.label} value={item.value} color={item.color} />
        ))}
      </View>

      {/* 🚀 CONTEXTUAL BUTTONS */}
      <View style="mt-12 flex flex-wrap gap-4 justify-center">
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

      <footer style="text-center text-sm text-gray-500 mt-20 border-t pt-6">
        Yukpomnang — Données simulées © 2025
      </footer>
    </View>
  );
};

export default UserStatsIADashboard;




