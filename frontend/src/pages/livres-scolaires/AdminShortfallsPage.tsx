// V2.3 — Page admin shortfalls parrainage
// Route : /admin-yukpo/parrainage/shortfalls
// Accessible aux rôles admin / super_admin (re-check côté backend).

import React from 'react';
import AdminShortfallsPanel from '../../components/admin/AdminShortfallsPanel';

const AdminShortfallsPage: React.FC = () => (
  <div className="min-h-screen bg-gray-50 pb-12">
    <div className="container mx-auto px-4 py-6 max-w-5xl">
      <AdminShortfallsPanel />
    </div>
  </div>
);

export default AdminShortfallsPage;
