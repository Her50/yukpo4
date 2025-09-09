// @ts-check
import React from "react";

interface BehaviorScoreCardProps {
  score: number;
  suspicious: boolean;
}

const BehaviorScoreCard: React.FC<BehaviorScoreCardProps> = ({ score, suspicious }) => {
  return (
    <div className="p-4 border rounded shadow bg-white">
      <h2 className="text-xl font-bold mb-2">🧠 Résultat de l'analyse comportementale</h2>
      <p className="text-gray-800 mb-1">
        Score comportemental : <strong>{score}</strong>
      </p>
      <p className="text-gray-800">
        Statut :{" "}
        <span className={suspicious ? "text-red-600 font-semibold" : "text-green-600 font-semibold"}>
          {suspicious ? "Comportement suspect détecté" : "Comportement normal"}
        </span>
      </p>
    </div>
  );
};

export default BehaviorScoreCard;
