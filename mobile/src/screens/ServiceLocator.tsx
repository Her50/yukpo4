import * as React from "react";
import { useState, useEffect } from 'react';
import { Text } from 'react-native';
import { View } from 'react-native';
import { TouchableOpacity } from 'react-native';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';

﻿import { toast } from "react-toastify";
import useProximityDetector from "@/hooks/useProximityDetector";
import axios from "axios";
import { ROUTES } from "@/routes/AppRoutesRegistry"; // ✅ Import ajouté

const ServiceLocator: React.FC = () => {
  const [location, setLocation] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleLocate = async () => {
    try {
      setLoading(true);
      const res = await axios.post("/api/service-location", { service_id: "12345" });
      setLocation(res.data);

      if (res.data.latitude && res.data.longitude) {
        useProximityDetector(res.data.latitude, res.data.longitude, () => {
          toast.success("🛰️ Vous êtes proche de ce service ! Redirection...");
          // Note: window.open n'existe pas en React Native
          // On utiliserait Linking.openURL dans React Native
          setTimeout(() => {
            // Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${res.data.latitude},${res.data.longitude}`);
          }, 2500);
        });

        // Fallback si la détection ne se déclenche pas automatiquement
        // Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${res.data.latitude},${res.data.longitude}`);
      }
    } catch (error) {
      toast.error("Erreur de localisation du service");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style="p-6">
      <Text style="text-xl font-bold mb-4">📍 Localiser le service</Text>
      <TouchableOpacity
        onPress={handleLocate}
        style=""
        disabled={loading}
      >
        {loading ? "Chargement..." : "🚗 Activer le GPS"}
      </TouchableOpacity>

      {location && (
        <Text style="mt-4">📌 Adresse : {location.address}</Text>
      )}

      {/* 🚀 CONTEXTUAL BUTTONS */}
      <View style="mt-6 flex flex-wrap gap-4 justify-center">
        <a
          href={ROUTES.SERVICES}
          style=""
        >
          Découvrir d'autres services
        </a>
        <a
          href={ROUTES.PLANS}
          style=""
        >
          Voir les formules
        </a>
        <a
          href={ROUTES.CONTACT}
          style=""
        >
          Contacter l'équipe Yukpomnang
        </a>
      </View>
    </View>
  );
};

export default ServiceLocator;




