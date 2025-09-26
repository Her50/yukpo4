// @ts-check
import React, { useState } from 'react';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';
import RequireAccess from '@/components/auth/RequireAccess';

const MatchingPage: React.FC = () => {
  const [plan, setPlan] = useState("free");

  return (
    <ResponsiveContainer>
      <div className="font-sans">
        <h1 className="text-3xl font-bold text-center mb-10">
          🤝 Mise en relation intelligente
        </h1>

        <div>
          <p className="text-lg font-medium">
            Suggestions pour votre profil :
          </p>

          <RequireAccess plan="enterprise">
            <div className="mt-10 text-center text-red-600 font-semibold">
              Certaines suggestions avancées sont réservées aux comptes Premium.
            </div>
          </RequireAccess>
        </div>
      </div>
    </ResponsiveContainer>
  );
};

export default MatchingPage;
