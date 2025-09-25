import React, { useState, useEffect } from 'react';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';

import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import { ROUTES } from "@/routes/AppRoutesRegistry"; // ✅ Import ajouté ici

const PageNotFoundMobile: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigation();

  return (
    <View style="">
      <h1 style="text-5xl font-extrabold text-primary mb-4">404</h1>
      <p style="text-lg font-semibold text-gray-800 mb-2">
        {t("notfound.title", "Page introuvable")}
      </Text>
      <p style="text-sm text-gray-600 mb-6">
        {t("notfound.subtitle", "Cette page n'existe pas ou n'est plus disponible.")}
      </Text>

      <TouchableOpacity
        onClick={() => navigation.navigate(ROUTES.HOME)}
        style=""
      >
        <ArrowLeft size={18} />
        {t("notfound.back", "Retour à l’accueil")}
      </TouchableOpacity>
    </View>
  );
};

export default PageNotFoundMobile;
