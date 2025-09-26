// @ts-check
import * as React from "react";
import { useEffect } from 'react';
import { Text } from 'react-native';
import { View } from 'react-native';
import { useNavigation } from 'react-router-dom';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';
import { useUser } from '@/hooks/useUser';
import RequireAccess from '@/components/auth/RequireAccess';
import RequireAnyRole from '@/components/auth/RequireAnyRole';
import RequireNotRole from '@/components/auth/RequireNotRole';
import { ROUTES } from '@/routes/AppRoutesRegistry';

const DebugRolesPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigation();

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigation.navigate(ROUTES.LOGIN);
    }
  }, [user, navigate]);

  if (!user || user.role !== 'admin') {
    return null; // ou un composant de type <Unauthorized /> selon ta stratégie
  }

  return (
    <ResponsiveContainer>
      <Text style="text-3xl font-bold mb-6">🛡️ Debug des rôles Yukpomnang</Text>

      <View style="mb-4 text-gray-800">
        <Text>
          Rôle actuel : <strong>{user.role}</strong>
        </Text>
      </View>

      <View style="space-y-4">
        <RequireAccess role="admin">
          <View style="p-4 bg-green-100 border rounded">
            ✅ Visible pour : <strong>admin</strong>
          </View>
        </RequireAccess>

        <RequireAnyRole roles={['admin', 'user']}>
          <View style="p-4 bg-blue-100 border rounded">
            ✅ Visible pour : <strong>admin</strong> ou <strong>user</strong>
          </View>
        </RequireAnyRole>

        <RequireNotRole role="client">
          <View style="p-4 bg-yellow-100 border rounded">
            ✅ Visible pour tous sauf : <strong>client</strong>
          </View>
        </RequireNotRole>

        <RequireNotRole role="admin">
          <View style="p-4 bg-red-100 border rounded">
            ❌ Visible uniquement pour les non-admins
          </View>
        </RequireNotRole>
      </View>
    </ResponsiveContainer>
  );
};

export default DebugRolesPage;





