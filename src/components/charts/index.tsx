import {
  LineChart as RechartsLineChart,
  Line,
  AreaChart as RechartsAreaChart,
  Area,
  BarChart as RechartsBarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const CHART_COLORS = {
  primary: "hsl(var(--primary))",
  success: "rgb(34, 197, 94)",
  warning: "rgb(245, 158, 11)",
  destructive: "rgb(239, 68, 68)",
  muted: "hsl(var(--muted-foreground))",
};

const PIE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4"];

const tooltipStyle = {
  backgroundColor: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "6px",
  padding: "8px 12px",
  fontSize: "12px",
};

/* ==================== LINE CHART ==================== */
interface LineChartProps {
  data: Array<Record<string, unknown>> | unknown[];
  xKey: string;
  yKey: string;
  color?: string;
  height?: number;
}

export function LineChart({ data, xKey, yKey, color = CHART_COLORS.primary, height = 240 }: LineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsLineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey={xKey} stroke={CHART_COLORS.muted} fontSize={11} />
        <YAxis stroke={CHART_COLORS.muted} fontSize={11} />
        <Tooltip contentStyle={tooltipStyle} />
        <Line type="monotone" dataKey={yKey} stroke={color} strokeWidth={2} dot={{ r: 3 }} />
      </RechartsLineChart>
    </ResponsiveContainer>
  );
}

/* ==================== AREA CHART ==================== */
export function AreaChart({ data, xKey, yKey, color = CHART_COLORS.primary, height = 240 }: LineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsAreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`gradient-${yKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey={xKey} stroke={CHART_COLORS.muted} fontSize={11} />
        <YAxis stroke={CHART_COLORS.muted} fontSize={11} />
        <Tooltip contentStyle={tooltipStyle} />
        <Area type="monotone" dataKey={yKey} stroke={color} strokeWidth={2} fill={`url(#gradient-${yKey})`} />
      </RechartsAreaChart>
    </ResponsiveContainer>
  );
}

/* ==================== BAR CHART ==================== */
interface BarChartProps {
  data: Array<Record<string, unknown>> | unknown[];
  xKey: string;
  yKey: string;
  color?: string;
  height?: number;
  horizontal?: boolean;
}

export function BarChart({ data, xKey, yKey, color = CHART_COLORS.primary, height = 240, horizontal = false }: BarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsBarChart
        data={data}
        layout={horizontal ? "vertical" : "horizontal"}
        margin={{ top: 10, right: 10, left: horizontal ? 60 : 0, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        {horizontal ? (
          <>
            <XAxis type="number" stroke={CHART_COLORS.muted} fontSize={11} />
            <YAxis type="category" dataKey={xKey} stroke={CHART_COLORS.muted} fontSize={11} width={60} />
          </>
        ) : (
          <>
            <XAxis dataKey={xKey} stroke={CHART_COLORS.muted} fontSize={11} />
            <YAxis stroke={CHART_COLORS.muted} fontSize={11} />
          </>
        )}
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey={yKey} fill={color} radius={[4, 4, 0, 0]} />
      </RechartsBarChart>
    </ResponsiveContainer>
  );
}

/* ==================== PIE / DONUT CHART ==================== */
interface PieChartProps {
  data: Array<{ name: string; value: number }>;
  height?: number;
  donut?: boolean;
}

export function PieChart({ data, height = 240, donut = true }: PieChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsPieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={donut ? 50 : 0}
          outerRadius={80}
          dataKey="value"
          paddingAngle={2}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: "11px" }} />
      </RechartsPieChart>
    </ResponsiveContainer>
  );
}

/* ==================== COMPARISON BAR (TWO SERIES) ==================== */
interface ComparisonProps {
  data: Array<Record<string, unknown>> | unknown[];
  xKey: string;
  series: Array<{ key: string; name: string; color?: string }>;
  height?: number;
}

export function ComparisonBar({ data, xKey, series, height = 240 }: ComparisonProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsBarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey={xKey} stroke={CHART_COLORS.muted} fontSize={11} />
        <YAxis stroke={CHART_COLORS.muted} fontSize={11} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: "11px" }} />
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.name}
            fill={s.color || PIE_COLORS[i % PIE_COLORS.length]}
            radius={[4, 4, 0, 0]}
          />
        ))}
      </RechartsBarChart>
    </ResponsiveContainer>
  );
}
