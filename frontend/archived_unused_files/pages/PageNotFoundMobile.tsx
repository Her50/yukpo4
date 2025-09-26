import React, { useState, useEffect } from 'react';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';

import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import { ROUTES } from "@/routes/AppRoutesRegistry"; // ✅ Import ajouté ici

const PageNotFoundMobile: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="">
      <h1 className="text-5xl font-extrabold text-primary mb-4">404</h1>
      <p className="text-lg font-semibold text-gray-800 mb-2">
        {t("notfound.title", "Page introuvable")}
      </p>
      <p className="text-sm text-gray-600 mb-6">
        {t("notfound.subtitle", "Cette page n'existe pas ou n'est plus disponible.")}
      </p>

      <button
        onClick={() => navigate(ROUTES.HOME)}
        className=""
      >
        <ArrowLeft size={18} />
        {t("notfound.back", "Retour à l’accueil")}
      </button>
    </div>
  );
};

export default PageNotFoundMobile;