// src/pages/CreationSmartService.tsx
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { detectServiceType } from '@/utils/serviceClassifier'; // À créer si besoin
import { Loader } from '@/components/ui/loader';

const CreationSmartService = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const simulateDetection = async () => {
      const type = await detectServiceType(); // Simule détection de service
      if (type === 'immobilier') {
        navigate('/create/immobilier');
      } else if (type === 'livre') {
        navigate('/create/livre');
      } else if (type === 'transport') {
        navigate('/create/transport');
      } else {
        navigate('/create/autre');
      }
    };
    simulateDetection();
  }, [navigate]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <Loader />
      <p className="mt-4 text-gray-600">Analyse du type de service en cours…</p>
    </div>
  );
};

export default CreationSmartService;
