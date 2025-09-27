// src/components/tools/DevFloatingMenu.tsx
import { ROUTES } from "@/routes/AppRoutesRegistry";
import { Bug, X } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const DevFloatingMenu: React.FC = () => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const links = [
    { label: "🏠 Accueil", path: ROUTES.HOME },
    { label: "🔐 Connexion", path: ROUTES.LOGIN },
    { label: "🆕 Inscription", path: ROUTES.REGISTER },
    { label: "📦 Services", path: ROUTES.SERVICES },
    { label: "💼 Tous les plans", path: ROUTES.PLANS },
    { label: "✨ Plan Pro", path: ROUTES.PLAN_PRO },
    { label: "🏢 Plan Entreprise", path: ROUTES.PLAN_ENTERPRISE },
    { label: "🎯 Match", path: ROUTES.MATCH },
    { label: "📊 Dashboard", path: ROUTES.DASHBOARD },
    { label: "🛠 Mes services", path: ROUTES.MES_SERVICES },
    { label: "🌟 Opportunités", path: ROUTES.MES_OPPORTUNITES },
    { label: "📞 Contact", path: ROUTES.CONTACT },
    { label: "🧭 Mon espace", path: ROUTES.ESPACE },
  ];

  const isLocal = false; // Production uniquement

  useEffect(() => {
    if (isLocal) {
      // @ts-ignore
      window.__YUKPOMNANG_TOGGLE_DEV = () => setOpen((v) => !v);
      console.log("✅ Dev toggle enregistré: __YUKPOMNANG_TOGGLE_DEV()");
    }
  }, []);

  if (!isLocal) return null;

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-5 left-5 z-50 bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 text-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg hover:scale-105 transition duration-300 border-2 border-white"
        aria-label="Menu développeur"
      >
        {open ? <X size={20} /> : <Bug size={20} />}
      </button>

      {open && (
        <div className="fixed bottom-20 left-5 z-50 w-64 max-h-[80vh] overflow-y-auto bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl shadow-xl p-4 animate-fade-in">
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-sm font-bold text-gray-700 dark:text-gray-200">
              ⚙️ Dev Access
            </h4>
            <button onClick={() => setOpen(false)} aria-label="Fermer">
              <X size={16} className="text-gray-400 hover:text-red-500 transition" />
            </button>
          </div>
          <div className="flex flex-col space-y-2">
            {links.map((link) => (
              <button
                key={link.label}
                onClick={() => {
                  navigate(link.path);
                  setOpen(false);
                }}
                className="text-sm text-left text-primary hover:underline hover:text-yellow-600"
              >
                {link.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

export default DevFloatingMenu;
