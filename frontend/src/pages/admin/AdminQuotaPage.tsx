import React, { useState, useEffect } from 'react';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';

import QuotaDashboard from "@/components/admin/QuotaDashboard"; // ✅ chemin corrigé

const AdminQuotaPage: React.FC = () => {
  return (
    <div className="p-4">
      <QuotaDashboard />
    </div>
  );
};

export default AdminQuotaPage;