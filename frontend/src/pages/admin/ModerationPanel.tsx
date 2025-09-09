// @ts-check
import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import axios from "axios";

const ModerationPanel = () => {
  const [text, setText] = useState("");
  const [result, setResult] = useState<null | {
    cleaned: string;
    flagged: boolean;
    explanation?: string;
  }>(null);
  const [loading, setLoading] = useState(false);

  const handleModerate = async () => {
    setLoading(true);
    try {
      const res = await axios.post("/api/moderate-text", { text });
      setResult(res.data);
    } catch (e) {
      console.error("Erreur de modération :", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">🛡️ Modération automatique IA</h1>

      <Textarea
        className="w-full mb-4"
        rows={5}
        placeholder="Texte à analyser"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <Button onClick={handleModerate} disabled={loading}>
        {loading ? "Analyse..." : "Analyser le contenu"}
      </Button>

      {result && (
        <Card className="mt-6">
          <CardContent className="space-y-3">
            <p><strong>Contenu modéré :</strong></p>
            <p className="bg-gray-100 p-2 rounded text-sm">{result.cleaned}</p>

            <p className="text-sm">
              🔍 Flag :{" "}
              <span className={result.flagged ? "text-red-600" : "text-green-600"}>
                {result.flagged ? "Contenu potentiellement inapproprié" : "Aucun problème détecté"}
              </span>
            </p>

            {result.explanation && (
              <p className="text-xs text-gray-500">💬 IA : {result.explanation}</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ModerationPanel;
