// @ts-nocheck
import React, { useState } from "react";
import axios from "axios";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const UploaderByService = ({ serviceId }: { serviceId: number }) => {
  const [images, setImages] = useState<File[]>([]);
  const [audios, setAudios] = useState<File[]>([]);
  const [videos, setVideos] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    setLoading(true);
    const formData = new FormData();
    images.forEach((file) => formData.append("media", file));
    audios.forEach((file) => formData.append("audio", file));
    videos.forEach((file) => formData.append("video", file));

    try {
      await axios.post(`/api/prestataire/upload/${serviceId}`, formData);
      alert("✅ Fichiers uploadés avec succès !");
    } catch {
      alert("❌ Échec de l'upload.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 border rounded p-4 shadow-sm mt-6">
      <h3 className="font-semibold text-lg">📎 Ajouter des fichiers</h3>

      <Input type="file" accept="image/*" multiple onChange={(e) => setImages(Array.from(e.target.files || []))} />
      <Input type="file" accept="audio/*" multiple onChange={(e) => setAudios(Array.from(e.target.files || []))} />
      <Input type="file" accept="video/*" multiple onChange={(e) => setVideos(Array.from(e.target.files || []))} />

      <Button onClick={handleUpload} disabled={loading}>
        {loading ? "Envoi en cours..." : "📤 Ajouter les fichiers"}
      </Button>
    </div>
  );
};

export default UploaderByService;
