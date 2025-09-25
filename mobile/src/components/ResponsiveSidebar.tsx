import React, { useState } from "react";
import { Link, useLocation } from "@react-navigation/native";
import { Menu, X } from "lucide-react";

type SidebarLink = {
  label: string;
  path: string;
};

const links: SidebarLink[] = [
  { label: "Dashboard", path: "/admin/dashboard" },
  { label: "Utilisateurs", path: "/admin/users" },
  { label: "Services", path: "/admin/services" },
  { label: "Statistiques", path: "/admin/stats" },
  { label: "Paramètres", path: "/admin/settings" },
];

const ResponsiveSidebar: React.FC = () => {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <>
      <TouchableOpacity
        style="md:hidden fixed top-4 left-4 z-50 bg-white p-2 rounded-full shadow-md"
        onClick={() => setOpen(!open)}
        aria-label="Ouvrir le menu admin"
      >
        {open ? <X size={24} /> : <Menu size={24} />}
      </TouchableOpacity>

      <aside
        style={`fixed top-0 left-0 h-full w-64 bg-white shadow-lg z-40 transform transition-transform duration-300
          ${open ? "translate-x-0" : "-translate-x-full"} md:translate-x-0 md:static`}
      >
        <View style="p-6 border-b text-center font-bold text-lg text-primary">
          🎯 Admin Panel
        </View>
        <nav style="p-4 flex flex-col gap-2">
          {links.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              style={`px-4 py-2 rounded hover:bg-gray-100 ${
                isActive(link.path) ? "bg-gray-200 font-semibold" : ""
              }`}
              onClick={() => setOpen(false)}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </aside>
    </>
  );
};

export default ResponsiveSidebar;

