// @ts-check
import React from "react";

interface BehaviorScoreCardProps {
  score: number;
  suspicious: boolean;
}

const BehaviorScoreCard: React.FC<BehaviorScoreCardProps> = ({ score, suspicious }) => {
  return (
    <View style="p-4 border rounded shadow bg-white">
      <h2 style="text-xl font-bold mb-2">🧠 Résultat de l'analyse comportementale</h2>
      <p style="text-gray-800 mb-1">
        Score comportemental : <strong>{score}</strong>
      </Text>
      <p style="text-gray-800">
        Statut :{" "}
        <Text style={suspicious ? "text-red-600 font-semibold" : "text-green-600 font-semibold"}>
          {suspicious ? "Comportement suspect détecté" : "Comportement normal"}
        </Text>
      </Text>
    </View>
  );
};

export default BehaviorScoreCard;

