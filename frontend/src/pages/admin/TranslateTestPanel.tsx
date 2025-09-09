// src/pages/admin/TranslateTestPanel.tsx
import React, { useState } from "react";
import axios from "axios";
import AppLayout from "@/components/layout/AppLayout";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const TranslateTestPanel = () => {
  const [text, setText] = useState("");
  const [lang, setLang] = useState("en");
  const [result, setResult] = useState("");

  const handleTranslate = async () => {
    try {
      const response = await axios.post("/api/translate-text", {
        texte: text,
        target_lang: lang,
      });
      const translatedText = response.data.translated || response.data.translation;
      setResult(translatedText ?? "Aucune traduction reçue.");
    } catch (error) {
      console.error("Erreur de traduction :", error);
      setResult("❌ Erreur lors de la traduction.");
    }
  };

  return (
    <AppLayout padding>
      <div className="max-w-xl mx-auto p-6 bg-white rounded shadow-md space-y-4">
        <h1 className="text-2xl font-bold">🌍 Testeur IA de Traduction</h1>

        <div>
          <label className="font-medium">Texte à traduire :</label>
          <Textarea
            placeholder="Entrez votre texte ici..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>

        <div>
          <label className="font-medium">Langue cible :</label>
          <Input
            placeholder="ex: en, fr, ff, ar"
            value={lang}
            onChange={(e) => setLang(e.target.value)}
          />
        </div>

        <Button onClick={handleTranslate} className="mt-2">
          ✨ Traduire
        </Button>

        {result && (
          <div className="mt-4 p-4 border rounded bg-green-50 text-green-900">
            <strong>Résultat :</strong>
            <p>{result}</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default TranslateTestPanel;
