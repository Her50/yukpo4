// @ts-nocheck
import * as React from "react";
import { TouchableOpacity } from 'react-native';
import { Button } from "@/components/ui/button";
import { useNavigation } from "@react-navigation/native";

const AdminServiceMediaButton = ({ serviceId }) => {
  const navigate = useNavigation();
  return (
    <TouchableOpacity size="sm" variant="secondary" onPress={() => navigation.navigate(`/admin/service/${serviceId}/media`)}>
      📁 Médias associés
    </TouchableOpacity>
  );
};

export default AdminServiceMediaButton;





