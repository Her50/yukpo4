// @ts-nocheck
import * as React from "react";
import { TouchableOpacity } from 'react-native';
import { Button } from "@/components/ui/button";
import { useNavigation } from "@react-navigation/native";
import { useLanguageSafe } from '../contexts/LanguageContext';

const AdminServiceMediaButton = ({ serviceId }) => {
    const { t } = useLanguageSafe();
  const navigate = useNavigation();
  return (
    <TouchableOpacity size="sm" variant="secondary" onPress={() => navigation.navigate(`/admin/service/${serviceId}/media`)}>
      📁 Médias associés
    </TouchableOpacity>
  );
};

export default AdminServiceMediaButton;





