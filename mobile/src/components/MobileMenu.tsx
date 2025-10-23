// @ts-check
import { useUser } from "@/hooks/useUser";
import { ROUTES } from "@/routes/AppRoutesRegistry";
import { Link } from "@react-navigation/native";
import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { TouchableOpacity, View } from 'react-native';

const MobileMenu: React.FC = () => {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { user, logout } = useUser();
  const { i18n, t } = useTranslation();

  const toggleMenu = () => setOpen((prev) => !prev);

  const handleLogout = () => {
    if (confirm("🔒 Voulez-vous vous déconnecter ?")) {
      logout();
      setOpen(false);
    }
  };

  useEffect(() => {
    // En React Native, nous n'avons pas besoin de gérer les clics extérieurs
    // car les composants mobiles gèrent cela différemment
    // Cette logique est remplacée par la gestion native des interactions
  }, [open]);

  const baseLinks = [
    { to: ROUTES.HOME, label: "Accueil" },
    { to: ROUTES.SERVICES, label: "Services" },
    { to: ROUTES.CATALOGUE, label: "Catalogue" },
    { to: ROUTES.CONTACT, label: "Contact" },
    { to: ROUTES.ABOUT, label: "À propos" },
  ];

  const extraLinks: { to: string; label: string }[] = [];

  if (user) {
    extraLinks.push({ to: ROUTES.ESPACE, label: "Mon Espace" });

    if (user.role === "admin") {
      extraLinks.push({ to: ROUTES.DASHBOARD_ADMIN_AUDIT, label: "Audit sécurité" });
    }
  }

  const allLinks = [...baseLinks, ...extraLinks];
  const uniqueLinks = allLinks.filter(
    (link, index, self) => index === self.findIndex((l) => l.to === link.to)
  );

  return (
    <View style="md:hidden relative z-50" ref={menuRef}>
      <TouchableOpacity
        onPress={toggleMenu}
        style="p-2 text-xl text-primary"
        aria-label="Menu mobile"
      >
        ☰
      </TouchableOpacity>

      {open && (
        <View style="absolute top-14 right-0 bg-white dark:bg-gray-800 w-72 max-h-[85vh] overflow-y-auto rounded shadow-lg p-4 text-sm border dark:border-gray-700">
          <nav style="flex flex-col gap-3">
            {uniqueLinks.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                onPress={() => setOpen(false)}
                style="hover:text-primary"
              >
                {label}
              </Link>
            ))}

            <View style="border-t border-gray-300 dark:border-gray-600 pt-3 mt-2 text-xs text-gray-600 dark:text-gray-300">
              {user ? (
                <>
                  <View>
                    Rôle : <strong>{user.role}</strong>
                  </View>
                  <TouchableOpacity
                    onPress={handleLogout}
                    style="text-red-600 hover:underline mt-2"
                  >
                    🚪 {t("Déconnexion")}
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Link
                    to={ROUTES.LOGIN}
                    onPress={() => setOpen(false)}
                    style="text-blue-600 hover:underline"
                  >
                    Connexion
                  </Link>
                  <Link
                    to={ROUTES.REGISTER}
                    onPress={() => setOpen(false)}
                    style="text-yellow-600 hover:underline"
                  >
                    Inscription
                  </Link>
                </>
              )}
            </View>

            <select
              style="mt-4 border px-2 py-1 rounded bg-white dark:bg-gray-700 dark:text-white"
              value={i18n.language}
              onChange={(e) => i18n.changeLanguage(e.target.value)}
            >
              <option value="fr">🇫🇷 Français</option>
              <option value="en">🇬🇧 English</option>
              <option value="pt">🇵🇹 Português</option>
              <option value="ar">🇸🇦 العربية</option>
              <option value="ff">🌍 Fula</option>
            </select>
          </nav>
        </View>
      )}
    </View>
  );
};

export default MobileMenu;





