// 📦 Yukpo – Finalisation complète de la création d’un service
// @ts-nocheck

import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams, Navigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import axios from "axios";
import { useUser } from "@/hooks/useUser";

const FormulaireServicePreRempli = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const { type } = useParams();
  const { state } = useLocation();
  const suggestion = state?.suggestion || {};

  if (!user || user.role !== "prestataire") return <Navigate to="/unauthorized" />;

  const [form, setForm] = useState({
    titre: suggestion.titre || "",
    description: suggestion.description || "",
    prix: suggestion.prix || "",
    categorie: suggestion.categorie || type || "",
    localisation: suggestion.localisation || "",
  });

  const [details, setDetails] = useState({});
  const [blueprint, setBlueprint] = useState([]);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchBlueprint = async () => {
      try {
        const res = await axios.get(`/api/service-fields/${type}`);
        setBlueprint(res.data.fields || []);
      } catch {
        console.warn("Aucun blueprint détecté");
      }
    };
    fetchBlueprint();
  }, [type]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const handleDetailsChange = (e) => setDetails({ ...details, [e.target.name]: e.target.value });

  const handleValidate = async () => {
    try {
      setLoading(true);

      // Étape 1 : sauvegarde du service
      const res = await axios.post("/api/prestataire/valider-service", {
        ...form,
        details,
      });

      const service_id = res.data.id;

      // Étape 2 : upload des fichiers
      const formData = new FormData();
      mediaFiles.forEach((file) => formData.append("media", file));
      if (audioFile) formData.append("audio", audioFile);
      if (videoFile) formData.append("video", videoFile);

      await axios.post(`/api/prestataire/upload/${service_id}`, formData);

      // Déclencher l'événement service_created pour notifier MesServices
      window.dispatchEvent(new CustomEvent('service_created'));

      setSuccess(true);
      setTimeout(() => {
        navigate("/prestataire/services");
      }, 2000);
    } catch (err) {
      alert("❌ Erreur pendant la validation du service.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout padding>
      <div className="max-w-4xl mx-auto py-10 space-y-6">
        <h1 className="text-2xl font-bold text-center text-primary">
          ✅ Finalisez votre service Yukpo
        </h1>

        <div className="bg-white rounded-md border p-4 space-y-4 shadow-sm">
          <h2 className="text-lg font-semibold">🧾 Informations générales</h2>
          <Input name="titre" value={form.titre} onChange={handleChange} placeholder="Titre du service" />
          <Textarea name="description" value={form.description} onChange={handleChange} placeholder="Description détaillée" />
          <Input name="prix" value={form.prix} onChange={handleChange} placeholder="Prix (FCFA)" type="number" />
          <Input name="categorie" value={form.categorie} onChange={handleChange} placeholder="Catégorie" />
          <Input name="localisation" value={form.localisation} onChange={handleChange} placeholder="Ville / Quartier" />
        </div>

        {blueprint.length > 0 && (
          <div className="bg-white rounded-md border p-4 space-y-4 shadow-sm">
            <h2 className="text-lg font-semibold">🧩 Spécificités détectées</h2>
            {blueprint.map((field, i) => (
              <Input
                key={i}
                name={field.name}
                type={field.type}
                placeholder={field.name}
                onChange={handleDetailsChange}
              />
            ))}
          </div>
        )}

        <div className="bg-white rounded-md border p-4 space-y-4 shadow-sm">
          <h2 className="text-lg font-semibold">🎥 Fichiers complémentaires</h2>
          <Input type="file" accept="image/*" multiple onChange={(e) => setMediaFiles(Array.from(e.target.files || []))} />
          <Input type="file" accept="audio/*" onChange={(e) => setAudioFile(e.target.files?.[0] || null)} />
          <Input type="file" accept="video/*" onChange={(e) => setVideoFile(e.target.files?.[0] || null)} />
        </div>

        <div className="text-center">
          <Button onClick={handleValidate} disabled={loading}>
            {loading ? "⏳ Chargement..." : "📤 Valider et publier sur Yukpo"}
          </Button>

          {success && (
            <p className="text-green-600 font-semibold mt-4">
              🎉 Service publié avec succès ! Redirection en cours...
            </p>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default FormulaireServicePreRempli;
