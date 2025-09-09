import React from 'react';
import { Button } from '@/components/ui/buttons/Button';
import { Eye, EyeOff } from 'lucide-react';

interface MessageBubbleProps {
  message: any;
  onDelete: (messageId: string) => void;
  formatTime: (date: Date | string) => string;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  onDelete,
  formatTime
}) => {
  const isClient = message.from === 'client';

  const renderMessageContent = () => {
    switch (message.type) {
      case 'audio':
        return (
          <div className="flex items-center gap-2">
            <span className="text-sm">🎵</span>
            <audio 
              controls 
              className="max-w-full"
              src={message.audioUrl || (message.audioBlob ? URL.createObjectURL(message.audioBlob) : '')}
            >
              Votre navigateur ne supporte pas l'élément audio.
            </audio>
          </div>
        );
      
      case 'image':
        return (
          <div className="space-y-2">
            <img 
              src={message.fileUrl} 
              alt={message.fileName || 'Image'}
              className="max-w-full rounded-lg shadow-sm"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
            <div className="hidden text-xs opacity-70">
              🖼️ {message.fileName || 'Image'}
            </div>
          </div>
        );
      
      case 'video':
        return (
          <div className="space-y-2">
            <video 
              controls 
              className="max-w-full rounded-lg shadow-sm"
              src={message.fileUrl}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            >
              Votre navigateur ne supporte pas l'élément vidéo.
            </video>
            <div className="hidden text-xs opacity-70">
              🎥 {message.fileName || 'Vidéo'}
            </div>
          </div>
        );
      
      case 'document':
        return (
          <div className="flex items-center gap-2 p-2 bg-gray-100 rounded-lg">
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{message.fileName || 'Document'}</p>
              <p className="text-xs text-gray-500">
                {message.fileSize ? `${(message.fileSize / 1024 / 1024).toFixed(1)} MB` : 'Document'}
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => window.open(message.fileUrl, '_blank')}
              className="text-blue-600 hover:text-blue-800"
            >
              Ouvrir
            </Button>
          </div>
        );
      
      default:
        return <p className="text-sm">{message.content}</p>;
    }
  };

  return (
    <div className={`flex ${isClient ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-xs px-3 py-2 rounded-lg ${
          isClient
            ? 'bg-blue-600 text-white'
            : 'bg-white text-gray-800 border'
        }`}
      >
        {renderMessageContent()}
        
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs opacity-70">
            {formatTime(message.timestamp)}
          </span>
          {isClient && (
            <div className="flex items-center gap-1">
              {message.status === 'sent' && <Eye className="w-3 h-3" />}
              {message.status === 'delivered' && <Eye className="w-3 h-3" />}
              {message.status === 'read' && <EyeOff className="w-3 h-3" />}
              
              {/* Bouton de suppression */}
              <button
                onClick={() => onDelete(message.id)}
                className="text-red-500 hover:text-red-700 ml-2"
                title="Supprimer le message"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble; 