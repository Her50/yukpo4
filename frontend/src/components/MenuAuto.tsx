// src/components/MenuAuto.tsx
import React from 'react';
// @ts-check
import { ROUTES } from "@/routes/routes";

interface MenuItem {
  label: string;
  path: string;
}

const menuItems: MenuItem[] = [
  { label: 'Accueil', path: ROUTES.HOME },
  { label: 'Tableau de bord', path: ROUTES.DASHBOARD },
  { label: 'À propos', path: ROUTES.ABOUT },
  { label: 'Connexion', path: ROUTES.LOGIN },
  // Ajoute d'autres routes ici si nécessaire
];

const MenuAuto: React.FC = () => {
  return (
    <nav className="space-y-2">
      {menuItems.map((item) => (
        <a key={item.path} href={item.path} className="block text-blue-600 hover:underline">
          {item.label}
        </a>
      ))}
    </nav>
  );
};

export default MenuAuto;
