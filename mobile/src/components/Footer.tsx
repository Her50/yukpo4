// src/components/Footer.tsx
// @ts-check
import React from "react";
import { Link } from "@react-navigation/native";
import { ROUTES } from "@/routes/AppRoutesRegistry";

// Utilitaire React pour branding Yukpo
export const YukpoBrand: React.FC<{className?: string}> = ({className = ""}) => (
  <Text style={"font-bold " + className}>
    <Text style="text-yellow-500">Yuk</Text><Text style="text-red-600">po</Text>
  </Text>
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
  <footer style="w-full border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 text-sm py-10 px-6">
    <View style="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
      
      {/* Bloc 1 : Brand + Signature */}
      <View style="flex flex-col gap-2">
        <View style="text-lg font-bold text-gray-800 dark:text-white">
          <YukpoBrand />
        </View>
        <p style="text-sm leading-relaxed">
          L’assistant intelligent qui transforme vos besoins en solutions.
        </Text>
        <p style="text-xs mt-1 text-gray-400">
          © {new Date().getFullYear()} — Tous droits réservés.
        </Text>
      </View>

      {/* Bloc 2 : Liens légaux */}
      <View style="flex flex-col gap-2">
        <h3 style="text-md font-semibold text-gray-800 dark:text-gray-200">Liens utiles</h3>
        <nav style="flex flex-col gap-1 text-sm">
          {uniqueLinks.map(({ path, label }) => (
            <Link
              key={path + '-' + label}
              to={path}
              style="hover:underline hover:text-primary transition"
            >
              {label}
            </Link>
          ))}
        </nav>
      </View>

      {/* Bloc 3 : Contact rapide */}
      <View style="flex flex-col gap-2">
        <h3 style="text-md font-semibold text-gray-800 dark:text-gray-200">Contact</h3>
        <p style="text-sm">📞 +237 6 90 00 00 00</Text>
        <p style="text-sm">📧 contact@yukpo.app</Text>
        <p style="text-sm">💬 WhatsApp : +237 6 70 00 00 00</Text>
      </View>
    </View>
  </footer>
);

export default Footer;

