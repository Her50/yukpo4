// ✅ Utilitaires pour la gestion des rôles utilisateur
// Vérifie les rôles admin et super_admin de manière cohérente

export type UserRole = 'admin' | 'super_admin' | 'user' | 'client' | 'prestataire' | 'public';

/**
 * Vérifie si un rôle est admin ou super_admin
 * 
 * @param role - Le rôle à vérifier
 * @returns true si le rôle est admin ou super_admin, false sinon
 */
export function isAdminRole(role: string | undefined | null): boolean {
  if (!role) return false;
  return role === 'admin' || role === 'super_admin';
}

/**
 * Vérifie si un utilisateur a le rôle admin ou super_admin
 * 
 * @param user - L'utilisateur (doit avoir une propriété role)
 * @returns true si l'utilisateur est admin ou super_admin, false sinon
 */
export function isAdminUser(user: { role?: string } | null | undefined): boolean {
  if (!user || !user.role) return false;
  return isAdminRole(user.role);
}

