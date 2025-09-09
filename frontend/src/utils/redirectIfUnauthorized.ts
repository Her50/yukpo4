// @ts-check

/**
 * Redirige l'utilisateur s'il n'a pas les accès requis à une page.
 * @param user - L'utilisateur connecté
 * @param pageAccess - Les rôles et plans requis pour accéder à la page
 * @returns Une chaîne de redirection ("/login", "/403") ou null si autorisé
 */
export function redirectIfUnauthorized(
  user: { role?: string; plan?: string } | null,
  pageAccess: { roles: string[]; plans: string[] } | null
): string | null {
  if (!user || !user.role || !user.plan) return '/login';
  if (!pageAccess) return '/403';

  const hasRole = pageAccess.roles.includes(user.role);
  const hasPlan = pageAccess.plans.includes(user.plan);

  if (!hasRole || !hasPlan) return '/403';

  return null;
}
