import React, { useState, useEffect } from 'react';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';

import axios from "axios";

const AmbassadorPanel: React.FC = () => {
  const [userId, setUserId] = useState("");
  const [link, setLink] = useState("");

  const generateInviteLink = async () => {
    try {
      const res = await axios.post("/ambassador/invite", { inviter_id: userId });
      setLink(res.data.invite_link);
    } catch (err) {
      console.error("Erreur lors de la génération du lien :", err);
      alert("❌ Une erreur s'est produite.");
    }
  };

  return (
    <View style="">
      <h2 style="text-xl font-bold mb-4">Programme Ambassadeur Yukpomnang</h2>
      <TextInput
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
        placeholder="Votre ID Utilisateur"
        style="border p-2 w-full mb-4"
      />
      <TouchableOpacity
        onClick={generateInviteLink}
        style=""
      >
        🎁 Générer un lien d'invitation
      </TouchableOpacity>

      {link && (
        <View style="mt-4">
          <Text>Votre lien à partager :</Text>
          <a href={link} style="text-blue-600 underline" target="_blank" rel="noopener noreferrer">
            {link}
          </a>
        </View>
      )}
    </View>
  );
};

export default AmbassadorPanel;
