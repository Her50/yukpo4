// 📁 src/components/ia/ChatGPTPanel.tsx
import React, { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/buttons";
import { Loader2 } from "lucide-react";

const ChatGPTPanel: React.FC = () => {
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/chatgpt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      const data = await res.json();
      setResponse(data.message || "Aucune réponse.");
    } catch (error) {
      setResponse("Erreur lors de la communication avec l'IA.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded-xl shadow-sm bg-white space-y-4">
      <h2 className="text-xl font-semibold">🤖 Assistant IA Yukpo</h2>

      <Textarea
        placeholder="Posez votre question ici..."
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={4}
        className="w-full"
      />

      <div className="flex justify-end">
        <Button onClick={handleSend} disabled={loading}>
          {loading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="animate-spin h-4 w-4" /> Envoi...
            </span>
          ) : (
            "Envoyer"
          )}
        </Button>
      </div>

      {response && (
        <div className="p-3 border rounded-md bg-gray-50 whitespace-pre-line">
          <strong className="block text-gray-600 mb-1">Réponse IA :</strong>
          <div>{response}</div>
        </div>
      )}

      <p className="text-xs text-gray-500 italic border-t pt-2">
        ⚠️ Les réponses sont générées par un modèle d’intelligence artificielle fourni par OpenAI (ChatGPT). Utilisation à titre informatif uniquement.
      </p>
    </div>
  );
};

export default ChatGPTPanel;
