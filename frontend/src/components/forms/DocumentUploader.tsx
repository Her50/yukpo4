// 📁 src/components/forms/DocumentUploader.tsx
import React, { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/buttons';
import { X } from 'lucide-react';

interface DocumentUploaderProps {
  label?: string;
  onDocumentsSelected: (files: File[]) => void;
  valeursExistantes?: string[]; // URLs ou base64 déjà enregistrés
}

const DocumentUploader: React.FC<DocumentUploaderProps> = ({
  label = "Documents justificatifs",
  onDocumentsSelected,
  valeursExistantes = [],
}) => {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  useEffect(() => {
    setPreviews(valeursExistantes);
  }, [valeursExistantes]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    const filePreviews = selected.map(f => URL.createObjectURL(f));
    setFiles(prev => [...prev, ...selected]);
    setPreviews(prev => [...prev, ...filePreviews]);
    onDocumentsSelected([...files, ...selected]);
  };

  const removeDocument = (index: number) => {
    const updatedPreviews = [...previews];
    updatedPreviews.splice(index, 1);
    const updatedFiles = [...files];
    updatedFiles.splice(index, 1);
    setPreviews(updatedPreviews);
    setFiles(updatedFiles);
    onDocumentsSelected(updatedFiles);
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>

      <p className="text-xs text-muted-foreground">
        Vous pouvez joindre des fichiers PDF, Word, ou tout autre document justificatif utile.
      </p>

      <Input
        type="file"
        multiple
        accept=".pdf,.doc,.docx,.odt,.txt"
        onChange={handleFileChange}
      />

      {previews.length > 0 && (
        <ul className="mt-2 space-y-1">
          {previews.map((preview, index) => (
            <li key={index} className="flex justify-between items-center bg-gray-50 px-2 py-1 rounded text-sm border">
              <span className="truncate w-64">
                {preview.startsWith('blob:') ? `Document ${index + 1}` : preview}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeDocument(index)}
                className="text-red-500"
              >
                <X size={16} />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default DocumentUploader;
