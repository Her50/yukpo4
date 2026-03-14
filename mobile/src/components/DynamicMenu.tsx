// @ts-nocheck
import { ROUTES_CONFIG, Role } from "@/routes/routes";
import React from 'react';
import { Text, View } from 'react-native';
import { isAdminRole } from "../utils/roleHelpers"; // ✅ CORRECTION 2026-02-06: Vérifier admin OU super_admin

interface Props {
  role: Role;
}

const DynamicMenu: React.FC<Props> = ({ role }) => {
  const rc: any = ROUTES_CONFIG;
  const routesByRole = {
    public: Array.isArray(rc) ? rc.filter((r: any) => r.roles?.includes('public')) : rc.public || [],
    user: Array.isArray(rc) ? rc.filter((r: any) => r.roles?.includes('user')) : rc.protected || [],
    admin: Array.isArray(rc) ? rc.filter((r: any) => r.roles?.includes('admin')) : rc.admin || [],
  };

  return (
    <View style="space-y-6">
      {/* ✅ CORRECTION 2026-02-06: Vérifier admin OU super_admin */}
      {isAdminRole(role) && (
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





