import React from 'react';

interface NotificationBadgeProps {
  count: number;
  maxCount?: number;
  className?: string;
  variant?: 'default' | 'error' | 'success' | 'warning';
}

const NotificationBadge: React.FC<NotificationBadgeProps> = ({
  count,
  maxCount = 99,
  className = '',
  variant = 'error'
}) => {
  if (count <= 0) return null;

  const displayCount = count > maxCount ? `${maxCount}+` : count.toString();

  const getVariantStyles = () => {
    switch (variant) {
      case 'error':
        return 'bg-red-500 text-white';
      case 'success':
        return 'bg-green-500 text-white';
      case 'warning':
        return 'bg-yellow-500 text-white';
      default:
        return 'bg-blue-500 text-white';
    }
  };

  return (
    <span
      className={`
        absolute -top-1 -right-1 
        min-w-[18px] h-[18px] 
        rounded-full 
        text-xs font-bold 
        flex items-center justify-center
        ${getVariantStyles()}
        ${className}
      `}
      style={{
        fontSize: '10px',
        lineHeight: '1',
        padding: '2px 4px',
        minWidth: '18px',
        height: '18px'
      }}
    >
      {displayCount}
    </span>
  );
};

export default NotificationBadge;
