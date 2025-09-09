// 📁 frontend/src/pages/admin/IATestPanel.tsx

import React, { useState } from "react";
import axios from "axios";
import AppLayout from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const IATestPanel: React.FC = () => {
  const [texte, setTexte] = useState("");
  const [reponse, setReponse] = useState("");

  const handleTest = async () => {
    const res = await axios.post("/api/ia/predict", { texte });
    setReponse(res.data);
  };

  return (
    <AppLayout padding>
      <div className="max-w-2xl mx-auto py-8 space-y-4">
        <h2 className="text-xl font-bold text-center">🧠 Test IA hybride</h2>
        <Input value={texte} onChange={(e) => setTexte(e.target.value)} placeholder="Écris une question..." />
        <Button onClick={handleTest}>Lancer prédiction</Button>
        <div className="bg-gray-100 p-4 rounded">{reponse}</div>
      </div>
    </AppLayout>
  );
};

export default IATestPanel;
