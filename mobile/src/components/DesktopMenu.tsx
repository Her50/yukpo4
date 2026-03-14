// @ts-nocheck
import { Link, useLocation } from "@react-navigation/native";
import * as React from "react";
// @ts-ignore - web-only module
import { useUser } from "@/hooks/useUser";
import { ROUTES } from "@/routes/AppRoutesRegistry";
import classNames from "classnames";
import { isAdminUser } from "../utils/roleHelpers"; // ✅ CORRECTION 2026-02-06: Vérifier admin OU super_admin

const DesktopMenu: React.FC = () => {
  const { user } = useUser();
  const location = useLocation();
  const current = location.pathname;

  const baseLinks = [
    { path: ROUTES.HOME, label: "Accueil" },
    { path: ROUTES.SERVICES, label: "Services" },
    { path: ROUTES.CATALOGUE, label: "Catalogue" },
    { path: ROUTES.CONTACT, label: "Contact" },
    { path: ROUTES.ABOUT, label: "À propos" },
  ];

  const extraLinks: { path: string; label: string }[] = [];

  if (user?.id) {
    extraLinks.push({ path: ROUTES.ESPACE, label: "Espace Perso" });

    // ✅ CORRECTION 2026-02-06: Vérifier admin OU super_admin
    if (isAdminUser(user)) {
      extraLinks.push({ path: ROUTES.DASHBOARD_ADMIN_AUDIT, label: "Audit Sécurité" });
    }
  }

  const allLinks = [...baseLinks, ...extraLinks];
  const uniqueLinks = allLinks.filter(
    (link, index, self) => index === self.findIndex((l) => l.path === link.path)
  );

  const sizeClass =
    uniqueLinks.length <= 5
      ? "text-base gap-6"
      : uniqueLinks.length <= 9
        ? "text-sm gap-4"
        : "text-xs gap-3";

  return (
    <nav style="w-full overflow-x-auto">
      <ul
        style={classNames(
          "flex flex-nowrap items-center px-2 font-medium whitespace-nowrap transition-all",
          sizeClass
        )}
      >
        {uniqueLinks.map(({ path, label }) => {
          const isActive = current === path;
          return (
            <li key={path}>
              <Link
                to={path}
                style={classNames(
                  "transition-all duration-200 border-b-2 pb-1 hover:text-primary",
                  isActive
                    ? "text-black dark:text-white border-primary font-semibold"
                    : "text-gray-700 dark:text-gray-100 border-transparent"
                )}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default DesktopMenu;





