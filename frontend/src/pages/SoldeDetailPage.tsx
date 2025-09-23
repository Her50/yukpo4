import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/buttons/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useUserCredit } from "@/hooks/useUserCredit";
import { useUserSWR } from "@/hooks/useUserSWR";
import axios from "axios";
import {
  BarChart3,
  CreditCard,
  DollarSign,
  Download,
  FileText,
  Smartphone,
  TrendingDown,
  TrendingUp,
  Zap
} from 'lucide-react';
import React, { useEffect, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type UsageLog = {
  date: string;
  usage_type: string;
  montant: number;
  moteur: string;
  service_id?: string;
  service_title?: string;
  payment_method?: string;
  transaction_id?: string;
};

type PaymentLog = {
  id: string;
  date: string;
  amount: number;
  payment_method: string;
  status: 'completed' | 'pending' | 'failed';
  transaction_id: string;
  tokens_added: number;
};

const SoldeDetailPage: React.FC = () => {
  const { user, mutate } = useUserSWR();
  const { creditDevise, devise } = useUserCredit();
  const [logs, setLogs] = useState<UsageLog[]>([]);
  const [paymentLogs, setPaymentLogs] = useState<PaymentLog[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [selectedTab, setSelectedTab] = useState<'consumption' | 'payments'>('consumption');

  useEffect(() => {
    if (!user?.id) return;
    mutate(); // force le rafraîchissement du user/tokens à chaque affichage

    // Charger l'historique de consommation
    axios.get(`/api/user/credit/history/${user.id}?period=${selectedPeriod}`).then((res) => {
      const data = Array.isArray(res.data) ? res.data : [];
      setLogs(data);
    }).catch(console.error);

    // Charger l'historique des paiements
    axios.get(`/api/user/payments/history/${user.id}?period=${selectedPeriod}`).then((res) => {
      const data = Array.isArray(res.data) ? res.data : [];
      setPaymentLogs(data);
    }).catch(console.error);
  }, [user, mutate, selectedPeriod]);

  const handleExportCSV = () => {
    const csv = logs
      .map((log) =>
        [new Date(log.date).toLocaleString(), log.usage_type, log.moteur, log.montant.toFixed(2)].join(",")
      )
      .join("\n");

    const header = "Date,Type,Moteur,Montant (crédits)\n";
    const blob = new Blob([header + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "usage-ia.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const chartData = logs
    .map((log) => ({
      date: new Date(log.date).toLocaleDateString(),
      montant: log.montant,
    }))
    .reverse();

  const getPaymentMethodIcon = (method: string) => {
    switch (method.toLowerCase()) {
      case 'orange_money':
        return <Smartphone className="w-4 h-4 text-orange-600" />;
      case 'mtn_money':
        return <Smartphone className="w-4 h-4 text-yellow-600" />;
      case 'visa_card':
      case 'mastercard':
        return <CreditCard className="w-4 h-4 text-blue-600" />;
      default:
        return <DollarSign className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XAF'
    }).format(amount);
  };

  const totalConsumed = logs.reduce((sum, log) => sum + log.montant, 0);
  const totalPaid = paymentLogs.reduce((sum, payment) => sum + payment.amount, 0);
  const totalTokensAdded = paymentLogs.reduce((sum, payment) => sum + payment.tokens_added, 0);

  return (
    <ResponsiveContainer>
      <div className="py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Historique de Consommation
          </h1>
          <p className="text-gray-600">
            Suivez vos dépenses Yukpo et vos recharges de tokens
          </p>
        </div>

        {/* Solde actuel */}
        <Card className="mb-8 bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Solde actuel</h3>
                <p className="text-3xl font-bold text-green-600">
                  {creditDevise !== null ? `${creditDevise.toFixed(0)} ${devise}` : "Chargement..."}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Total consommé</p>
                <p className="text-xl font-semibold text-red-600">
                  {formatCurrency(totalConsumed)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contrôles */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div className="flex items-center gap-2">
            <Button
              variant={selectedTab === 'consumption' ? 'default' : 'outline'}
              onClick={() => setSelectedTab('consumption')}
              className="flex items-center gap-2"
            >
              <Zap className="w-4 h-4" />
              Consommation Yukpo
            </Button>
            <Button
              variant={selectedTab === 'payments' ? 'default' : 'outline'}
              onClick={() => setSelectedTab('payments')}
              className="flex items-center gap-2"
            >
              <CreditCard className="w-4 h-4" />
              Historique des Paiements
            </Button>
          </div>

          <div className="flex items-center gap-4">
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="7d">7 derniers jours</option>
              <option value="30d">30 derniers jours</option>
              <option value="90d">90 derniers jours</option>
              <option value="all">Tout l'historique</option>
            </select>

            <Button
              onClick={handleExportCSV}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Exporter CSV
            </Button>
          </div>
        </div>

        {/* Onglet Consommation Yukpo */}
        {selectedTab === 'consumption' && (
          <div className="space-y-6">
            {/* Statistiques de consommation */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total consommé</p>
                      <p className="text-2xl font-bold text-red-600">{formatCurrency(totalConsumed)}</p>
                    </div>
                    <TrendingDown className="w-8 h-8 text-red-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Utilisations</p>
                      <p className="text-2xl font-bold text-blue-600">{logs.length}</p>
                    </div>
                    <BarChart3 className="w-8 h-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Moyenne par usage</p>
                      <p className="text-2xl font-bold text-purple-600">
                        {logs.length > 0 ? formatCurrency(totalConsumed / logs.length) : '0 FCFA'}
                      </p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-purple-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Graphique */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Évolution de la consommation
                </CardTitle>
              </CardHeader>
              <CardContent>
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData}>
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip formatter={(value) => [formatCurrency(Number(value)), 'Consommation']} />
                      <Line type="monotone" dataKey="montant" stroke="#ef4444" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <BarChart3 className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <p>Aucune donnée de consommation disponible</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Détail des utilisations */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Détail des utilisations Yukpo
                </CardTitle>
              </CardHeader>
              <CardContent>
                {logs.length > 0 ? (
                  <div className="space-y-3">
                    {logs.map((log, i) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                            <Zap className="w-5 h-5 text-red-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{log.usage_type}</p>
                            <p className="text-sm text-gray-600">{log.moteur}</p>
                            {log.service_title && (
                              <p className="text-xs text-blue-600">Service: {log.service_title}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-red-600">-{formatCurrency(log.montant)}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(log.date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Zap className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>Aucune utilisation Yukpo enregistrée</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Onglet Historique des Paiements */}
        {selectedTab === 'payments' && (
          <div className="space-y-6">
            {/* Statistiques des paiements */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total payé</p>
                      <p className="text-2xl font-bold text-green-600">{formatCurrency(totalPaid)}</p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Tokens ajoutés</p>
                      <p className="text-2xl font-bold text-blue-600">{totalTokensAdded.toLocaleString()}</p>
                    </div>
                    <CreditCard className="w-8 h-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Transactions</p>
                      <p className="text-2xl font-bold text-purple-600">{paymentLogs.length}</p>
                    </div>
                    <FileText className="w-8 h-8 text-purple-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Détail des paiements */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Historique des paiements
                </CardTitle>
              </CardHeader>
              <CardContent>
                {paymentLogs.length > 0 ? (
                  <div className="space-y-3">
                    {paymentLogs.map((payment) => (
                      <div key={payment.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                            {getPaymentMethodIcon(payment.payment_method)}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{payment.payment_method}</p>
                            <p className="text-sm text-gray-600">ID: {payment.transaction_id}</p>
                            <p className="text-xs text-blue-600">+{payment.tokens_added.toLocaleString()} tokens</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-green-600">+{formatCurrency(payment.amount)}</p>
                          <Badge className={getStatusColor(payment.status)}>
                            {payment.status}
                          </Badge>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(payment.date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <CreditCard className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>Aucun paiement enregistré</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </ResponsiveContainer>
  );
};

export default SoldeDetailPage;
