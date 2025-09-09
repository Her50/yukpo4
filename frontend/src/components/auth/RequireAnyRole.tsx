import { ReactNode } from 'react';
import { useUserContext } from '@/context/UserContext';
import type { Role } from '@/types/roles'; // ✅ Correction ici

interface RequireAnyRoleProps {
  roles: Role[];
  children: ReactNode;
  fallback?: ReactNode;
}

const RequireAnyRole: React.FC<RequireAnyRoleProps> = ({
  roles,
  children,
  fallback = null,
}) => {
  const { user } = useUserContext();
  const userRoles: Role[] = user?.roles ?? [];

  const hasAnyRole = roles.some((role) => userRoles.includes(role));

  if (!user || !hasAnyRole) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

export default RequireAnyRole;
