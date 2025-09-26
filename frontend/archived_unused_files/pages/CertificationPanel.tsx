import React, { useState, useEffect } from 'react';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';

import axios from "axios";

export default function CertificationPanel() {
  const [userId, setUserId] = useState("");
  const [result, setResult] = useState("");

  const handleCertificationRequest = async () => {
    try {
      const res = await axios.post("/certification/request", { user_id: userId });
      setResult(res.data.message);
    } catch (error) {
      setResult("Une erreur est survenue. Veuillez réessayer.");
    }
  };

  return (
    <div className="">
      <h2 className="text-2xl font-bold mb-4">Certification Yukpomnang Pro</h2>
      <input
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
        placeholder="Votre ID Utilisateur"
        className="border p-2 w-full mb-4"
      />
      <button
        onClick={handleCertificationRequest}
        className=""
      >
        Demander la certification
      </button>
      {result && (
        <div className="mt-4 text-green-700 font-semibold">
          {result}
        </div>
      )}
    </div>
  );
}