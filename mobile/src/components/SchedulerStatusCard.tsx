// @ts-nocheck
import * as React from "react";
import { useEffect, useState } from "react";
import { Text, TouchableOpacity, View } from 'react-native';
import { API_BASE_URL } from '../config/api';
import { useLanguageSafe } from '../contexts/LanguageContext';

type StatusData = {
  enabled: boolean;
  last_run: string;
  next_run: string;
};

const SchedulerStatusCard: React.FC = () => {
      const { t } = useLanguageSafe();
const [data, setData] = useState<StatusData | null>(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/admin/scheduler-status`)
      .then((res) => res.json())
      .then((d) => setData(d));
  }, []);

  if (!data) {
    return (
      <View style="p-4">
        <Text>{t('schedulerStatusCard.chargement')}</Text>
        <TouchableOpacity
          onPress={() =>
            fetch(`${API_BASE_URL}/api/admin/run-summary-now`, { method: "POST" })
              .then((res) => res.text())
              .then((msg) => alert(msg))
          }
          style={{ marginTop: 12, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#4F46E5', borderRadius: 6 } as any}
        >
          <Text style={{ color: '#fff' }}>{t('schedulerStatusCard.resumerMaintenant')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const lastRun = new Date(data.last_run);
  const now = new Date();
  const hoursAgo = Math.floor((now.getTime() - lastRun.getTime()) / (1000 * 3600));
  const showAlert = hoursAgo > 48;

  return (
    <View style="p-4 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 border rounded shadow">
      <Text style="text-lg font-semibold mb-2">{t('schedulerStatusCard.statutDeLaPlanificationIa')}/Text>

      <Text>
        État :{" "}
        <Text style={data.enabled ? "text-green-600" : "text-red-500"}>
          {data.enabled ? "✅ Activée" : "⛔ Désactivée"}
        </Text>
      </Text>

      <Text>
        Dernière exécution :{" "}
        <Text style={showAlert ? "text-red-500 font-bold" : ""}>
          {isNaN(lastRun.getTime()) ? "Non disponible" : lastRun.toLocaleString()} ({hoursAgo}h)
        </Text>
      </Text>

      <Text>{t('schedulerStatusCard.nextScheduled')}: {data.next_run}</Text>

      {showAlert && (
        <Text style="text-red-500 mt-2">{t('schedulerStatusCard.plusDe48hDepuisLe')}</Text>
      )}

      <TouchableOpacity
        onPress={() =>
          fetch("/api/admin/run-summary-now", { method: "POST" })
            .then((res) => res.text())
            .then((msg) => alert(msg))
        }
        style={{ marginTop: 12, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#4F46E5', borderRadius: 6 } as any}
      >
        <Text style={{ color: '#fff' }}>{t('schedulerStatusCard.resumerMaintenant')}</Text>
      </TouchableOpacity>
    </View>
  );
};

export default SchedulerStatusCard;





