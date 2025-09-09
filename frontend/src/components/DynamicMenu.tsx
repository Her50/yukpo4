// @ts-check
import React from 'react';
import { ROUTES_CONFIG, Role } from "@/routes/routes";

interface Props {
  role: Role;
}

const DynamicMenu: React.FC<Props> = ({ role }) => {
  const routesByRole = {
    public: ROUTES_CONFIG.filter((r) => r.roles.includes('public')),
    user: ROUTES_CONFIG.filter((r) => r.roles.includes('user')),
    admin: ROUTES_CONFIG.filter((r) => r.roles.includes('admin')),
  };

  return (
    <div className="space-y-6">
      {role === 'admin' && (
        <section>
          <h3 className="font-bold text-sm text-gray-500 mb-1">🔐 Admin</h3>
          {routesByRole.admin.map((r) => (
            <a
              href={String(r.path)}
              key={String(r.path)}
              className="block text-blue-700 hover:underline"
            >
              {r.label}
            </a>
          ))}
        </section>
      )}

      {role !== 'public' && (
        <section>
          <h3 className="font-bold text-sm text-gray-500 mb-1">👤 Utilisateur</h3>
          {routesByRole.user.map((r) => (
            <a
              href={String(r.path)}
              key={String(r.path)}
              className="block text-blue-700 hover:underline"
            >
              {r.label}
            </a>
          ))}
        </section>
      )}

      <section>
        <h3 className="font-bold text-sm text-gray-500 mb-1">🌍 Public</h3>
        {routesByRole.public.map((r) => (
          <a
            href={String(r.path)}
            key={String(r.path)}
            className="block text-blue-700 hover:underline"
          >
            {r.label}
          </a>
        ))}
      </section>
    </div>
  );
};

export default DynamicMenu;
