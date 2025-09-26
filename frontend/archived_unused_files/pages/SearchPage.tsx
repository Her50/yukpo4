import React, { useState, useEffect } from 'react';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';

﻿// @generated
import AdvancedSearch from '@/components/search/AdvancedSearch';
import catalogue from '@/data/services.json';

const SearchPage: React.FC = () => {
  const [services, setServices] = useState<any[]>([]);

  useEffect(() => {
    setServices(catalogue);
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Recherche Avancée</h1>
      <AdvancedSearch items={services} />
    </div>
  );
};

export default SearchPage;