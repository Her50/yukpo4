// @ts-check
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';
import RequireAccess from '@/components/auth/RequireAccess';

const PaiementProPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handlePaiement = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSuccess(true);
      setTimeout(() => {
        navigate('/dashboard');
      }, 2500);
    }, 2000);
  };

  return (
    <RequireAccess plan="pro">
      <ResponsiveContainer>
        <div className="pt-24">
          <h1 className="text-2xl font-bold mb-4">💳 Paiement - Plan Pro</h1>

          {loading ? (
            <p className="text-blue-600 font-medium">Chargement en cours...</p>
          ) : success ? (
            <p className="text-green-600 font-semibold">
              ✅ Paiement effectué avec succès ! Redirection...
            </p>
          ) : (
            <button
              onClick={handlePaiement}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
            >
              Payer maintenant
            </button>
          )}
        </div>
      </ResponsiveContainer>
    </RequireAccess>
  );
};

export default PaiementProPage;
