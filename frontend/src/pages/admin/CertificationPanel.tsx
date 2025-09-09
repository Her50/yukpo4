import React, { useState } from "react";
import ResponsiveContainer from "@/components/layout/ResponsiveContainer";
import axios from "axios";

type CertificationResult = {
  status: string;
  badge_url: string;
};

const CertificationPanel: React.FC = () => {
  const [serviceId, setServiceId] = useState("");
  const [level, setLevel] = useState("Bronze");
  const [result, setResult] = useState<CertificationResult | null>(null);

  const handleCertification = async () => {
    try {
      const res = await axios.post(`/api/certify/${serviceId}`, { level });
      setResult(res.data);
    } catch (err) {
      console.error("Erreur certification :", err);
    }
  };

  return (
    <ResponsiveContainer className="py-8">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">
        🎖️ Certification <span className="bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 bg-clip-text text-transparent">Yukpo</span> Pro
      </h2>

      <input
        type="text"
        className="border p-2 mb-4 w-full rounded"
        placeholder="ID du service"
        value={serviceId}
        onChange={(e) => setServiceId(e.target.value)}
      />

      <select
        className="border p-2 mb-4 w-full rounded"
        value={level}
        onChange={(e) => setLevel(e.target.value)}
      >
        <option value="Bronze">🥉 Bronze</option>
        <option value="Silver">🥈 Argent</option>
        <option value="Gold">🥇 Or</option>
      </select>

      <button
        className="bg-yellow-500 text-black font-semibold px-4 py-2 rounded hover:bg-yellow-600"
        onClick={handleCertification}
      >
        ✅ Certifier ce service
      </button>

      {result && (
        <div className="mt-6 border-t pt-4">
          <p className="text-lg font-bold text-green-700">{result.status}</p>
          <img src={result.badge_url} alt="Badge" className="w-24 mt-3" />
        </div>
      )}
    </ResponsiveContainer>
  );
};

export default CertificationPanel;
