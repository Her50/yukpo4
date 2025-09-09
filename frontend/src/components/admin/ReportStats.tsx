// @ts-check
import React, { useEffect, useState, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell,
  ResponsiveContainer, Legend
} from "recharts";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

type Notification = {
  date: string;
  title: string;
  message: string;
};

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#B84ACD"];

const ReportStats: React.FC = () => {
  const [data, setData] = useState<Notification[]>([]);
  const [byMonth, setByMonth] = useState<any[]>([]);
  const [byWeek, setByWeek] = useState<any[]>([]);
  const [byType, setByType] = useState<any[]>([]);
  const [isDark, setIsDark] = useState(false);
  const [view, setView] = useState<"month" | "week">("month");
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/dist/setup/notifications.json")
      .then(res => res.json())
      .then(logs => {
        setData(logs);
        processData(logs);
      });

    const match = window.matchMedia("(prefers-color-scheme: dark)");
    setIsDark(match.matches);
    match.addEventListener("change", e => setIsDark(e.matches));
  }, []);

  const processData = (logs: Notification[]) => {
    const monthMap: Record<string, number> = {};
    const weekMap: Record<string, number> = {};
    const typeMap: Record<string, number> = {};

    logs.forEach(notif => {
      const d = new Date(notif.date);
      const m = notif.date.slice(0, 7);
      const w = `${d.getFullYear()}-S${getWeekNumber(d)}`;
      const t = notif.title.split(":")[0].toUpperCase();

      monthMap[m] = (monthMap[m] || 0) + 1;
      weekMap[w] = (weekMap[w] || 0) + 1;
      typeMap[t] = (typeMap[t] || 0) + 1;
    });

    setByMonth(Object.entries(monthMap).map(([name, count]) => ({ name, count })));
    setByWeek(Object.entries(weekMap).map(([name, count]) => ({ name, count })));
    setByType(Object.entries(typeMap).map(([name, value]) => ({ name, value })));
  };

  const getWeekNumber = (d: Date) => {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  };

  const handlePrint = () => {
    if (printRef.current) {
      const w = window.open();
      if (w) {
        w.document.write(printRef.current.innerHTML);
        w.document.close();
        w.print();
      }
    }
  };

  const handleSendEmail = async () => {
    if (!printRef.current) return;
    const canvas = await html2canvas(printRef.current);
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF();
    pdf.addImage(imgData, "PNG", 10, 10, 190, 0);
    const blob = pdf.output("blob");

    const formData = new FormData();
    formData.append("pdf", blob, "report.pdf");

    await fetch("/api/share/report-stats", {
      method: "POST",
      body: formData,
    });

    alert("📩 Rapport envoyé !");
  };

  const handleShareLink = () => {
    const link = window.location.origin + "/public/report-stats";
    navigator.clipboard.writeText(link);
    alert("📤 Lien copié : " + link);
  };

  return (
    <div className="p-4">
      <div className="flex justify-between mb-4">
        <h3 className="text-xl font-bold">📊 Statistiques des rapports</h3>
        <div className="space-x-2">
          <button onClick={() => setView(view === "month" ? "week" : "month")} className="bg-gray-200 px-3 py-1 rounded">
            📅 {view === "month" ? "Mois" : "Semaine"}
          </button>
          <button onClick={handlePrint} className="bg-blue-600 text-white px-3 py-1 rounded">🖨️</button>
          <button onClick={handleSendEmail} className="bg-green-600 text-white px-3 py-1 rounded">📩</button>
          <button onClick={handleShareLink} className="bg-yellow-500 text-white px-3 py-1 rounded">📤</button>
        </div>
      </div>

      <div ref={printRef} className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={view === "month" ? byMonth : byWeek}>
            <XAxis dataKey="name" stroke={isDark ? "#ccc" : "#000"} />
            <YAxis stroke={isDark ? "#ccc" : "#000"} />
            <Tooltip />
            <Bar dataKey="count" fill={isDark ? "#00BFFF" : "#8884d8"} />
          </BarChart>
        </ResponsiveContainer>

        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie data={byType} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
              {byType.map((entry, index) => (
                <Cell key={index} fill={isDark ? "#ccc" : COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ReportStats;
