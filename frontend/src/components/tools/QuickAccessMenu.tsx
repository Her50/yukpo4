// @ts-check
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/routes/AppRoutesRegistry";
import { X, Menu } from "lucide-react";

const QuickAccessMenu: React.FC = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const links = [
    {
      label: "➕ Créer un service",
      path: ROUTES.CREATION_SMART_SERVICE,
    },
    {
      label: "🔍 Rechercher une solution",
      path: ROUTES.RECHERCHE_BESOIN,
    },
    {
      label: "🧠 Outils intelligents Yukpo",
      path: ROUTES.YUKPO_IA_HUB,
    },
  ];

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-5 right-5 z-50 bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-xl transition-transform hover:scale-110 border-4 border-white dark:border-gray-900"
        aria-label="Menu d'accès rapide"
      >
        {open ? <X size={22} /> : <Menu size={24} />}
      </button>

      {open && (
        <div className="fixed bottom-24 right-5 z-50 w-72 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl p-5 animate-fade-in space-y-2">
          <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-3">
            🚀 Accès rapide Yukpo
          </h4>
          {links.map((link) => (
            <button
              key={link.path}
              onClick={() => {
                navigate(link.path);
                setOpen(false);
              }}
              className="text-sm text-left px-4 py-2 rounded-md bg-gray-100 dark:bg-gray-800 hover:bg-yellow-100 dark:hover:bg-gray-700 transition"
            >
              {link.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
};

export default QuickAccessMenu;
