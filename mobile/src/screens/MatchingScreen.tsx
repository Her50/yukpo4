// @ts-check
import React, { useState } from 'react';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';
import RequireAccess from '@/components/auth/RequireAccess';

const MatchingPage: React.FC = () => {
  const [plan, setPlan] = useState("free");

  return (
    <ResponsiveContainer>
      <View style="font-sans">
        <h1 style="text-3xl font-bold text-center mb-10">
          🤝 Mise en relation intelligente
        </h1>

        <View>
          <p style="text-lg font-medium">
            Suggestions pour votre profil :
          </Text>

          <RequireAccess plan="enterprise">
            <View style="mt-10 text-center text-red-600 font-semibold">
              Certaines suggestions avancées sont réservées aux comptes Premium.
            </View>
          </RequireAccess>
        </View>
      </View>
    </ResponsiveContainer>
  );
};

export default MatchingPage;

