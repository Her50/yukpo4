// 📁 src/components/forms/ImageUploader.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/buttons';
import { X, Camera, Cloud, Globe } from 'lucide-react';

declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

interface ImageUploaderProps {
  label?: string;
  onImagesSelected: (files: File[]) => void;
  valeursExistantes?: string[];
}

const ImageUploader: React.FC<ImageUploaderProps> = ({
  label = "Photos de votre service",
  onImagesSelected,
  valeursExistantes = []
}) => {
  const [previews, setPreviews] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraOpen, setCameraOpen] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [urlImage, setUrlImage] = useState("");

  useEffect(() => {
    setPreviews(valeursExistantes);
  }, [valeursExistantes]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    const newPreviews = selected.map(f => URL.createObjectURL(f));
    setFiles(prev => [...prev, ...selected]);
    setPreviews(prev => [...prev, ...newPreviews]);
    onImagesSelected([...files, ...selected]);
  };

  const handleCaptureImage = () => {
    if (canvasRef.current && videoRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, 320, 240);
        canvasRef.current.toBlob(blob => {
          if (blob) {
            const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
            const url = URL.createObjectURL(file);
            setPreviews(prev => [...prev, url]);
            const updatedFiles = [...files, file];
            setFiles(updatedFiles);
            onImagesSelected(updatedFiles);
          }
        }, 'image/jpeg');
      }
    }
  };

  const handleOpenCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true });
      setStream(s);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
      }
      setCameraOpen(true);
    } catch (err) {
      alert("Impossible d'accéder à la caméra.");
    }
  };

  const handleCloseCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    setCameraOpen(false);
  };

  const removeImage = (index: number) => {
    const newPreviews = [...previews];
    newPreviews.splice(index, 1);
    const newFiles = [...files];
    newFiles.splice(index, 1);
    setPreviews(newPreviews);
    setFiles(newFiles);
    onImagesSelected(newFiles);
  };

  const handleUrlImport = () => {
    if (urlImage && urlImage.startsWith("http")) {
      setPreviews(prev => [...prev, urlImage]);
      setUrlImage("");
    }
  };

  const handleDrivePicker = () => {
    if (!window.google || !window.google.accounts || !window.google.picker) {
      alert("Google Picker non chargé. Vérifiez votre script loader.");
      return;
    }

    const picker = new window.google.picker.PickerBuilder()
      .addView(window.google.picker.ViewId.DOCS_IMAGES)
      .setOAuthToken("VOTRE_TOKEN_OAUTH") // ⚠️ à remplacer dynamiquement
      .setDeveloperKey("VOTRE_API_KEY")   // ⚠️ à configurer dans Google Cloud Console
      .setCallback((data: any) => {
        if (data.action === window.google.picker.Action.PICKED) {
          const url = data.docs[0].url;
          setPreviews(prev => [...prev, url]);
        }
      })
      .build();

    picker.setVisible(true);
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>

      <p className="text-xs text-muted-foreground">
        Les images déjà enregistrées sont listées ci-dessous. Vous pouvez en ajouter via galerie, cloud, URL ou prise directe.
      </p>

      <Input type="file" accept="image/*" multiple onChange={handleFileChange} />

      <div className="flex flex-wrap gap-2 mt-2">
        {previews.map((src, idx) => (
          <div key={idx} className="relative w-24 h-24 rounded overflow-hidden border shadow-sm">
            <img src={src} alt={`img-${idx}`} className="object-cover w-full h-full" />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeImage(idx)}
              className="absolute top-1 right-1 bg-white/80 text-red-500"
            >
              <X size={16} />
            </Button>
          </div>
        ))}
      </div>

      {/* 📎 Ajouter via URL distante */}
      <div className="flex gap-2 items-center">
        <Input
          type="url"
          placeholder="Coller une URL d'image"
          value={urlImage}
          onChange={(e) => setUrlImage(e.target.value)}
        />
        <Button onClick={handleUrlImport} variant="secondary">
          <Globe size={16} className="mr-1" />
          Ajouter URL
        </Button>
      </div>

      {/* ☁️ Import depuis Google Drive */}
      <Button type="button" variant="outline" onClick={handleDrivePicker}>
        <Cloud className="mr-2" size={16} />
        Importer depuis Google Drive
      </Button>

      {/* 🎥 Capture par webcam */}
      {!isCameraOpen ? (
        <Button type="button" variant="secondary" onClick={handleOpenCamera}>
          <Camera className="mr-2" size={16} />
          📸 Prendre une photo
        </Button>
      ) : (
        <div className="mt-4 space-y-2">
          <video ref={videoRef} autoPlay playsInline width={320} height={240} className="border rounded" />
          <div className="flex gap-2 flex-wrap">
            <Button type="button" onClick={handleCaptureImage}>📷 Capturer</Button>
            <Button type="button" variant="destructive" onClick={handleCloseCamera}>✅ Terminer la capture</Button>
          </div>
          <canvas ref={canvasRef} width={320} height={240} className="hidden" />
        </div>
      )}
    </div>
  );
};

export default ImageUploader;
