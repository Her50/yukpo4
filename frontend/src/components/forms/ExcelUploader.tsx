// 📁 src/components/forms/ExcelUploader.tsx
import React, { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/buttons';
import { X } from 'lucide-react';

export interface ExcelUploaderProps {
  label?: string;
  onExcelSelected: (file: File | null) => void;
  valeurExistante?: string; // Base64 ou URL d’un fichier Excel déjà existant
}

const ExcelUploader: React.FC<ExcelUploaderProps> = ({
  label = "Fichier Excel (facultatif)",
  onExcelSelected,
  valeurExistante = "",
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [filename, setFilename] = useState<string | null>(null);

  useEffect(() => {
    if (valeurExistante) {
      setFilename("Fichier Excel déjà importé");
    }
  }, [valeurExistante]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] || null;
    if (selected) {
      setFile(selected);
      setFilename(selected.name);
      onExcelSelected(selected);
    }
  };

  const removeFile = () => {
    setFile(null);
    setFilename(null);
    onExcelSelected(null);
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>

      <p className="text-xs text-muted-foreground">
        Vous pouvez joindre un fichier Excel (.xlsx) pour enrichir la demande. <br />
        Exemple : planning, tableau de stock, configuration personnalisée...
      </p>

      <Input
        type="file"
        accept=".xlsx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        onChange={handleFileChange}
      />

      {filename && (
        <div className="mt-2 flex items-center justify-between border p-2 rounded bg-gray-50">
          <span className="text-sm text-gray-700 truncate">{filename}</span>
          <Button variant="ghost" size="icon" onClick={removeFile}>
            <X size={16} />
          </Button>
        </div>
      )}
    </div>
  );
};

export default ExcelUploader;
