// 📦 Yukpo – Recherche de besoin avancée (version PRO+ responsive)
// @ts-nocheck

import * as React from "react";
import { useState, useEffect } from "react";
import { Text } from 'react-native';
import { View } from 'react-native';
import { TouchableOpacity } from 'react-native';
import axios from "axios";
import AppLayout from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/buttons";
import { Textarea } from "@/components/ui/textarea";
import { useNavigation } from "@react-navigation/native";
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

  const { user } = useAuth();
  const navigate = useNavigation();
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

      navigation.navigate('/resultat-besoin', { state: { results, type: 'recherche_besoin' } });
    } catch (err) {
      alert("Erreur lors de la recherche.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout padding>
      <View style="max-w-5xl mx-auto py-10 space-y-6">
        <Text style="text-3xl font-bold text-center text-primary">🧠 Décrivez votre besoin</Text>

        <Textarea
          placeholder="Que cherchez-vous ? Ex. Je veux une nounou à Douala bilingue..."
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
        />

        {suggestions.length > 0 && (
          <ul style="text-sm text-gray-600 pl-4">
            {suggestions.map((s, i) => (
              <li key={i}>🔎 {s}</li>
            ))}
          </ul>
        )}

        <TextInput
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={(e) => setMediaFiles(Array.from(e.target.files || []))}
        />

        <View style="flex flex-col sm:flex-row gap-4">
          <TextInput
            type="file"
            accept="audio/*"
            multiple
            onChange={(e) => setAudioFiles(Array.from(e.target.files || []))}
          />
          <TouchableOpacity variant="outline" onPress={handleTranscribe} disabled={!audioFiles.length}>
            🎙️ Transcrire audio
          </TouchableOpacity>
        </View>

        {transcribedAudio && (
          <View style="text-sm text-gray-500 bg-gray-50 border rounded p-3">
            <strong>Transcription IA :</strong> {transcribedAudio}
          </View>
        )}

        <TextInput
          type="url"
          placeholder="🔗 Lien d’un bien/service externe (facultatif)"
          value={siteWeb}
          onChange={(e) => setSiteWeb(e.target.value)}
        />

        <TextInput
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => setExcelFile(e.target.files?.[0] || null)}
        />

        <View style="text-center">
          <TouchableOpacity onPress={() => setPreview(true)}>Prévisualiser</TouchableOpacity>
        </View>

        {preview && (
          <View style="border bg-white p-4 rounded shadow space-y-2">
            <Text style="font-semibold text-lg text-center">📝 Vérification</Text>
            <Text><strong>Description :</strong> {texte || transcribedAudio}</Text>
            <Text><strong>Images/Vidéos :</strong> {mediaFiles.length}</Text>
            <Text><strong>Audios :</strong> {audioFiles.length}</Text>
            <Text><strong>Site Web :</strong> {siteWeb || "N/A"}</Text>
            <Text><strong>Excel :</strong> {excelFile?.name || "Aucun"}</Text>
            <TouchableOpacity onPress={handleAnalyseGlobale} disabled={loading}>
              {loading ? "Chargement..." : "📤 Analyser maintenant"}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </AppLayout>
  );
};

export default RechercheBesoin;





