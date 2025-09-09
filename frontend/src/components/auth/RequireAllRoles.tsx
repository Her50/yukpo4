import { ReactNode } from 'react';
import { useUserContext } from '@/context/UserContext';

interface RequireAllRolesProps {
  roles: string[];
  children: ReactNode;
  fallback?: ReactNode;
}

const RequireAllRoles: React.FC<RequireAllRolesProps> = ({
  roles,
  children,
  fallback = null,
}) => {
  const { user } = useUserContext();
  const userRoles: string[] = user?.roles ?? [];

  const hasAllRoles = roles.every((role) => userRoles.includes(role));

  if (!user || !hasAllRoles) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

export default RequireAllRoles;
