import * as React from "react";
import { useState, useEffect } from 'react';
import { Text } from 'react-native';
import { View } from 'react-native';

import { Link } from "@react-navigation/native";
import DefaultPageLayout from "@/components/layout/DefaultPageLayout";
import { ROUTES } from "@/routes/AppRoutesRegistry";

const ConfirmationPage: React.FC = () => {
  return (
    <DefaultPageLayout>
      <View style="bg-white rounded-lg shadow p-6 text-center">
        <Text style="text-2xl font-bold text-green-700 mb-4">
          📧 Vérification requise pour{" "}
          <Text style="bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 bg-clip-text text-transparent">
            Yukpo
          </Text>
        </Text>
        <Text style="text-gray-700 mb-6">
          Un lien de confirmation vous a été envoyé par email.
          Veuillez vérifier votre boîte de réception pour activer votre compte.
        </Text>

        <Link
          to={ROUTES.HOME}
          style="text-primary font-semibold hover:underline"
        >
          ⬅ Retour à l'accueil
        </Link>
      </View>
    </DefaultPageLayout>
  );
};

export default ConfirmationPage;




