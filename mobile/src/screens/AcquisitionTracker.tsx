import { useRoute } from "@react-navigation/native";
import * as React from "react";
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

const AcquisitionTracker: React.FC = () => {
  const route = useRoute();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const source = (route.params as any)?.src || "unknown";

    // Simuler le tracking pour mobile
    const trackAcquisition = async () => {
      try {
        // Ici vous pouvez implémenter le tracking réel
        console.log("Tracking acquisition:", source);

        // ✅ CORRECTION: Nettoyer le timer
        const timer = setTimeout(() => {
          setLoading(false);
        }, 2000);

        return () => clearTimeout(timer);
      } catch (err) {
        console.error("Erreur de tracking :", err);
        setLoading(false);
      }
    };

    trackAcquisition();
  }, [route.params]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>🔄 Redirection en cours...</Text>
    </View>
  );
};

export default AcquisitionTracker;




