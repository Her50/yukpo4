// 📦 Yukpo – Formulaire intelligent basé sur blueprint
// @ts-nocheck

import React, { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/buttons";
import AppLayout from "@/components/layout/AppLayout";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { showSimpleServiceCreationToast, showServiceCreationErrorToast } from '@/utils/toastUtils';
import { ROUTES } from "@/routes/AppRoutesRegistry";

interface ServiceBlueprint {
  id: string;
  categorie: string;
  nature_service: string;
  champs_specifiques: string[];
  gps_required: boolean;
  calcul_distance_bitum: boolean;
  ai_quality_assess: boolean;
}

const ServiceFormDynamic = () => {
  const { t } = useTranslation();
  const { type } = useParams();
  const navigate = useNavigate();

  const [blueprint, setBlueprint] = useState<ServiceBlueprint | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [currency, setCurrency] = useState("XAF");

  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchBlueprint = async () => {
      try {
        const res = await axios.get(`/api/blueprints/${type}`);
        setBlueprint(res.data.data);
      } catch (err) {
        toast.error("❌ Impossible de charger le modèle Yukpo");
      }
    };
    fetchBlueprint();
  }, [type]);

  useEffect(() => {
    if (blueprint?.gps_required) {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        try {
          const res = await axios.post("/api/geoloc/country", {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
          setCurrency(res.data.currency || "XAF");
        } catch {
          setCurrency("XAF");
        }
      });
    }
  }, [blueprint]);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    const requiredFields = blueprint?.champs_specifiques || [];
    const isComplete = requiredFields.every((field) => formData[field]?.trim());

    if (!isComplete) {
      toast.warning("Veuillez remplir tous les champs obligatoires.");
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post("/api/services/create", {
        type,
        data: formData,
        currency,
      });

      const serviceId = res.data?.data?.id || null;

      if (serviceId) {
        const fileForm = new FormData();
        mediaFiles.forEach((file) => fileForm.append("media", file));
        if (audioFile) fileForm.append("audio", audioFile);
        if (videoFile) fileForm.append("video", videoFile);
        await axios.post(`/api/prestataire/upload/${serviceId}`, fileForm);
      }

      // Déclencher l'événement service_created pour notifier MesServices
      window.dispatchEvent(new CustomEvent('service_created'));
      
      toast.success("✅ Service Yukpo enregistré avec succès !");
      navigate(ROUTES.MES_SERVICES);
    } catch (err) {
      toast.error("❌ Erreur pendant l’enregistrement");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout padding>
      <div className="max-w-3xl mx-auto py-10 px-4 space-y-6">
        <h1 className="text-2xl font-bold text-primary text-center">Créer un service avec Yukpo</h1>

        {blueprint?.champs_specifiques.map((champ) => (
          <div key={champ}>
            <label className="text-sm font-medium">{t(`fields.${champ}`) || champ}</label>
            {champ.includes("description") || champ.includes("detail") ? (
              <Textarea
                value={formData[champ] || ""}
                onChange={(e) => handleChange(champ, e.target.value)}
              />
            ) : (
              <Input
                value={formData[champ] || ""}
                onChange={(e) => handleChange(champ, e.target.value)}
              />
            )}
            {champ === "prix" && currency && (
              <p className="text-sm text-gray-500">Devise : {currency}</p>
            )}
          </div>
        ))}

        <div>
          <label className="text-sm font-medium">📷 Images</label>
          <Input type="file" accept="image/*" multiple onChange={(e) => setMediaFiles(Array.from(e.target.files || []))} />
        </div>

        <div>
          <label className="text-sm font-medium">🎤 Audio</label>
          <Input type="file" accept="audio/*" onChange={(e) => setAudioFile(e.target.files?.[0] || null)} />
        </div>

        <div>
          <label className="text-sm font-medium">🎥 Vidéo</label>
          <Input type="file" accept="video/*" onChange={(e) => setVideoFile(e.target.files?.[0] || null)} />
        </div>

        <div className="text-center pt-6">
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "🔁 Enregistrement..." : "🚀 Enregistrer le service Yukpo"}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
};

export default ServiceFormDynamic;
