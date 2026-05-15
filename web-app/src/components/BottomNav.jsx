import { NavLink } from 'react-router-dom'

const tabs = [
  { to: '/pharmacie', label: 'Pharmacie', icon: '💊' },
  { to: '/livres', label: 'Livres', icon: '📚' },
  { to: '/restaurant', label: 'Restaurant', icon: '🍽️' },
]

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 safe-bottom">
      <div className="flex">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center py-2 text-xs font-medium transition-colors ${
                isActive ? 'text-primary' : 'text-gray-500'
              }`
            }
          >
            <span className="text-2xl leading-none mb-0.5">{tab.icon}</span>
            {tab.label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
