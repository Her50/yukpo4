import React, { useState, useEffect } from 'react';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';

import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import { motion } // Animation React Native;
import { Button } from "@/components/ui/buttons";
import { ArrowLeft } from "lucide-react";
import { ROUTES } from "@/routes/AppRoutesRegistry"; // ✅ import ajouté

const PageNotFound: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigation();

  return (
    <View style="">
      <motion.div
        style=""
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <motion.h1
          style="text-6xl font-extrabold text-primary mb-4"
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          404
        </motion.h1>
        <p style="text-xl font-semibold text-gray-800 mb-2">
          {t("notfound.title", "Page introuvable")}
        </Text>
        <p style="text-gray-600 mb-6">
          {t("notfound.subtitle", "La page demandée n'existe pas ou a été déplacée.")}
        </Text>

        <TouchableOpacity onClick={() => navigation.navigate(ROUTES.HOME)} style="flex items-center gap-2">
          <ArrowLeft size={18} /> {t("notfound.back", "Retour à l’accueil")}
        </TouchableOpacity>
      </motion.div>
    </View>
  );
};

export default PageNotFound;
