// src/components/AIHelper.tsx
import React from 'react';

interface AIHelperProps {
  role?: 'admin' | 'pro' | string;
  plan?: 'pro' | 'enterprise' | 'free' | string;
  context: 'dashboard' | 'services' | string;
}

type HelpContent = {
  [level: string]: {
    [context: string]: string;
  };
};

const help: HelpContent = {
  pro: {
    dashboard: '🧠 Utilisez la recherche IA pour trouver rapidement ce que vous cherchez.',
    services: '✨ Vous pouvez bénéficier d’une assistance personnalisée IA ici.',
  },
  admin: {
    dashboard: '📊 Visualisez les accès globaux selon les rôles et plans.',
  },
  enterprise: {
    services: '🤖 Assistance IA avancée pour la gestion de vos services.',
    dashboard: '📈 Analytique IA dédiée aux comptes premium.',
  },
};

const AIHelper: React.FC<AIHelperProps> = ({ role, plan, context }) => {
  const tip = help?.[plan || '']?.[context] || help?.[role || '']?.[context];

  return tip ? (
    <div className="p-2 bg-blue-100 text-sm rounded-md text-blue-800 font-medium">
      {tip}
    </div>
  ) : null;
};

export default AIHelper;
