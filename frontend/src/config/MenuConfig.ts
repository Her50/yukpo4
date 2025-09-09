import React from 'react';
// @ts-check
export const MenuConfig = {
  public: [
    { label: 'Accueil', path: '/' },
    { label: 'Explorer', path: '/explore' },
    { label: 'Connexion', path: '/login' },
  ],
  client: [
    { label: 'Mes services', path: '/mes-services' },
    { label: 'Compte', path: '/mon-compte' },
  ],
  user: [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Historique', path: '/dashboard/history' },
  ],
  admin: [
    { label: 'Admin Panel', path: '/admin' },
    { label: 'Gestion services', path: '/admin/services' },
    { label: 'Gestion accès', path: '/admin/audit-access' },
  ],
};
