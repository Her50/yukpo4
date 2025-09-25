// @ts-nocheck
import React from "react";
import { Button } from "@/components/ui/button";
import { useNavigation } from "@react-navigation/native";

const AdminServiceMediaButton = ({ serviceId }) => {
  const navigate = useNavigation();
  return (
    <TouchableOpacity size="sm" variant="secondary" onClick={() => navigation.navigate(`/admin/service/${serviceId}/media`)}>
      📁 Médias associés
    </TouchableOpacity>
  );
};

export default AdminServiceMediaButton;

