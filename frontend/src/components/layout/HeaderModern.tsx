
// ✅ 📁 src/components/layout/HeaderModern.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import LogoYukpo from '@/components/ui/LogoYukpo';
import LangSwitcher from '@/components/ui/LanguageSwitcher';
import AvatarMenu from '@/components/ui/AvatarMenu';

const HeaderModern: React.FC = () => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-300 dark:border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link to="/">
          <LogoYukpo />
        </Link>
        <div className="flex items-center space-x-4">
          <LangSwitcher />
          <AvatarMenu />
        </div>
      </div>
    </header>
  );
};

export default HeaderModern;
