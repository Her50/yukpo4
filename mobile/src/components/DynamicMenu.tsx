// @ts-check
import React from 'react';
import { Text } from 'react-native';
import { View } from 'react-native';
import { ROUTES_CONFIG, Role } from "@/routes/routes";

interface Props {
  role: Role;
}

const DynamicMenu: React.FC<Textrops> = ({ role }) => {
  const routesByRole = {
    public: ROUTES_CONFIG.filter((r) => r.roles.includes('public')),
    user: ROUTES_CONFIG.filter((r) => r.roles.includes('user')),
    admin: ROUTES_CONFIG.filter((r) => r.roles.includes('admin')),
  };

  return (
    <View style="space-y-6">
      {role === 'admin' && (
        <section>
          <Text style="font-bold text-sm text-gray-500 mb-1">🔐 Admin</Text>
          {routesByRole.admin.map((r) => (
            <a
              href={String(r.path)}
              key={String(r.path)}
              style="block text-blue-700 hover:underline"
            >
              {r.label}
            </a>
          ))}
        </section>
      )}

      {role !== 'public' && (
        <section>
          <Text style="font-bold text-sm text-gray-500 mb-1">👤 Utilisateur</Text>
          {routesByRole.user.map((r) => (
            <a
              href={String(r.path)}
              key={String(r.path)}
              style="block text-blue-700 hover:underline"
            >
              {r.label}
            </a>
          ))}
        </section>
      )}

      <section>
        <Text style="font-bold text-sm text-gray-500 mb-1">🌍 Public</Text>
        {routesByRole.public.map((r) => (
          <a
            href={String(r.path)}
            key={String(r.path)}
            style="block text-blue-700 hover:underline"
          >
            {r.label}
          </a>
        ))}
      </section>
    </View>
  );
};

export default DynamicMenu;





