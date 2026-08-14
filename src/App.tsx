import { useState, useEffect } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import {
  Thermometer,
  Droplets,
  Waves,
  Gauge,
  Activity,
  ShieldAlert,
  Power,
  Zap,
  Radio,
  ServerOff,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

const API_URL = "https://api.ayodejib.dev";
const DEVICE_ID = "pond_01";

interface SensorReading {
  id: string;
  deviceId: string;
  temperatureC: number;
  ph: number;
  turbidityNtu: number;
  pondLevelPct: number;
  pumpInActive: boolean;
  pumpDrainActive: boolean;
  createdAt: string;
  timeFormatted?: string;
}

interface ControlState {
  manual_mode: boolean;
  pump_in: boolean;
  pump_drain: boolean;
  simulate_breach: boolean;
}

export default function App() {
  const [history, setHistory] = useState<SensorReading[]>([]);
  const [latest, setLatest] = useState<SensorReading | null>(null);
  const [isHardwareOnline, setIsHardwareOnline] = useState<boolean>(false);

  const [controls, setControls] = useState<ControlState>({
    manual_mode: false,
    pump_in: false,
    pump_drain: false,
    simulate_breach: false,
  });

  const reqHeaders = {
    "Content-Type": "application/json",
  };

  const fetchData = async () => {
    try {
      const [dataRes, controlRes] = await Promise.all([
        fetch(`${API_URL}/pond/data/${DEVICE_ID}`, { headers: reqHeaders }),
        fetch(`${API_URL}/pond/control/${DEVICE_ID}`, { headers: reqHeaders }),
      ]);

      if (dataRes.ok) {
        const dataJson: SensorReading[] = await dataRes.json();
        const formatted = dataJson.map((item) => ({
          ...item,
          timeFormatted: new Date(item.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
        }));

        setHistory(formatted);

        if (formatted.length > 0) {
          setLatest(formatted[formatted.length - 1]);
        }

        // Hardware Detection Logic:
        // ESP32 pushes every 4s. Worker pushes every 60s.
        // If the gap between the last two readings is < 15s, the hardware is live.
        if (formatted.length >= 2) {
          const lastTime = new Date(
            formatted[formatted.length - 1].createdAt,
          ).getTime();
          const prevTime = new Date(
            formatted[formatted.length - 2].createdAt,
          ).getTime();
          const timeDelta = lastTime - prevTime;

          setIsHardwareOnline(timeDelta < 15000);
        } else {
          setIsHardwareOnline(false);
        }
      }

      if (controlRes.ok) {
        const controlJson: ControlState = await controlRes.json();
        setControls(controlJson);
      }
    } catch (err) {
      console.error("Failed to fetch telemetry:", err);
      setIsHardwareOnline(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  const toggleControl = async (key: keyof ControlState, value?: boolean) => {
    const nextState = {
      ...controls,
      [key]: value !== undefined ? value : !controls[key],
    };
    setControls(nextState);

    try {
      await fetch(`${API_URL}/pond/control/${DEVICE_ID}`, {
        method: "POST",
        headers: reqHeaders,
        body: JSON.stringify(nextState),
      });
    } catch (err) {
      console.error("Failed to update control state:", err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-6 lg:p-8 space-y-8 font-sans">
      {/* Top Bar */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              AquaSense Engine
            </h1>
            <Badge
              variant="secondary"
              className="bg-slate-200 text-slate-700 hover:bg-slate-200"
            >
              {DEVICE_ID}
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time Telemetry & Remote Control Node
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isHardwareOnline ? (
            <Badge className="flex items-center gap-1.5 py-1 px-3 text-xs font-semibold bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0">
              <Radio className="h-3.5 w-3.5 animate-pulse text-emerald-600" />
              HARDWARE ONLINE
            </Badge>
          ) : (
            <Badge className="flex items-center gap-1.5 py-1 px-3 text-xs font-semibold bg-amber-100 text-amber-700 hover:bg-amber-100 border-0">
              <ServerOff className="h-3.5 w-3.5 text-amber-600" />
              MOCKED / OFFLINE
            </Badge>
          )}
        </div>
      </header>

      {/* Telemetry Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Temperature"
          value={latest?.temperatureC}
          unit="°C"
          icon={<Thermometer className="h-5 w-5 text-rose-500" />}
          status={
            latest
              ? latest.temperatureC > 32 || latest.temperatureC < 20
                ? "DANGER"
                : "OPTIMAL"
              : "UNKNOWN"
          }
        />
        <MetricCard
          title="pH Balance"
          value={latest?.ph}
          unit="pH"
          icon={<Droplets className="h-5 w-5 text-emerald-500" />}
          status={
            latest
              ? latest.ph > 8.5 || latest.ph < 6.5
                ? "DANGER"
                : "OPTIMAL"
              : "UNKNOWN"
          }
        />
        <MetricCard
          title="Turbidity"
          value={latest?.turbidityNtu}
          unit="NTU"
          icon={<Waves className="h-5 w-5 text-cyan-500" />}
          status={
            latest
              ? latest.turbidityNtu > 50
                ? "DANGER"
                : "OPTIMAL"
              : "UNKNOWN"
          }
        />
        <MetricCard
          title="Water Level"
          value={latest?.pondLevelPct}
          unit="%"
          icon={<Gauge className="h-5 w-5 text-indigo-500" />}
          status={
            latest ? (latest.pondLevelPct < 50 ? "LOW" : "FULL") : "UNKNOWN"
          }
        />
      </div>

      {/* Main Grid: Graph + Control Center */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Telemetry Graph */}
        <Card className="lg:col-span-2 bg-white border-slate-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-slate-500" /> Sensor Stream
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Historical rolling metrics for Temperature, pH, and Turbidity
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="h-85 pt-4">
            {history.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={history}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorPh" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorTurb" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#e2e8f0"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="timeFormatted"
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />

                  {/* Left Axis: Temp & Turbidity (similar scales usually) */}
                  <YAxis
                    yAxisId="left"
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  {/* Right Axis: pH (0-14 scale) */}
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#94a3b8"
                    domain={[0, 14]}
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />

                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      borderColor: "#e2e8f0",
                      borderRadius: "8px",
                      fontSize: "12px",
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    }}
                  />

                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="temperatureC"
                    stroke="#f43f5e"
                    fillOpacity={1}
                    fill="url(#colorTemp)"
                    name="Temp (°C)"
                    strokeWidth={2}
                  />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="turbidityNtu"
                    stroke="#0ea5e9"
                    fillOpacity={1}
                    fill="url(#colorTurb)"
                    name="Turbidity (NTU)"
                    strokeWidth={2}
                  />
                  <Area
                    yAxisId="right"
                    type="monotone"
                    dataKey="ph"
                    stroke="#10b981"
                    fillOpacity={1}
                    fill="url(#colorPh)"
                    name="pH"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                No telemetry streams detected...
              </div>
            )}
          </CardContent>
        </Card>

        {/* Command & Override Panel */}
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <Power className="h-4 w-4 text-amber-500" /> Command Center
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Override automatic pump state machine or execute tests
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Manual Mode Toggle */}
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="space-y-0.5">
                <label className="text-sm font-semibold text-slate-900 block">
                  Manual Override
                </label>
                <span className="text-[11px] text-slate-500 block">
                  Bypasses automatic thresholds
                </span>
              </div>
              <Switch
                checked={controls.manual_mode}
                onCheckedChange={(val) => toggleControl("manual_mode", val)}
              />
            </div>

            {/* Pump Controls */}
            <div
              className={`space-y-3 transition-opacity duration-300 ${controls.manual_mode ? "opacity-100" : "opacity-40 pointer-events-none"}`}
            >
              <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white">
                <span className="text-sm font-medium text-slate-700">
                  Inflow Pump
                </span>
                <Button
                  size="sm"
                  variant={controls.pump_in ? "default" : "outline"}
                  onClick={() => toggleControl("pump_in")}
                  className={`text-xs h-8 w-24 ${controls.pump_in ? "bg-cyan-600 hover:bg-cyan-700 text-white" : ""}`}
                >
                  <Zap
                    className={`h-3 w-3 mr-1 ${controls.pump_in ? "text-cyan-200" : "text-slate-400"}`}
                  />
                  {controls.pump_in ? "ACTIVE" : "IDLE"}
                </Button>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white">
                <span className="text-sm font-medium text-slate-700">
                  Drain Pump
                </span>
                <Button
                  size="sm"
                  variant={controls.pump_drain ? "default" : "outline"}
                  onClick={() => toggleControl("pump_drain")}
                  className={`text-xs h-8 w-24 ${controls.pump_drain ? "bg-cyan-600 hover:bg-cyan-700 text-white" : ""}`}
                >
                  <Zap
                    className={`h-3 w-3 mr-1 ${controls.pump_drain ? "text-cyan-200" : "text-slate-400"}`}
                  />
                  {controls.pump_drain ? "ACTIVE" : "IDLE"}
                </Button>
              </div>
            </div>

            {/* Simulated Data Breach Button */}
            <div className="pt-4 border-t border-slate-100">
              <Button
                variant={controls.simulate_breach ? "destructive" : "outline"}
                className={`w-full text-xs font-semibold h-10 ${controls.simulate_breach
                    ? "animate-pulse"
                    : "hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200"
                  }`}
                onClick={() => toggleControl("simulate_breach")}
              >
                <ShieldAlert className="h-4 w-4 mr-2" />
                {controls.simulate_breach
                  ? "STOP BREACH SIMULATION"
                  : "SIMULATE DATA BREACH"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  unit,
  icon,
  status,
}: {
  title: string;
  value?: number;
  unit: string;
  icon: React.ReactNode;
  status: "OPTIMAL" | "DANGER" | "LOW" | "FULL" | "UNKNOWN";
}) {
  const isDanger = status === "DANGER" || status === "LOW";

  return (
    <Card
      className={`bg-white shadow-sm transition-colors ${isDanger ? "border-rose-300 bg-rose-50/50" : "border-slate-200"}`}
    >
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-slate-500">{title}</span>
          <div className="p-2 bg-slate-50 rounded-md border border-slate-100">
            {icon}
          </div>
        </div>
        <div className="flex items-baseline justify-between">
          <div className="text-2xl font-bold tracking-tight text-slate-900">
            {typeof value === "number" ? value.toFixed(1) : "--"}
            <span className="text-sm font-normal text-slate-500 ml-1">
              {unit}
            </span>
          </div>
          <Badge
            variant="outline"
            className={`text-[10px] font-bold uppercase px-2 py-0.5 border-0 ${isDanger
                ? "bg-rose-100 text-rose-700"
                : "bg-emerald-100 text-emerald-700"
              }`}
          >
            {status}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
