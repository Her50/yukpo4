import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/buttons/Button';
import { Mic, Image } from 'lucide-react';

interface ChatInputProps {
  onSendMessage: (message: any) => void;
  isTyping: boolean;
  setIsTyping: (typing: boolean) => void;
}

const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  isTyping,
  setIsTyping
}) => {
  const [newMessage, setNewMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [holdStartTime, setHoldStartTime] = useState<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fonction pour démarrer l'enregistrement audio avec délai
  const startAudioRecording = () => {
    if (isRecording) return;
    
    setHoldStartTime(Date.now());
    
    const timer = setTimeout(async () => {
      try {
        setRecordingSeconds(0);
        
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        const chunks: Blob[] = [];
        
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunks.push(event.data);
          }
        };
        
        recorder.onstop = () => {
          const audioBlob = new Blob(chunks, { type: 'audio/wav' });
          const audioUrl = URL.createObjectURL(audioBlob);
          
          const audioMessage = {
            id: Date.now().toString(),
            type: 'audio',
            content: '🎵 Message audio',
            timestamp: new Date().toISOString(),
            sender: 'client',
            from: 'client',
            isLocal: true,
            audioBlob: audioBlob,
            audioUrl: audioUrl
          };
          
          onSendMessage(audioMessage);
          setAudioChunks([]);
          stream.getTracks().forEach(track => track.stop());
          setRecordingSeconds(0);
        };
        
        recorder.start();
        mediaRecorderRef.current = recorder;
        setIsRecording(true);
        
        const interval = setInterval(() => {
          setRecordingSeconds(prev => prev + 1);
        }, 1000);
        
        setTimeout(() => {
          if (recorder.state === 'recording') {
            clearInterval(interval);
            stopAudioRecording();
          }
        }, 60000);
        
        recorder.addEventListener('stop', () => clearInterval(interval));
        
      } catch (error) {
        console.error('Erreur accès microphone:', error);
      }
    }, 300);
    
    recordingTimerRef.current = timer;
  };

  // Fonction pour arrêter l'enregistrement audio
  const stopAudioRecording = () => {
    if (recordingTimerRef.current) {
      clearTimeout(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    
    setHoldStartTime(null);
    
    if (!isRecording || !mediaRecorderRef.current) return;
    
    try {
      if (mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
    } catch (error) {
      console.error('Erreur arrêt enregistrement:', error);
    }
  };

  // Fonction pour annuler l'enregistrement
  const cancelRecording = () => {
    if (recordingTimerRef.current) {
      clearTimeout(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setHoldStartTime(null);
    
    if (isRecording && mediaRecorderRef.current) {
      try {
        if (mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
        setIsRecording(false);
      } catch (error) {
        console.error('Erreur annulation enregistrement:', error);
      }
    }
  };

  const handleSendTextMessage = () => {
    if (!newMessage.trim()) return;

    const message = {
      id: Date.now().toString(),
      from: 'client',
      content: newMessage,
      timestamp: new Date(),
      status: 'sent',
      type: 'text'
    };

    onSendMessage(message);
    setNewMessage('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendTextMessage();
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      if (file.size > 10 * 1024 * 1024) {
        console.error('Fichier trop volumineux:', file.name);
        return;
      }

      const message = {
        id: Date.now().toString() + Math.random(),
        from: 'client',
        content: file.type.startsWith('image/') ? '🖼️ Image' : '🎥 Vidéo',
        timestamp: new Date(),
        status: 'sent',
        type: file.type.startsWith('image/') ? 'image' : 'video',
        fileUrl: URL.createObjectURL(file),
        fileName: file.name,
        fileSize: file.size
      };

      onSendMessage(message);
    });

    event.target.value = '';
  };

  const handleDocumentUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      if (file.size > 25 * 1024 * 1024) {
        console.error('Document trop volumineux:', file.name);
        return;
      }

      const message = {
        id: Date.now().toString() + Math.random(),
        from: 'client',
        content: '📄 Document',
        timestamp: new Date(),
        status: 'sent',
        type: 'document',
        fileUrl: URL.createObjectURL(file),
        fileName: file.name,
        fileSize: file.size
      };

      onSendMessage(message);
    });

    event.target.value = '';
  };

  return (
    <div className="p-4 border-t bg-white">
      <div className="flex gap-2">
        {/* Bouton audio intelligent */}
        <Button
          variant="ghost"
          size="sm"
          onMouseDown={startAudioRecording}
          onMouseUp={stopAudioRecording}
          onMouseLeave={cancelRecording}
          onTouchStart={startAudioRecording}
          onTouchEnd={stopAudioRecording}
          onTouchCancel={cancelRecording}
          className={`${
            isRecording 
              ? 'bg-red-500 text-white hover:bg-red-600 shadow-lg scale-110' 
              : holdStartTime && !isRecording
              ? 'bg-yellow-400 text-white hover:bg-yellow-500 shadow-lg scale-105'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-0'
          } transition-all duration-200 rounded-full w-12 h-12 p-0 flex items-center justify-center relative`}
          title={
            isRecording 
              ? "🎙️ Relâchez pour arrêter et envoyer" 
              : holdStartTime && !isRecording
              ? "🎙️ Continuez à maintenir pour enregistrer..."
              : "🎙️ Maintenez enfoncé pour enregistrer, relâchez pour envoyer"
          }
        >
          {isRecording ? (
            <div className="flex items-center justify-center">
              <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
            </div>
          ) : holdStartTime && !isRecording ? (
            <div className="flex items-center justify-center">
              <div className="w-3 h-3 bg-white rounded-full animate-bounce"></div>
            </div>
          ) : (
            <Mic className="w-5 h-5" />
          )}
          
          {/* Compteur de secondes */}
          {isRecording && (
            <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-red-500 text-white text-xs px-2 py-1 rounded-full whitespace-nowrap">
              {Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60).toString().padStart(2, '0')}
            </div>
          )}
          
          {/* Indicateur "Maintenez enfoncé" */}
          {!isRecording && !holdStartTime && (
            <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-600 text-white text-xs px-2 py-1 rounded-full whitespace-nowrap opacity-80">
              Maintenez
            </div>
          )}
          
          {/* Indicateur "Continuez à maintenir" pendant le délai */}
          {holdStartTime && !isRecording && (
            <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-yellow-500 text-white text-xs px-2 py-1 rounded-full whitespace-nowrap">
              Continuez...
            </div>
          )}
        </Button>

        {/* Bouton d'envoi d'images et vidéos */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => document.getElementById('file-input-images')?.click()}
          className="bg-gray-100 text-gray-700 hover:bg-gray-200 border-0 rounded-full w-12 h-12 p-0 flex items-center justify-center transition-all duration-200"
          title="Envoyer des images ou vidéos"
        >
          <Image className="w-5 h-5" />
        </Button>

        {/* Bouton d'envoi de fichiers */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => document.getElementById('file-input-documents')?.click()}
          className="bg-gray-100 text-gray-700 hover:bg-gray-200 border-0 rounded-full w-12 h-12 p-0 flex items-center justify-center transition-all duration-200"
          title="Envoyer des documents (PDF, Word, Excel, etc.)"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </Button>
        
        {/* Indicateur d'enregistrement en cours */}
        {isRecording && (
          <div className="flex items-center gap-3 text-red-600 text-sm bg-red-50 px-4 py-2 rounded-full border border-red-200">
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
            </div>
            <span className="font-medium">🎙️ Enregistrement...</span>
          </div>
        )}
        
        {/* Zone de saisie de texte */}
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Tapez votre message..."
          className="flex-1 px-4 py-3 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 focus:bg-white transition-all duration-200"
        />
        
        {/* Bouton d'envoi */}
        <Button 
          onClick={handleSendTextMessage}
          disabled={!newMessage.trim()}
          className="bg-blue-500 hover:bg-blue-600 text-white rounded-full w-12 h-12 p-0 flex items-center justify-center transition-all duration-200 shadow-md hover:shadow-lg"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </Button>
      </div>

      {/* Inputs cachés pour la sélection de fichiers */}
      <input
        id="file-input-images"
        type="file"
        accept="image/*,video/*"
        multiple
        onChange={handleImageUpload}
        className="hidden"
      />
      
      <input
        id="file-input-documents"
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.rtf"
        multiple
        onChange={handleDocumentUpload}
        className="hidden"
      />
      
      {/* Indicateur de frappe */}
      {isTyping && (
        <div className="mt-2 text-xs text-gray-500 flex items-center gap-2">
          <div className="flex gap-1">
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
          </div>
          <span>Le prestataire est en train de taper...</span>
        </div>
      )}
    </div>
  );
};

export default ChatInput; 