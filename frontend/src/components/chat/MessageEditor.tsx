import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/buttons';
import { Edit2, X, Check, RotateCcw } from 'lucide-react';

interface MessageEditorProps {
  message: {
    id: string;
    content: string;
    type: 'text' | 'audio' | 'image' | 'video' | 'document';
  };
  isEditing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: (messageId: string, newContent: string) => Promise<boolean>;
  onDelete: (messageId: string) => Promise<boolean>;
}

export const MessageEditor: React.FC<MessageEditorProps> = ({
  message,
  isEditing,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete
}) => {
  const [editContent, setEditContent] = useState(message.content);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus sur le textarea quand l'édition commence
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  // Gérer la sauvegarde
  const handleSave = async () => {
    if (!editContent.trim() || editContent === message.content) {
      onCancelEdit();
      return;
    }

    setIsSaving(true);
    try {
      const success = await onSaveEdit(message.id, editContent.trim());
      if (success) {
        onCancelEdit();
      }
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Gérer la suppression
  const handleDelete = async () => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce message ?')) {
      return;
    }

    setIsDeleting(true);
    try {
      const success = await onDelete(message.id);
      if (success) {
        onCancelEdit();
      }
    } catch (error) {
      console.error('Erreur suppression:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  // Gérer les touches clavier
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      onCancelEdit();
    }
  };

  // Seulement pour les messages texte
  if (message.type !== 'text') {
    return null;
  }

  if (isEditing) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-blue-600 font-medium">✏️ Modification du message</span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={onCancelEdit}
              className="text-gray-500 hover:text-gray-700"
              disabled={isSaving}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        <textarea
          ref={textareaRef}
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full p-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          rows={Math.min(3, Math.max(1, editContent.split('\n').length))}
          placeholder="Modifiez votre message..."
          disabled={isSaving}
        />
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={onCancelEdit}
              disabled={isSaving}
              className="text-gray-600 hover:text-gray-800"
            >
              Annuler
            </Button>
            <Button
              size="sm"
              onClick={handleDelete}
              disabled={isSaving || isDeleting}
              className="text-red-600 hover:text-red-800 border-red-300 hover:border-red-400"
            >
              {isDeleting ? (
                <>
                  <RotateCcw className="w-4 h-4 animate-spin mr-1" />
                  Suppression...
                </>
              ) : (
                'Supprimer'
              )}
            </Button>
          </div>
          
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving || !editContent.trim() || editContent === message.content}
            className="bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400"
          >
            {isSaving ? (
              <>
                <RotateCcw className="w-4 h-4 animate-spin mr-1" />
                Sauvegarde...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-1" />
                Sauvegarder
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      <Button
        size="sm"
        variant="ghost"
        onClick={onStartEdit}
        className="text-gray-500 hover:text-gray-700 p-1 h-6 w-6"
        title="Modifier le message"
      >
        <Edit2 className="w-3 h-3" />
      </Button>
    </div>
  );
};

export default MessageEditor; 