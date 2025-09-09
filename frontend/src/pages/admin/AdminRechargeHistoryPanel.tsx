// ===========================================
// 📁 FRONTEND — src/pages/admin/AdminRechargeHistoryPanel.tsx
// ===========================================

import React, { useEffect, useState } from "react";
import axios from "axios";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHead, TableRow, TableCell, TableHeader, TableBody } from "@/components/ui/Table";

interface RechargeLog {
  id: number;
  admin_id: number;
  user_id: number;
  montant: number;
  timestamp: string;
}

const AdminRechargeHistoryPanel: React.FC = () => {
  const [recharges, setRecharges] = useState<RechargeLog[]>([]);

  useEffect(() => {
    axios.get("/api/admin/credits-history")
      .then((res) => setRecharges(res.data))
      .catch(console.error);
  }, []);

  return (
    <Card className="mt-6 p-4">
      <CardContent>
        <h2 className="text-xl font-bold mb-4">Historique des recharges</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Admin ID</TableHead>
              <TableHead>User ID</TableHead>
              <TableHead>Montant</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recharges.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.admin_id}</TableCell>
                <TableCell>{r.user_id}</TableCell>
                <TableCell>{r.montant} tokens</TableCell>
                <TableCell>{new Date(r.timestamp).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default AdminRechargeHistoryPanel;

