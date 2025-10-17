import * as React from "react";
import { useState, useEffect } from 'react';
import { Text } from 'react-native';
import { View } from 'react-native';
import { TouchableOpacity } from 'react-native';
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
      <Text style="text-5xl font-extrabold text-primary mb-4">404</Text>
      <Text style="text-lg font-semibold text-gray-800 mb-2">
        {t("notfound.title", "Page introuvable")}
      </Text>
      <Text style="text-sm text-gray-600 mb-6">
        {t("notfound.subtitle", "Cette page n'existe pas ou n'est plus disponible.")}
      </Text>

      <TouchableOpacity
        onPress={() => navigation.navigate(ROUTES.HOME)}
        style=""
      >
        <ArrowLeft size={18} />
        {t("notfound.back", "Retour à l’accueil")}
      </TouchableOpacity>
    </View>
  );
};

export default PageNotFoundMobile;




