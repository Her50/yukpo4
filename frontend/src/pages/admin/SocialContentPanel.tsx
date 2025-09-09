import React, { useState } from "react";
import ResponsiveContainer from "@/components/layout/ResponsiveContainer";
import axios from "axios";

const SocialContentPanel: React.FC = () => {
  const [serviceName, setServiceName] = useState("");
  const [lang, setLang] = useState("fr");
  const [message, setMessage] = useState("");

  const generatePost = async () => {
    try {
      await axios.post("/social/generate", {
        service_name: serviceName,
        lang,
      });
      setMessage(`✅ Contenu généré pour « ${serviceName} » [${lang}]`);
    } catch (err) {
      console.error("Erreur de génération :", err);
      setMessage("❌ Erreur lors de la génération du contenu.");
    }
  };

  return (
    <ResponsiveContainer className="py-8">
      <div className="bg-white shadow-md rounded p-6">
        <h2 className="text-xl font-bold mb-4">💬 Générer un post social automatisé</h2>

        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <input
            className="border p-2 rounded flex-1"
            placeholder="Nom du service"
            value={serviceName}
            onChange={(e) => setServiceName(e.target.value)}
          />

          <select
            className="border p-2 rounded"
            value={lang}
            onChange={(e) => setLang(e.target.value)}
          >
            <option value="fr">Français</option>
            <option value="en">English</option>
            <option value="ff">Fulfulde</option>
          </select>

          <button
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
            onClick={generatePost}
          >
            Générer
          </button>
        </div>

        {message && (
          <p className={`mt-2 font-medium ${message.startsWith("✅") ? "text-green-600" : "text-red-600"}`}>
            {message}
          </p>
        )}
      </div>
    </ResponsiveContainer>
  );
};

export default SocialContentPanel;
