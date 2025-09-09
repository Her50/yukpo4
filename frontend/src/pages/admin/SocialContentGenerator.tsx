import React, { useState } from "react";
import ResponsiveContainer from "@/components/layout/ResponsiveContainer";
import axios from "axios";

const SocialContentGenerator: React.FC = () => {
  const [title, setTitle] = useState("");
  const [lang, setLang] = useState("fr");
  const [result, setResult] = useState<null | { url: string; thumbnail: string }>(null);

  const generateContent = async () => {
    try {
      const res = await axios.post("/api/generate-video", { title, lang });
      setResult(res.data);
    } catch (error) {
      console.error("Erreur de génération :", error);
      alert("❌ Échec de la génération de la vidéo");
    }
  };

  return (
    <ResponsiveContainer className="py-8">
      <div className="bg-white shadow-md rounded p-6">
        <h2 className="text-2xl font-bold mb-4">
          🎥 Générateur de contenu social automatisé
        </h2>

        <input
          className="border p-2 w-full mb-3 rounded"
          placeholder="Titre du service ou contenu"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <select
          className="border p-2 w-full mb-3 rounded"
          value={lang}
          onChange={(e) => setLang(e.target.value)}
        >
          <option value="fr">Français</option>
          <option value="en">English</option>
          <option value="ff">Pulaar</option>
        </select>

        <button
          className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition"
          onClick={generateContent}
        >
          Générer Vidéo
        </button>

        {result && (
          <div className="mt-6">
            <p className="text-lg font-semibold text-green-700 mb-2">
              🎬 Vidéo prête :
            </p>
            <video src={result.url} controls className="w-full rounded-lg mb-3" />
            <img src={result.thumbnail} alt="Aperçu" className="w-32 rounded shadow" />
          </div>
        )}
      </div>
    </ResponsiveContainer>
  );
};

export default SocialContentGenerator;
