import React, { useState, useEffect } from 'react';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';

import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/buttons";
import { ArrowLeft } from "lucide-react";
import { ROUTES } from "@/routes/AppRoutesRegistry"; // ✅ import ajouté

const PageNotFound: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="">
      <motion.div
        className=""
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <motion.h1
          className="text-6xl font-extrabold text-primary mb-4"
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          404
        </motion.h1>
        <p className="text-xl font-semibold text-gray-800 mb-2">
          {t("notfound.title", "Page introuvable")}
        </p>
        <p className="text-gray-600 mb-6">
          {t("notfound.subtitle", "La page demandée n'existe pas ou a été déplacée.")}
        </p>

        <Button onClick={() => navigate(ROUTES.HOME)} className="flex items-center gap-2">
          <ArrowLeft size={18} /> {t("notfound.back", "Retour à l’accueil")}
        </Button>
      </motion.div>
    </div>
  );
};

export default PageNotFound;