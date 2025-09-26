// @ts-check
import * as React from "react";
import { useState } from 'react';
import { Text } from 'react-native';
import { View } from 'react-native';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';

import { Yukpomnang_PRODUCTS, getProductsByPlan } from "@/lib/IAProductRegistry";
import Tabs from "@/components/ui/tabs/Tabs";
import TabsList from "@/components/ui/tabs/TabsList";
import TabsTrigger from "@/components/ui/tabs/TabsTrigger";
import TabsContent from "@/components/ui/tabs/TabsContent";
import { Card, CardContent } from "@/components/ui/card";
import RequirePlan from "@/components/security/RequirePlan";
import { ROUTES } from "@/routes/AppRoutesRegistry";

const plans = ["free", "pro", "enterprise"] as const;
type YukpomnangPlan = typeof plans[number];

const DashboardIA: React.FC = () => {
  const [plan, setPlan] = useState<YukpomnangPlan>("free");

  return (
    <ResponsiveContainer>
      <Text style="text-3xl font-bold mb-6">🤖 Tableau de bord IA Yukpomnang</Text>

      <Tabs defaultValue={plan} onValueChange={(val) => setPlan(val as YukpomnangPlan)}>
        <TabsList>
          <TabsTrigger value="free">🟢 Gratuit</TabsTrigger>
          <TabsTrigger value="pro">🟡 Pro</TabsTrigger>
          <TabsTrigger value="enterprise">🔴 Entreprise</TabsTrigger>
        </TabsList>

        {plans.map((level) => (
          <TabsContent key={level} value={level}>
            <RequirePlan plan={level}>
              <View style="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-6">
                {getProductsByPlan(level).map((product) => (
                  <Card key={product.id} style="border shadow">
                    <CardContent style="p-4">
                      <Text style="text-lg font-semibold mb-2">{product.name}</Text>
                      <Text style="text-sm text-gray-600">{product.description}</Text>
                    </CardContent>
                  </Card>
                ))}
              </View>
            </RequirePlan>
          </TabsContent>
        ))}
      </Tabs>

      {/* 🚀 CONTEXTUAL BUTTONS START */}
      <View style="mt-6 flex flex-wrap gap-4 justify-center">
        <a
          href={ROUTES.SERVICES}
          style="px-4 py-2 bg-blue-100 text-blue-800 rounded-xl hover:bg-blue-200 transition"
        >
          Découvrir d'autres services
        </a>
        <a
          href={ROUTES.PLANS}
          style="px-4 py-2 bg-green-100 text-green-800 rounded-xl hover:bg-green-200 transition"
        >
          Voir les formules
        </a>
        <a
          href={ROUTES.CONTACT}
          style="px-4 py-2 bg-gray-100 text-gray-800 rounded-xl hover:bg-gray-200 transition"
        >
          Contacter l'équipe Yukpomnang
        </a>
      </View>
      {/* 🚀 CONTEXTUAL BUTTONS END */}
    </ResponsiveContainer>
  );
};

export default DashboardIA;





