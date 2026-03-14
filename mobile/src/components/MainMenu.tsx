// @ts-nocheck
import React from 'react';
import { Link } from 'react-router-dom';
import { MenuConfig } from '@/config/MenuConfig';
import { useUser } from '@/hooks/useUser';

function MainMenu() {
  const userContext = useUser();
  const role = userContext?.user?.role || 'public';
  const menu = MenuConfig[role] || [];

  return (
    <nav style="flex gap-4 items-center px-4">
      {menu.map((item, idx) => (
        <Link
          key={idx}
          to={item.path}
          style="text-sm text-gray-700 hover:underline"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export default MainMenu;





