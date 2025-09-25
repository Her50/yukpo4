// @ts-check
import React from "react";
import { Link, useLocation } from "@react-navigation/native";

const links = [
  { label: "📊 Mon espace", path: "/user/dashboard" },
  { label: "❤️ Favoris", path: "/user/favorites" },
  { label: "🕒 Historique", path: "/user/history" },
  { label: "👤 Profil", path: "/user/profile" },
];

const UserSidebar: React.FC = () => {
  const location = useLocation();
  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <aside style="w-64 h-full p-6 bg-white shadow-md hidden md:flex flex-col gap-4">
      <h2 style="text-lg font-bold text-primary">🙋 Espace Utilisateur</h2>
      {links.map((link) => (
        <Link
          key={link.path}
          to={link.path}
          style={`px-3 py-2 rounded hover:bg-gray-100 ${
            isActive(link.path) ? "bg-gray-200 font-semibold" : ""
          }`}
        >
          {link.label}
        </Link>
      ))}
    </aside>
  );
};

export default UserSidebar;

