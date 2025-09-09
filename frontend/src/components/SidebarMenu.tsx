// @ts-check
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ROUTES_CONFIG } from "@/routes/routes";

type Role = 'public' | 'user' | 'admin';

interface SidebarMenuProps {
  currentRole: Role;
}

const SidebarMenu: React.FC<SidebarMenuProps> = ({ currentRole }) => {
  const location = useLocation();

  const groupedRoutes: Record<Role, typeof ROUTES_CONFIG> = {
    public: [],
    user: [],
    admin: [],
  };

  for (const route of ROUTES_CONFIG) {
    for (const role of route.roles) {
      if (!groupedRoutes[role].some((r) => r.path === route.path)) {
        groupedRoutes[role].push(route);
      }
    }
  }

  // ✅ Correction ici
  const sectionOrder: Role[] = ['admin', 'user', 'public'];

  const roleLabels: Record<Role, string> = {
    admin: '🔐 Admin',
    user: '👤 Utilisateur',
    public: '🌐 Public',
  };

  return (
    <nav className="p-4 space-y-6 text-sm">
      {sectionOrder.map((role) => {
        const items = groupedRoutes[role].filter(
          (r) => r.roles.includes(currentRole) || currentRole === 'admin'
        );

        if (items.length === 0) return null;

        return (
          <div key={role}>
            <h4 className="uppercase text-gray-500 text-xs font-semibold mb-2">
              {roleLabels[role]}
            </h4>
            <ul className="space-y-1">
              {items.map((route) => (
                <li key={route.path}>
                  <Link
                    to={route.path}
                    className={`block px-3 py-1.5 rounded hover:bg-orange-100 ${
                      location.pathname === route.path
                        ? 'bg-orange-200 text-orange-800 font-semibold'
                        : 'text-gray-800'
                    }`}
                  >
                    {route.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
};

export default SidebarMenu;
