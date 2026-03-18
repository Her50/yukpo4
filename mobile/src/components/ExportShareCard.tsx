// @ts-nocheck
import axios from "axios";
import { useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from 'react-native';

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
    <View style="p-4 border rounded mt-4 bg-white shadow">
      <Text style="text-md font-bold mb-2">\uD83D\uDCE4 Partager le contenu</Text>

      <select
        value={medium}
        onChange={(e) => setMedium(e.target.value)}
        style="mb-2 p-1 border rounded"
      >
        <option value="whatsapp">WhatsApp</option>
        <option value="email">Email</option>
      </select>

      <TextInput
        type="text"
        placeholder={medium === "email" ? "exemple@domaine.com" : "Numéro WhatsApp"}
        value={recipient}
        onChange={(e) => setRecipient(e.target.value)}
        style="block w-full p-2 mb-2 border rounded"
      />

      <TouchableOpacity
        onPress={handleShare}
        style="bg-green-600 text-white px-3 py-1 rounded"
      >
        Générer le lien
      </TouchableOpacity>

      {status && <Text style="mt-2 text-sm">{status}</Text>}

      {link && (
        <View style="mt-2">
          <a href={link} target="_blank" rel="noopener noreferrer" style="text-blue-600 underline">
            \uD83D\uDC49 Ouvrir le lien
          </a>
        </View>
      )}
    </View>
  );
};

export default ExportShareCard;





