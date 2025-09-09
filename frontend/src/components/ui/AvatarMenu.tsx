import { Menu } from '@headlessui/react';
import { ChevronDown, LogOut, User } from 'lucide-react';
import { useUser } from '@/hooks/useUser';
import clsx from 'clsx';

const AvatarMenu: React.FC = () => {
  const { user, logout } = useUser();
  if (!user) return null;

  const initials = user.name?.[0]?.toUpperCase() ?? 'U';
  const credits = user.credits ?? 0;
  const currency = user.currency ?? 'XAF';

  return (
    <Menu as="div" className="relative inline-block text-left">
      <Menu.Button className="flex items-center gap-2 bg-white dark:bg-gray-900 px-3 py-1 rounded-full shadow hover:ring-2 ring-blue-400 transition-all">
        <div className="w-8 h-8 bg-gradient-to-tr from-blue-500 to-cyan-500 text-white flex items-center justify-center rounded-full font-bold text-sm">
          {initials}
        </div>
        <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
          {credits.toLocaleString()} {currency}
        </div>
        <ChevronDown className="w-4 h-4 text-gray-400" />
      </Menu.Button>

      <Menu.Items className="absolute right-0 mt-2 w-48 origin-top-right bg-white dark:bg-gray-800 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50 focus:outline-none">
        <div className="py-1">
          <Menu.Item>
            {({ active }) => (
              <button
                onClick={() => window.location.href = '/profil'}
                className={clsx('w-full text-left px-4 py-2 text-sm', active && 'bg-blue-100 dark:bg-gray-700')}
              >
                <User className="inline mr-2 w-4 h-4" />
                Profil
              </button>
            )}
          </Menu.Item>
          <Menu.Item>
            {({ active }) => (
              <div className={clsx('px-4 py-2 text-sm text-gray-500', active && 'bg-blue-50')}>
                💰 {credits.toLocaleString()} {currency}
              </div>
            )}
          </Menu.Item>
          <Menu.Item>
            {({ active }) => (
              <button
                onClick={logout}
                className={clsx('w-full text-left px-4 py-2 text-sm text-red-600', active && 'bg-red-100')}
              >
                <LogOut className="inline mr-2 w-4 h-4" />
                Déconnexion
              </button>
            )}
          </Menu.Item>
        </div>
      </Menu.Items>
    </Menu>
  );
};

export default AvatarMenu;
