// Composant pour afficher du texte traduit
import React from 'react';
import { useTranslation } from '@/hooks/useTranslation';

interface TranslatedTextProps {
  text: string;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
}

const TranslatedText: React.FC<TranslatedTextProps> = ({ 
  text, 
  className = '', 
  as: Component = 'span' 
}) => {
  const { translate } = useTranslation();
  
  return (
    <Component style={className}>
      {translate(text)}
    </Component>
  );
};

export default TranslatedText;

