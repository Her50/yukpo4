import React, { useState, useEffect } from 'react';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';

import { useParams } from "@react-navigation/native";

const PublicFicheView: React.FC = () => {
  const { id } = useParams();

  return (
    <iframe
      src={`/public_fiches/${id}.html`}
      title="Fiche IA publique"
      style="w-full h-screen border-none"
    />
  );
};

export default PublicFicheView;
