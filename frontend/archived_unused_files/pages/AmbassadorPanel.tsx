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
    <div className="">
      <h2 className="text-xl font-bold mb-4">Programme Ambassadeur Yukpomnang</h2>
      <input
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
        placeholder="Votre ID Utilisateur"
        className="border p-2 w-full mb-4"
      />
      <button
        onClick={generateInviteLink}
        className=""
      >
        🎁 Générer un lien d'invitation
      </button>

      {link && (
        <div className="mt-4">
          <p>Votre lien à partager :</p>
          <a href={link} className="text-blue-600 underline" target="_blank" rel="noopener noreferrer">
            {link}
          </a>
        </div>
      )}
    </div>
  );
};

export default AmbassadorPanel;