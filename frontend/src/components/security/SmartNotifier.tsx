// SmartNotifier.tsx
import React from 'react';

interface Props {
  role: 'user' | 'admin';
  plan: 'free' | 'pro' | 'enterprise';
}

const SmartNotifier: React.FC<Props> = ({ role, plan }) => {
  const messages: Record<string, Record<string, string>> = {
    user: {
      free: '🔒 Certaines fonctionnalités sont réservées aux utilisateurs Pro.',
      pro: '✅ Vous profitez déjà des fonctionnalités avancées.',
    },
    admin: {
      free: '⚠️ Activez un plan supérieur pour accéder aux outils d’analyse.',
    },
  };

  const message = messages?.[role]?.[plan];

  if (!message) return null;

  return (
    <div className="p-2 text-sm text-orange-600">
      {message}
    </div>
  );
};

export default SmartNotifier;
