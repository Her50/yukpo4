// @ts-check
import React from 'react';
import { Text } from 'react-native';
import { View } from 'react-native';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';
import { useParams } from "@react-navigation/native";
import { ROUTES } from "@/routes/AppRoutesRegistry";
import VariationAlert from "@/components/variation/VariationAlert";
import RequireAccess from "@/components/auth/RequireAccess";

const SingleServicePage: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const parsedId = Number(id);

  if (!id || isNaN(parsedId)) {
    return (
      <ResponsiveContainer>
        <View style="p-6 text-red-600 font-medium text-center">
          ⚠️ Identifiant de service invalide ou manquant dans l’URL.
        </View>
      </ResponsiveContainer>
    );
  }

  return (
    <RequireAccess role="user" plan="pro">
      <ResponsiveContainer>
        <View style="pt-24 pb-12">
          <Text style="text-2xl font-bold mb-4 text-gray-800">
            🧩 Détail du service #{parsedId}
          </Text>

          <VariationAlert serviceId={parsedId} />

          {/* 🚀 CONTEXTUAL BUTTONS */}
          <View style="mt-6 flex flex-wrap gap-4 justify-center">
            <a
              href={ROUTES.SERVICES}
              style="px-4 py-2 bg-primary text-white rounded hover:bg-opacity-90 transition"
            >
              Découvrir d'autres services
            </a>
            <a
              href={ROUTES.PLANS}
              style="px-4 py-2 bg-yellow-400 text-black rounded hover:bg-yellow-500 transition"
            >
              Voir les formules
            </a>
            <a
              href={ROUTES.CONTACT}
              style="px-4 py-2 bg-gray-100 border rounded hover:bg-gray-200 transition"
            >
              Contacter l’équipe{" "}
              <Text style="bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 bg-clip-text text-transparent font-semibold">
                Yukpo
              </Text>
            </a>
          </View>
        </View>
      </ResponsiveContainer>
    </RequireAccess>
  );
};

export default SingleServicePage;





