import { ReactNode } from 'react';
import { useUserContext } from '@/context/UserContext';

interface RequireNotRoleProps {
  role: 'admin' | 'user' | 'client' | 'public'; // adapte ici selon ton modèle
  children: ReactNode;
  fallback?: ReactNode;
}

const RequireNotRole: React.FC<RequireNotRoleProps> = ({
  role,
  children,
  fallback = null,
}) => {
  const { user } = useUserContext();
  const userRoles: string[] = user?.roles ?? [];

  const isExcluded = userRoles.includes(role);

  if (!user || isExcluded) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

export default RequireNotRole;
