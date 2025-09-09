// @generated
import React from 'react';

interface Props {
  title: string;
  category: string;
  price: number;
  tag: string;
}

const CatalogueCard: React.FC<Props> = ({
  title,
  category,
  price,
  tag,
}) => {
  return (
    <div className="border rounded p-4 shadow hover:shadow-lg transition-all">
      <div className="text-lg font-semibold">{title}</div>
      <div className="text-sm text-gray-500">
        {category} • {tag}
      </div>
      <div className="text-right text-green-600 font-bold">
        {price} €
      </div>
    </div>
  );
};

export default CatalogueCard;
