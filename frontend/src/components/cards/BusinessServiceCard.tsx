import React from "react";
import StarRating from "@/components/notation/StarRating";
import { ROUTES } from "@/routes/AppRoutesRegistry";

interface Props {
  nom: string;
  description: string;
  categorie?: string;
  prix?: number;
  plan_requis?: "free" | "pro" | "enterprise";
  badge?: string;
  badgeColor?: string;
  note?: number;
  showNote?: boolean;
  onClick?: () => void;
}

const BusinessServiceCard: React.FC<Props> = ({
  nom,
  description,
  categorie,
  prix,
  plan_requis,
  badge,
  badgeColor = "#007bff",
  note = 4,
  showNote = true,
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className="relative p-5 border rounded-xl shadow-sm bg-white hover:shadow-md transition cursor-pointer"
    >
      {badge && (
        <div
          className="absolute top-2 right-2 px-2 py-1 text-xs rounded-full font-semibold text-white"
          style={{ backgroundColor: badgeColor }}
        >
          {badge}
        </div>
      )}

      <h3 className="text-lg font-bold text-gray-800 mb-1">{nom}</h3>
      <p className="text-sm text-gray-600 mb-2">{description}</p>

      {categorie && (
        <span className="inline-block text-xs text-gray-700 bg-gray-100 px-2 py-1 rounded-full mb-2">
          {categorie}
        </span>
      )}

      {prix !== undefined && (
        <p className="text-green-600 font-semibold mb-2">
          {prix.toLocaleString()} FCFA
        </p>
      )}

      {showNote && (
        <div className="mt-2">
          <StarRating note={note} />
        </div>
      )}

      {plan_requis && (
        <div className="mt-4 text-right">
          <button
            className="px-4 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
            onClick={() =>
              (window.location.href =
                plan_requis === "free"
                  ? ROUTES.SERVICES
                  : `${ROUTES.PLANS}/${plan_requis}`)
            }
          >
            {plan_requis === "free"
              ? "Tester ce service"
              : `Passer au plan ${plan_requis.toUpperCase()}`}
          </button>
        </div>
      )}
    </div>
  );
};

export default BusinessServiceCard;
