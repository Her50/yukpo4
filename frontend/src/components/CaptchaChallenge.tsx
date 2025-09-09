// @ts-check
import React, { useEffect, useState } from "react";

interface Props {
  onSuccess: () => void;
}

const CaptchaChallenge: React.FC<Props> = ({ onSuccess }) => {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");

  useEffect(() => {
    fetch("/api/captcha")
      .then((r) => r.json())
      .then((d) => setQuestion(d.question));
  }, []);

  const handleSubmit = () => {
    if (answer.trim() === "7") {
      onSuccess(); // Simulation
    } else {
      alert("Réponse incorrecte");
    }
  };

  return (
    <div className="p-4 border rounded">
      <p className="mb-2">{question}</p>
      <input
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        className="border p-1 rounded"
        placeholder="Votre réponse"
      />
      <button
        onClick={handleSubmit}
        className="ml-2 px-2 py-1 bg-blue-600 text-white rounded"
      >
        Valider
      </button>
    </div>
  );
};

export default CaptchaChallenge;
