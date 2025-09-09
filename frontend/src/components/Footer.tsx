// src/components/Footer.tsx
// @ts-check
import React from "react";
import { Link } from "react-router-dom";
import { ROUTES } from "@/routes/AppRoutesRegistry";

// Utilitaire React pour branding Yukpo
export const YukpoBrand: React.FC<{className?: string}> = ({className = ""}) => (
  <span className={"font-bold " + className}>
    <span className="text-yellow-500">Yuk</span><span className="text-red-600">po</span>
  </span>
);

const legalLinks = [
  { path: "/mentions-legales", label: "Mentions légales" },
  { path: "/confidentialite", label: "Confidentialité" },
  { path: "/cookies", label: "Cookies" },
  { path: "/a-propos", label: "À propos" },
];

const uniqueLinks = legalLinks.filter(
  (link, index, self) => self.findIndex((l) => l.path === link.path) === index
);

const Footer: React.FC = () => (
  <footer className="w-full border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 text-sm py-10 px-6">
    <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
      
      {/* Bloc 1 : Brand + Signature */}
      <div className="flex flex-col gap-2">
        <div className="text-lg font-bold text-gray-800 dark:text-white">
          <YukpoBrand />
        </div>
        <p className="text-sm leading-relaxed">
          L’assistant intelligent qui transforme vos besoins en solutions.
        </p>
        <p className="text-xs mt-1 text-gray-400">
          © {new Date().getFullYear()} — Tous droits réservés.
        </p>
      </div>

      {/* Bloc 2 : Liens légaux */}
      <div className="flex flex-col gap-2">
        <h3 className="text-md font-semibold text-gray-800 dark:text-gray-200">Liens utiles</h3>
        <nav className="flex flex-col gap-1 text-sm">
          {uniqueLinks.map(({ path, label }) => (
            <Link
              key={path + '-' + label}
              to={path}
              className="hover:underline hover:text-primary transition"
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Bloc 3 : Contact rapide */}
      <div className="flex flex-col gap-2">
        <h3 className="text-md font-semibold text-gray-800 dark:text-gray-200">Contact</h3>
        <p className="text-sm">📞 +237 6 90 00 00 00</p>
        <p className="text-sm">📧 contact@yukpo.app</p>
        <p className="text-sm">💬 WhatsApp : +237 6 70 00 00 00</p>
      </div>
    </div>
  </footer>
);

export default Footer;
