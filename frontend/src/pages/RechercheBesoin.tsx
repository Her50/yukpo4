// 📦 Yukpo – Recherche de besoin avancée (version PRO+ responsive)
// @ts-nocheck

import React, { useState, useEffect } from "react";
import axios from "axios";
import AppLayout from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/buttons";
import { Textarea } from "@/components/ui/textarea";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/hooks/useUser";
import { useTranslation } from "react-i18next";
import i18n from "i18next";

const RechercheBesoin = () => {
  const [texte, setTexte] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [audioFiles, setAudioFiles] = useState<File[]>([]);
  const [videoFiles, setVideoFiles] = useState<File[]>([]);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [siteWeb, setSiteWeb] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(false);
  const [transcribedAudio, setTranscribedAudio] = useState("");

  const { user } = useUser();
  const navigate = useNavigate();
  const planActuel = user?.plan || "free";
  const { t } = useTranslation();

  // 🌍 Langue automatique
  useEffect(() => {
    if (user?.lang) i18n.changeLanguage(user.lang);
  }, [user]);

  // 💬 Suggestions automatiques
  useEffect(() => {
    const delay = setTimeout(async () => {
      if (texte.length > 5) {
        try {
          const res = await axios.post("/api/suggest-keywords", { texte });
          setSuggestions(res.data.suggestions || []);
        } catch {
          setSuggestions([]);
        }
      }
    }, 600);
    return () => clearTimeout(delay);
  }, [texte]);

  const handleTranscribe = async () => {
    if (!audioFiles[0]) return;
    try {
      const formData = new FormData();
      formData.append("audio", audioFiles[0]);
      const res = await axios.post("/api/transcribe-audio", formData);
      setTranscribedAudio(res.data.text);
    } catch (err) {
      alert("Transcription audio impossible.");
    }
  };

  const handleAnalyseGlobale = async () => {
    setLoading(true);
    try {
      const input = {
        texte: texte || transcribedAudio || "",
      };

      const response = await fetch('/api/search/direct', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(input)
      });

      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }

      const result = await response.json();
      const results = result?.resultats?.resultats || result?.resultats || [];

      navigate('/resultat-besoin', { state: { results, type: 'recherche_besoin' } });
    } catch (err) {
      alert("Erreur lors de la recherche.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout padding>
      <div className="max-w-5xl mx-auto py-10 space-y-6">
        <h1 className="text-3xl font-bold text-center text-primary">🧠 Décrivez votre besoin</h1>

        <Textarea
          placeholder="Que cherchez-vous ? Ex. Je veux une nounou à Douala bilingue..."
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
        />

        {suggestions.length > 0 && (
          <ul className="text-sm text-gray-600 pl-4">
            {suggestions.map((s, i) => (
              <li key={i}>🔎 {s}</li>
            ))}
          </ul>
        )}

        <Input
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={(e) => setMediaFiles(Array.from(e.target.files || []))}
        />

        <div className="flex flex-col sm:flex-row gap-4">
          <Input
            type="file"
            accept="audio/*"
            multiple
            onChange={(e) => setAudioFiles(Array.from(e.target.files || []))}
          />
          <Button variant="outline" onClick={handleTranscribe} disabled={!audioFiles.length}>
            🎙️ Transcrire audio
          </Button>
        </div>

        {transcribedAudio && (
          <div className="text-sm text-gray-500 bg-gray-50 border rounded p-3">
            <strong>Transcription IA :</strong> {transcribedAudio}
          </div>
        )}

        <Input
          type="url"
          placeholder="🔗 Lien d’un bien/service externe (facultatif)"
          value={siteWeb}
          onChange={(e) => setSiteWeb(e.target.value)}
        />

        <Input
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => setExcelFile(e.target.files?.[0] || null)}
        />

        <div className="text-center">
          <Button onClick={() => setPreview(true)}>Prévisualiser</Button>
        </div>

        {preview && (
          <div className="border bg-white p-4 rounded shadow space-y-2">
            <h2 className="font-semibold text-lg text-center">📝 Vérification</h2>
            <p><strong>Description :</strong> {texte || transcribedAudio}</p>
            <p><strong>Images/Vidéos :</strong> {mediaFiles.length}</p>
            <p><strong>Audios :</strong> {audioFiles.length}</p>
            <p><strong>Site Web :</strong> {siteWeb || "N/A"}</p>
            <p><strong>Excel :</strong> {excelFile?.name || "Aucun"}</p>
            <Button onClick={handleAnalyseGlobale} disabled={loading}>
              {loading ? "Chargement..." : "📤 Analyser maintenant"}
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default RechercheBesoin;
