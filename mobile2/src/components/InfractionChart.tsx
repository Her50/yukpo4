// @ts-check
import * as React from "react";
import { Text } from 'react-native';
import { BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";

interface InfractionData {
  ip: string;
}

interface Props {
  data: InfractionData[];
}

const InfractionChart: React.FC<Textrops> = ({ data }) => {
  const ipCounts: Record<string, number> = {};

  data.forEach((d) => {
    const ip = d.ip;
    ipCounts[ip] = (ipCounts[ip] || 0) + 1;
  });

  const chartData = Object.entries(ipCounts).map(([ip, count]) => ({
    ip,
    count,
  }));

  return (
    <BarChart width={500} height={300} data={chartData}>
      <XAxis dataKey="ip" />
      <YAxis />
      <Tooltip />
      <Bar dataKey="count" fill="#EF4444" />
    </BarChart>
  );
};

export default InfractionChart;





