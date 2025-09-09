// 📁 src/components/forms/AudioUploader.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/buttons';
import { Mic, X } from 'lucide-react';

interface AudioUploaderProps {
  label?: string;
  valeurExistante?: string; // base64 ou URL déjà enregistrée
  onAudioSelected: (file: File | null) => void;
}

const AudioUploader: React.FC<AudioUploaderProps> = ({
  label = "🎙️ Ajoutez un message audio explicatif (facultatif)",
  valeurExistante,
  onAudioSelected
}) => {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(valeurExistante || null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (valeurExistante) {
      setPreviewUrl(valeurExistante);
    }
  }, [valeurExistante]);

  const handleAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAudioFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      onAudioSelected(file);
    }
  };

  const removeAudio = () => {
    setAudioFile(null);
    setPreviewUrl(null);
    onAudioSelected(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>

      <p className="text-xs text-muted-foreground">
        Ce fichier sera analysé par l’IA pour mieux comprendre votre besoin. Formats supportés : MP3, WAV, AAC, etc.
      </p>

      <Input
        type="file"
        accept="audio/*"
        ref={inputRef}
        onChange={handleAudioChange}
      />

      {previewUrl && (
        <div className="mt-3 border rounded p-2 flex items-center gap-4 bg-gray-50">
          <audio controls src={previewUrl} className="flex-1 rounded" />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={removeAudio}
            className="text-red-500"
            title="Supprimer le fichier audio"
          >
            <X size={18} />
          </Button>
        </div>
      )}
    </div>
  );
};

export default AudioUploader;
