// 📁 src/components/forms/VideoUploader.tsx
import React, { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/buttons';
import { X } from 'lucide-react';

interface VideoUploaderProps {
  label?: string;
  onVideoSelected: (file: File | null) => void;
  valeurExistante?: string; // base64 ou URL
}

const VideoUploader: React.FC<VideoUploaderProps> = ({
  label = "Vidéo explicative",
  onVideoSelected,
  valeurExistante = "",
}) => {
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (valeurExistante) {
      setPreview(valeurExistante);
    }
  }, [valeurExistante]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] || null;
    if (selected) {
      setFile(selected);
      const url = URL.createObjectURL(selected);
      setPreview(url);
      onVideoSelected(selected);
    }
  };

  const removeVideo = () => {
    setFile(null);
    setPreview(null);
    onVideoSelected(null);
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>

      <p className="text-xs text-muted-foreground">
        Vous pouvez charger une vidéo depuis votre appareil, ou visualiser celle déjà envoyée. <br />
        Formats supportés : .mp4, .mov, .webm
      </p>

      <Input
        type="file"
        accept="video/*"
        onChange={handleFileChange}
      />

      {preview && (
        <div className="relative mt-2 border rounded overflow-hidden">
          <video controls src={preview} className="w-full max-h-64" />
          <Button
            variant="ghost"
            size="icon"
            onClick={removeVideo}
            className="absolute top-1 right-1 bg-white/80 text-red-500"
          >
            <X size={16} />
          </Button>
        </div>
      )}
    </div>
  );
};

export default VideoUploader;
