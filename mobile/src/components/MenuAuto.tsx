// @ts-nocheck
// src/components/MenuAuto.tsx
import React from 'react';
// @ts-check
import { ROUTES } from "@/routes/routes";
import { useLanguageSafe } from '../contexts/LanguageContext';

interface MenuItem {
  label: string;
  path: string;
}

const menuItems: MenuItem[] = [
  { label: t('menuAuto.accueil'), path: ROUTES.HOME },
  { label: t('menuAuto.tableauDeBord'), path: ROUTES.DASHBOARD },
  { label: t('menuAuto.aPropos'), path: ROUTES.ABOUT },
  { label: t('menuAuto.connexion'), path: ROUTES.LOGIN },
  // Ajoute d'autres routes ici si nécessaire
];

const MenuAuto: React.FC = () => {
  return (
    <nav style="space-y-2">
      {menuItems.map((item) => (
        <a key={item.path} href={item.path} style="block text-blue-600 hover:underline">
          {item.label}
        </a>
      ))}
    </nav>
  );
};

export default MenuAuto;





