import React, { useState } from "react";
import axios from "axios";

const ExportShareCard = ({ content }: { content: string }) => {
  const [medium, setMedium] = useState("whatsapp");
  const [recipient, setRecipient] = useState("");
  const [link, setLink] = useState("");
  const [status, setStatus] = useState("");

  const handleShare = async () => {
    setStatus("Envoi en cours...");
    try {
      const res = await axios.post("/api/share", {
        content,
        medium,
        recipient,
      });
      setLink(res.data.url);
      setStatus(res.data.message);
    } catch (err) {
      console.error(err);
      setStatus("Erreur lors du partage");
    }
  };

  return (
    <div className="p-4 border rounded mt-4 bg-white shadow">
      <h3 className="text-md font-bold mb-2">📤 Partager le contenu</h3>

      <select
        value={medium}
        onChange={(e) => setMedium(e.target.value)}
        className="mb-2 p-1 border rounded"
      >
        <option value="whatsapp">WhatsApp</option>
        <option value="email">Email</option>
      </select>

      <input
        type="text"
        placeholder={medium === "email" ? "exemple@domaine.com" : "Numéro WhatsApp"}
        value={recipient}
        onChange={(e) => setRecipient(e.target.value)}
        className="block w-full p-2 mb-2 border rounded"
      />

      <button
        onClick={handleShare}
        className="bg-green-600 text-white px-3 py-1 rounded"
      >
        Générer le lien
      </button>

      {status && <p className="mt-2 text-sm">{status}</p>}

      {link && (
        <div className="mt-2">
          <a href={link} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
            👉 Ouvrir le lien
          </a>
        </div>
      )}
    </div>
  );
};

export default ExportShareCard;
