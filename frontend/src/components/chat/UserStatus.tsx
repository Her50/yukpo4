import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface UserStatusProps {
  user: {
    id: string;
    nom: string;
    email: string;
    avatar?: string;
    status?: 'online' | 'offline' | 'away' | 'busy';
    lastSeen?: Date;
  };
  showStatus?: boolean;
  showAvatar?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const UserStatus: React.FC<UserStatusProps> = ({
  user,
  showStatus = true,
  showAvatar = true,
  size = 'md',
  className
}) => {
  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-500';
      case 'away':
        return 'bg-yellow-500';
      case 'busy':
        return 'bg-red-500';
      case 'offline':
      default:
        return 'bg-gray-400';
    }
  };

  const getStatusText = (status?: string) => {
    switch (status) {
      case 'online':
        return 'En ligne';
      case 'away':
        return 'Absent';
      case 'busy':
        return 'Occupé';
      case 'offline':
        return 'Hors ligne';
      default:
        return 'Hors ligne';
    }
  };

  const getSizeClasses = (size: string) => {
    switch (size) {
      case 'sm':
        return {
          avatar: 'w-6 h-6',
          status: 'w-2 h-2',
          text: 'text-xs'
        };
      case 'lg':
        return {
          avatar: 'w-12 h-12',
          status: 'w-4 h-4',
          text: 'text-base'
        };
      default:
        return {
          avatar: 'w-8 h-8',
          status: 'w-3 h-3',
          text: 'text-sm'
        };
    }
  };

  const sizeClasses = getSizeClasses(size);

  const formatLastSeen = (date?: Date) => {
    if (!date) return '';
    
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'À l\'instant';
    if (minutes < 60) return `Il y a ${minutes} min`;
    if (hours < 24) return `Il y a ${hours}h`;
    if (days < 7) return `Il y a ${days}j`;
    
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short'
    });
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {showAvatar && (
        <div className="relative">
          <Avatar className={sizeClasses.avatar}>
            <AvatarImage src={user.avatar} alt={user.nom} />
            <AvatarFallback>
              {user.nom.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {showStatus && (
            <div
              className={cn(
                'absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-white',
                sizeClasses.status,
                getStatusColor(user.status)
              )}
            />
          )}
        </div>
      )}
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn('font-medium truncate', sizeClasses.text)}>
            {user.nom}
          </span>
          {showStatus && user.status && (
            <Badge 
              variant={user.status === 'online' ? 'default' : 'secondary'}
              className="text-xs"
            >
              {getStatusText(user.status)}
            </Badge>
          )}
        </div>
        
        {showStatus && user.status === 'offline' && user.lastSeen && (
          <p className="text-xs text-gray-500">
            {formatLastSeen(user.lastSeen)}
          </p>
        )}
      </div>
    </div>
  );
}; 