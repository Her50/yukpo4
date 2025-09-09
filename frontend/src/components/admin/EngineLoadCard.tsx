// @ts-check
import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle } from "lucide-react";

type EngineType = "OpenAI" | "Mistral" | "Ollama";

type Props = {
  engine: EngineType;
  usagePercent: number;
  requestsToday: number;
};

const COLORS: Record<EngineType, string> = {
  OpenAI: "#1f77b4",
  Mistral: "#ff7f0e",
  Ollama: "#2ca02c",
};

const EngineLoadCard: React.FC<Props> = ({ engine, usagePercent, requestsToday }) => {
  const data = [
    { name: "Used", value: usagePercent },
    { name: "Free", value: 100 - usagePercent },
  ];

  const isOverloaded = usagePercent >= 90;

  return (
    <div className="bg-white border rounded-xl shadow p-4 flex flex-col items-center gap-4 w-full">
      <h3 className="text-lg font-semibold">{engine}</h3>

      <div className="h-32 w-32">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              innerRadius={45}
              outerRadius={60}
              dataKey="value"
              startAngle={90}
              endAngle={-270}
            >
              <Cell fill={COLORS[engine]} />
              <Cell fill="#f0f0f0" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>

      <p className="text-sm text-gray-600">{usagePercent.toFixed(1)}% utilisé</p>

      <Progress value={usagePercent} className="w-full" />

      {isOverloaded && (
        <div className="flex items-center text-red-600 text-xs mt-2 gap-1">
          <AlertTriangle size={14} />
          Surcharge critique
        </div>
      )}

      <p className="text-xs text-gray-500">
        🔄 Requêtes aujourd’hui : <strong>{requestsToday}</strong>
      </p>
    </div>
  );
};

export default EngineLoadCard;
