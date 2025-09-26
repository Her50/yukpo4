import React, { useState, useEffect } from 'react';
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
          setTimeout(() => {
            window.open(
              `https://www.google.com/maps/dir/?api=1&destination=${res.data.latitude},${res.data.longitude}`,
              "_blank"
            );
          }, 2500);
        });

        // Fallback si la détection ne se déclenche pas automatiquement
        window.open(
          `https://www.google.com/maps/dir/?api=1&destination=${res.data.latitude},${res.data.longitude}`,
          "_blank"
        );
      }
    } catch (error) {
      toast.error("Erreur de localisation du service");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">📍 Localiser le service</h2>
      <button
        onClick={handleLocate}
        className=""
        disabled={loading}
      >
        {loading ? "Chargement..." : "🚗 Activer le GPS"}
      </button>

      {location && (
        <p className="mt-4">📌 Adresse : {location.address}</p>
      )}

      {/* 🚀 CONTEXTUAL BUTTONS */}
      <div className="mt-6 flex flex-wrap gap-4 justify-center">
        <a
          href={ROUTES.SERVICES}
          className=""
        >
          Découvrir d'autres services
        </a>
        <a
          href={ROUTES.PLANS}
          className=""
        >
          Voir les formules
        </a>
        <a
          href={ROUTES.CONTACT}
          className=""
        >
          Contacter l'équipe Yukpomnang
        </a>
      </div>
    </div>
  );
};

export default ServiceLocator;