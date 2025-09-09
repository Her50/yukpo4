import React from 'react';

interface CrossRecoCardProps {
  title: string;
}

const CrossRecoCard: React.FC<CrossRecoCardProps> = ({ title }) => {
  return (
    <div className="border p-4 rounded-xl shadow-sm bg-white">
      <h3 className="text-lg font-bold">{title}</h3>
      <p className="text-sm text-gray-600">
        Suggestion personnalisée Yukpomnang
      </p>
    </div>
  );
};

export default CrossRecoCard;
