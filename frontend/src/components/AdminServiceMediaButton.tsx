// @ts-nocheck
import React from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const AdminServiceMediaButton = ({ serviceId }) => {
  const navigate = useNavigate();
  return (
    <Button size="sm" variant="secondary" onClick={() => navigate(`/admin/service/${serviceId}/media`)}>
      📁 Médias associés
    </Button>
  );
};

export default AdminServiceMediaButton;
