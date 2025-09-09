// @ts-check
import React, { useState, useEffect } from 'react';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import { ROUTES } from '@/routes/AppRoutesRegistry';

const LandingPage: React.FC = () => {
  const [params] = useSearchParams();
  const [data, setData] = useState<{
    title: string;
    description: string;
    keywords: string[];
  } | null>(null);

  useEffect(() => {
    const country = params.get("country") || "Cameroun";
    const sector = params.get("sector") || "immobilier";

    axios
      .get(ROUTES.LANDING, { params: { country, sector } })
      .then((res) => setData(res.data))
      .catch((err) => console.error("❌ Erreur chargement landing :", err));
  }, [params]);

  if (!data) {
    return (
      <ResponsiveContainer>
        <div className="p-8 text-gray-500">Chargement en cours...</div>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer>
      <div className="p-8">
        <h1 className="text-3xl font-bold">{data.title}</h1>
        <p className="mt-2">{data.description}</p>
        <p className="text-sm text-gray-500 mt-1">
          Mots-clés : {Array.isArray(data.keywords) ? data.keywords.join(", ") : "Aucun"}
        </p>
      </div>
    </ResponsiveContainer>
  );
};

export default LandingPage;
