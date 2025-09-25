import React, { useState, useEffect } from 'react';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';

import { useSearchParams } from "@react-navigation/native";

const AcquisitionTracker: React.FC = () => {
  const [params] = useSearchParams();

  useEffect(() => {
    const source = params.get("src") || "unknown";
    fetch("/acquisition/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.redirect_url) {
          window.location.href = data.redirect_url;
        }
      })
      .catch((err) => {
        console.error("Erreur de tracking :", err);
      });
  }, [params]);

  return (
      <Text>🔄 Redirection en cours...</Text>
  );
};

export default AcquisitionTracker;
