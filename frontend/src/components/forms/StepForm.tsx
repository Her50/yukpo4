// 📁 src/components/forms/StepForm.tsx
import React, { useState } from 'react';
import { Button } from '@/components/ui/buttons';
import DynamicField from '@/components/intelligence/DynamicFields';
import { ComposantFrontend } from '@/utils/form_constraint_dispatcher';

interface StepFormProps {
  composants: ComposantFrontend[];
  onComplete: (resultats: Record<string, any>) => void;
}

const grouperParCategorie = (champs: ComposantFrontend[]) => {
  const groupes: Record<string, ComposantFrontend[]> = {
    "Informations de base": [],
    "Localisation": [],
    "Médias": [],
    "Disponibilité": [],
    "Autres": [],
  };

  for (const champ of champs) {
    if (champ.composant.includes('Uploader')) groupes['Médias'].push(champ);
    else if (champ.composant === 'MapSelector') groupes['Localisation'].push(champ);
    else if (champ.composant === 'DateTimePicker') groupes['Disponibilité'].push(champ);
    else if (champ.composant === 'checkbox' || champ.composant === 'input' || champ.composant === 'number') groupes['Informations de base'].push(champ);
    else groupes['Autres'].push(champ);
  }

  return Object.entries(groupes).filter(([, champs]) => champs.length > 0);
};

const StepForm: React.FC<StepFormProps> = ({ composants, onComplete }) => {
  const sections = grouperParCategorie(composants);
  const [currentStep, setCurrentStep] = useState(0);
  const [resultats, setResultats] = useState<Record<string, any>>({});

  const handleChange = (champ: string, valeur: any) => {
    setResultats((prev) => ({ ...prev, [champ]: valeur }));
  };

  const isLastStep = currentStep === sections.length - 1;

  const handleSuivant = () => {
    if (isLastStep) onComplete(resultats);
    else setCurrentStep((prev) => prev + 1);
  };

  const handlePrecedent = () => {
    if (currentStep > 0) setCurrentStep((prev) => prev - 1);
  };

  const [titreSection, champsSection] = sections[currentStep];

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">{titreSection}</h3>
      <div className="space-y-3">
        {champsSection.map((champ) => (
          <DynamicField
            key={champ.nomChamp}
            champ={champ}
            valeurExistante={resultats[champ.nomChamp]}
            onChange={handleChange}
          />
        ))}
      </div>

      <div className="flex justify-between pt-4">
        <Button type="button" onClick={handlePrecedent} disabled={currentStep === 0}>
          ◀ Précédent
        </Button>
        <Button type="button" onClick={handleSuivant}>
          {isLastStep ? '✅ Valider' : 'Suivant ▶'}
        </Button>
      </div>
    </div>
  );
};

export default StepForm;
