// @ts-check
import * as React from "react";
import { View, Text } from "react-native";
import { useLanguageSafe } from '../contexts/LanguageContext';

interface BehaviorScoreCardProps {
  score: number;
  suspicious: boolean;
}

const BehaviorScoreCard: React.FC<BehaviorScoreCardProps> = ({ score, suspicious }) => {
  return (
    <View style={{padding: 16, borderWidth: 1, borderRadius: 8, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.1, shadowRadius: 4, backgroundColor: 'white'}}>
      <Text style={{fontSize: 20, fontWeight: 'bold', marginBottom: 8}}>{t('behaviorScoreCard.resultatDeLanalyseComportementale')}</Text>
      <Text style={{color: '#333', marginBottom: 4}}>
        Score comportemental : {score}
      </Text>
      <Text style={{color: '#333'}}>
        Statut :{" "}
        <Text style={{color: suspicious ? '#dc2626' : '#16a34a', fontWeight: '600'}}>
          {suspicious ? "Comportement suspect détecté" : "Comportement normal"}
        </Text>
      </Text>
    </View>
  );
};

export default BehaviorScoreCard;





