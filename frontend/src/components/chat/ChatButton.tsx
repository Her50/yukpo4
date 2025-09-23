import { Button } from '@/components/ui/buttons';
import { MessageCircle } from 'lucide-react';
import React from 'react';

interface ChatButtonProps {
  onClick: () => void;
  unreadCount?: number;
  className?: string;
  title?: string;
  children?: React.ReactNode;
}

export const ChatButton: React.FC<ChatButtonProps> = ({
  onClick,
  unreadCount = 0,
  className = "w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center",
  title = "Ouvrir le chat",
  children
}) => {
  return (
    <Button
      onClick={onClick}
      className={className}
      title={title}
    >
      {children || <MessageCircle className="w-5 h-5" />}
      {unreadCount > 0 && (
        <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
          {unreadCount > 9 ? '9+' : unreadCount}
        </div>
      )}
    </Button>
  );
};

export default ChatButton; 