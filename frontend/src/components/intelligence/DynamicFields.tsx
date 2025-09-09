import React, { useState, useCallback, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import EmailInput from '@/components/ui/EmailInput';
import DateTimePicker from '@/components/forms/DateTimePicker';
import TagSelector from '@/components/forms/TagSelector';
import ObjectViewer from '@/components/forms/ObjectViewer';
import MapSelector from '@/components/forms/MapSelector';
import ImageUploader from '@/components/forms/ImageUploader';
import AudioUploader from '@/components/forms/AudioUploader';
import VideoUploader from '@/components/forms/VideoUploader';
import ExcelUploader from '@/components/forms/ExcelUploader';
import DocumentUploader from '@/components/forms/DocumentUploader';
import ProductListManager from '@/components/forms/ProductListManager';
import EtatBienSelector from '@/components/ui/EtatBienSelector';
import { ComposantFrontend } from '@/utils/form_constraint_dispatcher';
import MapModal from '@/components/ui/MapModal';
import { MapPin } from 'lucide-react';
import PhoneInput from '@/components/ui/PhoneInput';

interface DynamicFieldProps {
  champ: ComposantFrontend;
  valeurExistante?: string | string[] | Record<string, any>;
  onChange?: (champ: string, valeur: any) => void;
  isInContactBlock?: boolean;
  isInInfoGeneraleBlock?: boolean;
  readonly?: boolean;
}

// Composant FieldWrapper simplifié
const FieldWrapper: React.FC<{ 
  children: React.ReactNode;
  isInContactBlock: boolean;
  isInInfoGeneraleBlock: boolean;
  label: string;
  obligatoire: boolean;
  tooltip?: string;
  hasError: boolean;
}> = ({ 
  children, 
  isInContactBlock, 
  isInInfoGeneraleBlock, 
  label, 
  obligatoire, 
  tooltip, 
  hasError 
}) => (
  <div className={`${isInContactBlock || isInInfoGeneraleBlock
    ? 'bg-transparent border-0 shadow-none' 
    : hasError
    ? 'bg-white rounded border-2 border-red-300 shadow-sm transition-all duration-200'
    : 'bg-white rounded border border-gray-200 shadow-sm hover:shadow hover:border-orange-200 transition-all duration-200'
  } overflow-hidden w-full max-w-sm mx-auto`}>
    <div className="p-2">
      <div className="flex items-center justify-between mb-1">
        <label className={`text-xs font-bold flex items-center gap-1 ${hasError ? 'text-red-700' : 'text-gray-700'}`}>
          {label}
          {obligatoire && <span className="text-orange-600 text-[10px] bg-orange-50 px-1 rounded">*</span>}
        </label>
        {tooltip && tooltip.trim() && (
          <span className="text-[10px] text-gray-500 max-w-[150px] truncate">
            {tooltip}
          </span>
        )}
      </div>
      {children}
      {hasError && (
        <div className="mt-1 text-xs text-red-600 font-medium">⚠️ Ce champ est obligatoire</div>
      )}
    </div>
  </div>
);

const DynamicField: React.FC<DynamicFieldProps> = ({ 
  champ, 
  valeurExistante, 
  onChange, 
  isInContactBlock = false, 
  isInInfoGeneraleBlock = false,
  readonly = false
}) => {
  // État local pour MapModal
  const [showMapModal, setShowMapModal] = useState(false);
  const [staticMapUrl, setStaticMapUrl] = useState<string | null>(null);

  // Fonction pour formater le nom du champ en label lisible
  const formatFieldLabel = useCallback((nomChamp: string): string => {
    // Utiliser le label français si disponible
    if (champ.labelFrancais) {
      return champ.labelFrancais;
    }
    
    // Éviter le doublon pour email
    if (nomChamp.toLowerCase() === 'email') {
      return 'Email';
    }
    
    // Fallback vers la logique existante
    return nomChamp
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
      .replace('Is ', '')
      .replace('Gps ', 'GPS ')
      .replace('Url ', 'URL ');
  }, [champ.labelFrancais]);

  // Fonction pour déterminer si le champ est en lecture seule
  const isReadOnly = useCallback((nomChamp: string): boolean => {
    return readonly || nomChamp === 'is_tarissable' || nomChamp === 'is_tarissable_important' || nomChamp === 'vitesse_tarissement';
  }, [readonly]);

  // Handler simple pour les changements - optimisé avec useCallback
  const handleChange = useCallback((value: any) => {
    if (onChange && !readonly) {
      // Éviter les appels inutiles si la valeur n'a pas changé
      onChange(champ.nomChamp, value);
    }
  }, [onChange, champ.nomChamp, readonly]);

  // Handler pour MapModal
  const handleMapSelect = useCallback((coords: string) => {
    // Les coordonnées sont déjà formatées par MapModal
    handleChange(coords);
    // Pas besoin de previewUrl car MapModal ne le fournit pas
    setShowMapModal(false);
  }, [handleChange]);

  // Valeur actuelle - utiliser valeurExistante directement
  const currentValue = valeurExistante || '';
  
  // Pour tous les champs, utiliser directement la valeur existante
  // Éviter les transformations qui peuvent causer des sauts de curseur
  const displayValue = useMemo(() => {
    return currentValue;
  }, [currentValue]);

  // Détecter si c'est un champ de contact avec une valeur pré-remplie
  const isContactFieldWithValue = useMemo(() => {
    const isContactField = champ.nomChamp.toLowerCase().includes('whatsapp') || 
                          champ.nomChamp.toLowerCase().includes('telephone') || 
                          champ.nomChamp.toLowerCase().includes('email') || 
                          champ.nomChamp.toLowerCase().includes('siteweb');
    return isContactField && displayValue && typeof displayValue === 'string' && displayValue.trim() !== '';
  }, [champ.nomChamp, displayValue]);

  // Préparer les props du FieldWrapper
  const fieldWrapperProps = useMemo(() => ({
    isInContactBlock,
    isInInfoGeneraleBlock,
    label: formatFieldLabel(champ.nomChamp),
    obligatoire: !!champ.obligatoire,
    tooltip: champ.tooltip,
    hasError: !!champ.obligatoire && !displayValue
  }), [isInContactBlock, isInInfoGeneraleBlock, formatFieldLabel, champ.nomChamp, champ.obligatoire, champ.tooltip, displayValue]);

  // Cas spécifique 1 : etat_bien
  if (champ.nomChamp === "etat_bien" && champ.typeDonnee === "liste") {
    return (
      <FieldWrapper {...fieldWrapperProps}>
        <EtatBienSelector
          value={displayValue as string}
          onChange={readonly ? () => {} : handleChange}
        />
      </FieldWrapper>
    );
  }

  // Cas spécifique : listeproduit
  if (champ.typeDonnee === 'listeproduit') {
    return (
      <FieldWrapper {...fieldWrapperProps}>
        <ProductListManager
          value={Array.isArray(displayValue) ? displayValue : []}
          onChange={handleChange}
          label={formatFieldLabel(champ.nomChamp)}
          readonly={readonly}
        />
      </FieldWrapper>
    );
  }

  // Cas spécifique 3 : GPS avec MapModal (comme dans ChatInputPanel)
  if (champ.nomChamp.includes("gps") || champ.typeDonnee === 'gps') {
    return (
      <>
        <FieldWrapper {...fieldWrapperProps}>
          <div className="relative">
            <button
              type="button"
              onClick={() => !readonly && setShowMapModal(true)}
              disabled={readonly}
              className={`w-full flex items-center justify-between text-xs h-8 px-2 border border-gray-300 rounded transition-colors ${
                readonly 
                  ? 'bg-gray-50 cursor-not-allowed text-gray-600' 
                  : 'bg-white hover:bg-gray-50 focus:ring-1 focus:ring-orange-400 focus:border-orange-400'
              }`}
            >
              <span className="flex items-center gap-2">
                <MapPin className="w-3 h-3 text-gray-500" />
                {displayValue ? 'Modifier la position' : 'Sélectionner une position'}
              </span>
              <span className="text-gray-400">→</span>
            </button>
            {staticMapUrl && (
              <div className="mt-2">
                <img 
                  src={staticMapUrl} 
                  alt="Aperçu de la position" 
                  className="w-full h-20 object-cover rounded border"
                />
              </div>
            )}
          </div>
        </FieldWrapper>
        
        {showMapModal && !readonly && (
          <MapModal
            onClose={() => setShowMapModal(false)}
            onSelect={handleMapSelect}
          />
        )}
      </>
    );
  }

  // Cas spécifique 4 : GPS avec MapSelector (pour les listes)
  if (champ.nomChamp.includes("gps") && champ.typeDonnee === "liste") {
    return (
      <FieldWrapper {...fieldWrapperProps}>
        <MapSelector
          googleApiKey="pk.eyJ1IjoiaGVybmFuZGV6ODciLCJhIjoiY21hdDJnbzh6MDJpeDJsc2gyeDZwNTVxMCJ9.YXFT01T6B9sMX9Wj8WJmvQ"
          defaultCoords={
            typeof displayValue === 'string'
              ? [displayValue]
              : Array.isArray(displayValue)
              ? displayValue as string[]
              : []
          }
          onSitesChange={(coords: string[]) => handleChange(coords)}
        />
      </FieldWrapper>
    );
  }

  // Correction du label :
  // - Le label n'est affiché que dans FieldWrapper
  // - Le placeholder est explicite ou vide
  // - PhoneInput, EmailInput, Input n'affichent pas de label interne
  // - value et onChange sont strictement contrôlés par displayValue et handleChange
  // Pour PhoneInput (whatsapp, telephone)
  if (
    (champ.nomChamp.toLowerCase().includes('telephone') || champ.nomChamp.toLowerCase().includes('whatsapp')) &&
    (champ.typeDonnee === 'téléphone' || champ.typeDonnee === 'whatsapp' || champ.typeDonnee === 'string' || champ.typeDonnee === 'tel')
  ) {
    return (
      <FieldWrapper {...fieldWrapperProps}>
        <PhoneInput
          value={displayValue as string}
          onChange={handleChange}
          placeholder="Numéro de téléphone"
          required={!!champ.obligatoire}
        />
      </FieldWrapper>
    );
  }

  // Cas spécifique : email
  if (champ.nomChamp.toLowerCase().includes('email')) {
    return (
      <FieldWrapper {...fieldWrapperProps}>
        <EmailInput
          value={displayValue as string}
          onChange={handleChange}
          placeholder="Adresse email"
        />
      </FieldWrapper>
    );
  }
  // Pour Input générique
  if (champ.composant === 'input') {
    return (
      <FieldWrapper {...fieldWrapperProps}>
        <Input
          placeholder={champ.exemple || ''}
          value={displayValue as string}
          onChange={(e) => handleChange(e.target.value)}
          readOnly={isReadOnly(champ.nomChamp)}
          type={champ.typeDonnee === 'whatsapp' || champ.typeDonnee === 'téléphone' ? 'tel' : 
                champ.typeDonnee === 'website' || champ.typeDonnee === 'url' ? 'url' : 'text'}
          className={`w-full text-xs h-8 px-2 ${
            isReadOnly(champ.nomChamp) 
              ? 'bg-gray-50 border-gray-200 cursor-not-allowed text-gray-600' 
              : isContactFieldWithValue
              ? 'border-green-300 bg-green-50 focus:ring-1 focus:ring-green-400 focus:border-green-400'
              : 'border-gray-300 bg-white focus:ring-1 focus:ring-orange-400 focus:border-orange-400'
          }`}
          // label supprimé
        />
        {champ.nomChamp === 'vitesse_tarissement' && (
          <div className="mt-1 text-[10px] text-blue-600 bg-blue-50 border border-blue-100 rounded px-2 py-1">
            🤖 Déterminé automatiquement par l'IA selon votre service
          </div>
        )}
        {isContactFieldWithValue && (
          <div className="mt-1 text-[10px] text-green-600 bg-green-50 border border-green-100 rounded px-2 py-1">
            ✅ Pré-rempli depuis vos services précédents
          </div>
        )}
      </FieldWrapper>
    );
  }

  // Cas génériques
  switch (champ.composant) {
    case 'number':
      return (
        <FieldWrapper {...fieldWrapperProps}>
          <Input
            type="number"
            placeholder={champ.exemple}
            value={displayValue as string}
            onChange={(e) => handleChange(e.target.value)}
            readOnly={isReadOnly(champ.nomChamp)}
            className={`w-full text-xs h-8 px-2 ${
              isReadOnly(champ.nomChamp) 
                ? 'bg-gray-50 border-gray-200 cursor-not-allowed text-gray-600' 
                : 'border-gray-300 bg-white focus:ring-1 focus:ring-orange-400 focus:border-orange-400'
            }`}
          />
        </FieldWrapper>
      );
      
    case 'checkbox':
      return (
        <FieldWrapper {...fieldWrapperProps}>
          <div className="flex items-center space-x-2">
            <Checkbox
              id={champ.nomChamp}
              checked={!!displayValue}
              onCheckedChange={handleChange}
              disabled={isReadOnly(champ.nomChamp)}
              className="w-4 h-4"
            />
            <label htmlFor={champ.nomChamp} className="text-xs text-gray-700">
              {champ.tooltip || formatFieldLabel(champ.nomChamp)}
            </label>
          </div>
        </FieldWrapper>
      );
      
    case 'textarea':
      return (
        <FieldWrapper {...fieldWrapperProps}>
          <Textarea
            placeholder={champ.exemple}
            value={displayValue as string}
            onChange={(e) => handleChange(e.target.value)}
            readOnly={isReadOnly(champ.nomChamp)}
            className={`w-full text-xs min-h-[60px] px-2 py-1 resize-none ${
              isReadOnly(champ.nomChamp) 
                ? 'bg-gray-50 border-gray-200 cursor-not-allowed text-gray-600' 
                : 'border-gray-300 bg-white focus:ring-1 focus:ring-orange-400 focus:border-orange-400'
            }`}
          />
        </FieldWrapper>
      );
      
    case 'date':
      return (
        <FieldWrapper {...fieldWrapperProps}>
          <DateTimePicker
            defaultValue={displayValue as string}
            onChange={handleChange}
          />
        </FieldWrapper>
      );
      
    case 'tags':
      return (
        <FieldWrapper {...fieldWrapperProps}>
          <TagSelector
            valeur={displayValue as string[]}
            onChange={handleChange}
          />
        </FieldWrapper>
      );
      
    case 'object':
      return (
        <FieldWrapper {...fieldWrapperProps}>
          <ObjectViewer
            valeur={displayValue as Record<string, any>}
            onChange={handleChange}
          />
        </FieldWrapper>
      );
      
    case 'image':
      return (
        <FieldWrapper {...fieldWrapperProps}>
          <ImageUploader
            valeursExistantes={displayValue as string[]}
            onImagesSelected={(files) => handleChange(files)}
          />
        </FieldWrapper>
      );
      
    case 'audio':
      return (
        <FieldWrapper {...fieldWrapperProps}>
          <AudioUploader
            valeurExistante={displayValue as string}
            onAudioSelected={(file) => handleChange(file)}
          />
        </FieldWrapper>
      );
      
    case 'video':
      return (
        <FieldWrapper {...fieldWrapperProps}>
          <VideoUploader
            valeurExistante={displayValue as string}
            onVideoSelected={(file) => handleChange(file)}
          />
        </FieldWrapper>
      );
      
    case 'excel':
      return (
        <FieldWrapper {...fieldWrapperProps}>
          <ExcelUploader
            valeurExistante={displayValue as string}
            onExcelSelected={(file) => handleChange(file)}
          />
        </FieldWrapper>
      );
      
    case 'document':
      return (
        <FieldWrapper {...fieldWrapperProps}>
          <DocumentUploader
            valeursExistantes={displayValue as string[]}
            onDocumentsSelected={(files) => handleChange(files)}
          />
        </FieldWrapper>
      );
      
    case 'array':
      // Gestion spéciale pour les tableaux de produits
      if (champ.nomChamp.toLowerCase().includes('produit') || champ.nomChamp.toLowerCase().includes('listeproduit')) {
        return (
          <FieldWrapper {...fieldWrapperProps}>
            <ProductListManager
              value={Array.isArray(displayValue) ? displayValue : []}
              onChange={handleChange}
              label={formatFieldLabel(champ.nomChamp)}
              readonly={readonly}
            />
          </FieldWrapper>
        );
      }
      // Gestion générique pour les autres types de tableaux
      return (
        <FieldWrapper {...fieldWrapperProps}>
          <div className="space-y-2">
            <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
              📋 Tableau de {champ.nomChamp} ({Array.isArray(displayValue) ? displayValue.length : 0} éléments)
            </div>
            {Array.isArray(displayValue) && displayValue.length > 0 ? (
              <div className="max-h-32 overflow-y-auto space-y-1">
                {displayValue.map((item, index) => (
                  <div key={index} className="text-xs bg-white p-2 rounded border">
                    {typeof item === 'object' ? JSON.stringify(item, null, 2) : String(item)}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-gray-500 text-center py-2">
                Aucun élément dans ce tableau
              </div>
            )}
          </div>
        </FieldWrapper>
      );
      
    default:
      return (
        <FieldWrapper {...fieldWrapperProps}>
          <Input
            placeholder={champ.exemple || ''}
            value={displayValue as string}
            onChange={(e) => handleChange(e.target.value)}
            readOnly={isReadOnly(champ.nomChamp)}
            className={`w-full text-xs h-8 px-2 ${
              isReadOnly(champ.nomChamp) 
                ? 'bg-gray-50 border-gray-200 cursor-not-allowed text-gray-600' 
                : 'border-gray-300 bg-white focus:ring-1 focus:ring-orange-400 focus:border-orange-400'
            }`}
          />
        </FieldWrapper>
      );
  }
};

export default DynamicField;