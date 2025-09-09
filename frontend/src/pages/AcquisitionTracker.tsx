import React, { useState, useEffect } from 'react';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';

import { useSearchParams } from "react-router-dom";

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
      <p>🔄 Redirection en cours...</p>
  );
};

export default AcquisitionTracker;