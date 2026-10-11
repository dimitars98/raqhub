"use client";

import { useState, useMemo } from "react";
import { subDays, format, eachDayOfInterval } from "date-fns";
import {
  TrendingUp,
  TrendingDown,
  CalendarDays,
  Users,
  AlertCircle,
  Minus,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";

// ── Types ──────────────────────────────────────────────────────────────────

export type AnalyticsData = {
  totalRevenue: number;
  revenueChange: number | null;
  totalBookings: number;
  activeMembers: number;
  expiringSoon: number;
  revenueByDay: Record<string, number>;
  bookingsByStatus: Record<string, number>;
  revenueBySport: Record<string, number>;
  courtUtilization: { name: string; count: number; revenue: number }[];
  peakHours: number[][];
  membersByPlan: Record<string, number>;
  memberGrowth: { month: string; count: number }[];
};

type Range = "30" | "90" | "365";

// ── Constants ──────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  confirmed: "#7aad12",
  completed: "#3d4f35",
  pending: "#378add",
  cancelled: "#d0d9c9",
  no_show: "#f87171",
};

const SPORT_COLORS: Record<string, string> = {
  tennis: "#7aad12",
  padel: "#378add",
  pickleball: "#f59e0b",
};

const SPORT_EMOJI: Record<string, string> = {
  tennis: "🎾",
  padel: "🏓",
  pickleball: "🥒",
};

const PLAN_COLORS = [
  "#7aad12",
  "#378add",
  "#f59e0b",
  "#a78bfa",
  "#f87171",
  "#6e7f65",
];

const DAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 15 }, (_, i) => `${i + 7}h`);

const TOOLTIP_STYLE = {
  background: "#fff",
  border: "0.5px solid #e8ede4",
  borderRadius: 12,
  fontSize: 12,
};

// ── Helpers ────────────────────────────────────────────────────────────────

function pct(val: number, total: number) {
  return total === 0 ? 0 : Math.round((val / total) * 100);
}

// ── Sub-components ─────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  icon: React.ElementType;
  accent: string;
}) {
  return (
    <div className="bg-white border border-[#e8ede4] rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[#6e7f65] uppercase tracking-wider">
          {label}
        </span>
        <div
          className={`w-8 h-8 rounded-xl flex items-center justify-center ${accent}`}
        >
          <Icon size={15} strokeWidth={2} />
        </div>
      </div>
      <div>
        <div className="text-2xl font-bold text-[#111c0a]">{value}</div>
        {sub && (
          <div className="text-xs text-[#6e7f65] mt-1 flex items-center gap-1">
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}

function SectionCard({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-[#e8ede4] rounded-2xl p-5">
      <div className="mb-4">
        <div className="text-sm font-semibold text-[#111c0a]">{title}</div>
        {sub && <div className="text-xs text-[#6e7f65] mt-0.5">{sub}</div>}
      </div>
      {children}
    </div>
  );
}

function PeakHeatmap({ peakHours }: { peakHours: number[][] }) {
  const maxVal = Math.max(...peakHours.flat(), 1);
  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: 480 }}>
        <div className="flex mb-1 ml-10">
          {HOURS.map((h, i) => (
            <div
              key={i}
              className="flex-1 text-center text-[9px] text-[#6e7f65]"
            >
              {i % 2 === 0 ? h : ""}
            </div>
          ))}
        </div>
        {DAYS_SHORT.map((day, di) => (
          <div key={di} className="flex items-center mb-0.5">
            <div className="w-10 text-[10px] text-[#6e7f65] flex-shrink-0">
              {day}
            </div>
            {peakHours[di].map((val, hi) => {
              const intensity = val / maxVal;
              const bg =
                val === 0
                  ? "#f4f6f2"
                  : `rgba(122, 173, 18, ${0.1 + intensity * 0.9})`;
              return (
                <div
                  key={hi}
                  className="flex-1 h-6 rounded-sm mx-[1px] flex items-center justify-center"
                  style={{ background: bg }}
                  title={`${day} ${hi + 7}:00 — ${val} bookings`}
                >
                  {val > 0 && intensity > 0.5 && (
                    <span className="text-[8px] text-white font-bold">
                      {val}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        <div className="flex items-center gap-2 mt-3 ml-10">
          <span className="text-[9px] text-[#6e7f65]">Low</span>
          {[0.1, 0.3, 0.5, 0.7, 0.9].map((o) => (
            <div
              key={o}
              className="w-4 h-3 rounded-sm"
              style={{ background: `rgba(122, 173, 18, ${o})` }}
            />
          ))}
          <span className="text-[9px] text-[#6e7f65]">High</span>
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function AnalyticsClient({ data }: { data: AnalyticsData }) {
  const [range, setRange] = useState<Range>("30");

  const {
    totalRevenue,
    revenueChange,
    totalBookings,
    activeMembers,
    expiringSoon,
    revenueByDay,
    bookingsByStatus,
    revenueBySport,
    courtUtilization,
    peakHours,
    membersByPlan,
    memberGrowth,
  } = data;

  const revenueChartData = useMemo(() => {
    const days = eachDayOfInterval({
      start: subDays(new Date(), parseInt(range) - 1),
      end: new Date(),
    });
    const step = range === "365" ? 7 : range === "90" ? 3 : 1;
    return days
      .filter((_, i) => i % step === 0)
      .map((d) => ({
        date: format(d, "d MMM"),
        revenue: revenueByDay[format(d, "yyyy-MM-dd")] ?? 0,
      }));
  }, [range, revenueByDay]);

  const statusData = useMemo(
    () =>
      Object.entries(bookingsByStatus).map(([name, value]) => ({
        name,
        value,
        color: STATUS_COLORS[name] ?? "#e8ede4",
      })),
    [bookingsByStatus],
  );

  const sportData = useMemo(
    () =>
      Object.entries(revenueBySport)
        .map(([name, revenue]) => ({
          name: `${SPORT_EMOJI[name] ?? ""} ${name}`,
          revenue,
          color: SPORT_COLORS[name] ?? "#7aad12",
        }))
        .sort((a, b) => b.revenue - a.revenue),
    [revenueBySport],
  );

  const courtData = useMemo(
    () =>
      courtUtilization.slice(0, 8).map((c) => ({
        name: c.name,
        bookings: c.count,
        revenue: c.revenue,
      })),
    [courtUtilization],
  );

  const planData = useMemo(
    () =>
      Object.entries(membersByPlan)
        .sort((a, b) => b[1] - a[1])
        .map(([name, value]) => ({ name, value })),
    [membersByPlan],
  );

  const totalBookingsCount = Object.values(bookingsByStatus).reduce(
    (s, v) => s + v,
    0,
  );

  return (
    <div className="max-w-[1100px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[22px] font-semibold text-[#111c0a]">
            Analytics
          </h1>
          <p className="text-sm text-[#6e7f65] mt-1">
            Performance overview for your club
          </p>
        </div>
        <div className="flex gap-1 bg-[#f4f6f2] p-1 rounded-xl">
          {(["30", "90", "365"] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                range === r
                  ? "bg-white text-[#111c0a] shadow-sm"
                  : "text-[#6e7f65] hover:text-[#111c0a]"
              }`}
            >
              {r === "365" ? "1 year" : `${r} days`}
            </button>
          ))}
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Total revenue"
          value={`€${totalRevenue.toFixed(0)}`}
          sub={
            revenueChange === null ? (
              "vs previous period"
            ) : revenueChange > 0 ? (
              <span className="text-[#7aad12] flex items-center gap-1">
                <TrendingUp size={11} /> +{revenueChange.toFixed(1)}% vs prev
                30d
              </span>
            ) : revenueChange < 0 ? (
              <span className="text-red-500 flex items-center gap-1">
                <TrendingDown size={11} /> {revenueChange.toFixed(1)}% vs prev
                30d
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Minus size={11} /> Same as prev 30d
              </span>
            )
          }
          icon={TrendingUp}
          accent="bg-[#f3fbde] text-[#7aad12]"
        />
        <KpiCard
          label="Total bookings"
          value={String(totalBookings)}
          sub="Last 12 months"
          icon={CalendarDays}
          accent="bg-[#e8f4fd] text-[#1a5ea8]"
        />
        <KpiCard
          label="Active members"
          value={String(activeMembers)}
          sub="All time"
          icon={Users}
          accent="bg-[#f3fbde] text-[#7aad12]"
        />
        <KpiCard
          label="Expiring soon"
          value={String(expiringSoon)}
          sub="Next 30 days"
          icon={AlertCircle}
          accent={
            expiringSoon > 0
              ? "bg-amber-50 text-amber-600"
              : "bg-[#e8ede4] text-[#6e7f65]"
          }
        />
      </div>

      {/* Revenue chart */}
      <SectionCard title="Revenue over time" sub={`Last ${range} days`}>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart
            data={revenueChartData}
            margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#7aad12" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#7aad12" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#e8ede4"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "#6e7f65" }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#6e7f65" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `€${v}`}
              width={48}
            />
            <Tooltip
              formatter={(v, name) => {
                const num = Number(v ?? 0);
                return [`€${num.toFixed(2)}`, "Revenue"] as [string, string];
              }}
              contentStyle={TOOLTIP_STYLE}
              cursor={{ stroke: "#e8ede4", strokeWidth: 1 }}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#7aad12"
              strokeWidth={2}
              fill="url(#revGrad)"
              dot={false}
              activeDot={{
                r: 4,
                fill: "#7aad12",
                stroke: "#fff",
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </SectionCard>

      {/* Bookings by status + Revenue by sport */}
      <div className="grid lg:grid-cols-2 gap-4 mt-4">
        <SectionCard title="Bookings by status" sub="All time">
          {statusData.length === 0 ? (
            <div className="text-sm text-[#6e7f65] py-4">No data yet</div>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={160}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={42}
                    outerRadius={68}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {statusData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v, name) => {
                      const num = Number(v ?? 0);
                      return [
                        `${num} (${pct(num, totalBookingsCount)}%)`,
                        String(name).replace("_", " "),
                      ] as [string, string];
                    }}
                    contentStyle={TOOLTIP_STYLE}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-2 flex-1">
                {statusData.map((s) => (
                  <div key={s.name} className="flex items-center gap-2 text-xs">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: s.color }}
                    />
                    <span className="text-[#3d4f35] capitalize flex-1">
                      {s.name.replace("_", " ")}
                    </span>
                    <span className="font-medium text-[#111c0a]">
                      {s.value}
                    </span>
                    <span className="text-[#6e7f65]">
                      {pct(s.value, totalBookingsCount)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Revenue by sport" sub="All time">
          {sportData.length === 0 ? (
            <div className="text-sm text-[#6e7f65] py-4">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart
                data={sportData}
                layout="vertical"
                margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
              >
                <XAxis
                  type="number"
                  tick={{ fontSize: 10, fill: "#6e7f65" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `€${v}`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "#3d4f35" }}
                  axisLine={false}
                  tickLine={false}
                  width={90}
                />
                <Tooltip
                  formatter={(v, name) => {
                    const num = Number(v ?? 0);
                    return [`€${num.toFixed(2)}`, "Revenue"] as [
                      string,
                      string,
                    ];
                  }}
                  contentStyle={TOOLTIP_STYLE}
                />
                <Bar dataKey="revenue" radius={[0, 6, 6, 0]}>
                  {sportData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>
      </div>

      {/* Peak hours heatmap */}
      <div className="mt-4">
        <SectionCard title="Peak hours" sub="Booking frequency by day and hour">
          <PeakHeatmap peakHours={peakHours} />
        </SectionCard>
      </div>

      {/* Court utilization + Members */}
      <div className="grid lg:grid-cols-2 gap-4 mt-4">
        <SectionCard
          title="Court utilization"
          sub="Bookings per court (all time)"
        >
          {courtData.length === 0 ? (
            <div className="text-sm text-[#6e7f65]">No court data</div>
          ) : (
            <ResponsiveContainer
              width="100%"
              height={Math.max(courtData.length * 36, 120)}
            >
              <BarChart
                data={courtData}
                layout="vertical"
                margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
              >
                <XAxis
                  type="number"
                  tick={{ fontSize: 10, fill: "#6e7f65" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "#3d4f35" }}
                  axisLine={false}
                  tickLine={false}
                  width={80}
                />
                <Tooltip
                  formatter={(v, name) => {
                    const num = Number(v ?? 0);
                    return name === "revenue"
                      ? ([`€${num.toFixed(2)}`, "Revenue"] as [string, string])
                      : ([String(num), "Bookings"] as [string, string]);
                  }}
                  contentStyle={TOOLTIP_STYLE}
                />
                <Bar dataKey="bookings" fill="#7aad12" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        <div className="flex flex-col gap-4">
          {/* Members by plan */}
          <SectionCard title="Members by plan" sub="Current distribution">
            {planData.length === 0 ? (
              <div className="text-sm text-[#6e7f65]">No members</div>
            ) : (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="50%" height={140}>
                  <PieChart>
                    <Pie
                      data={planData}
                      cx="50%"
                      cy="50%"
                      innerRadius={36}
                      outerRadius={60}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {planData.map((_, i) => (
                        <Cell
                          key={i}
                          fill={PLAN_COLORS[i % PLAN_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v, name) => {
                        return [String(Number(v ?? 0)), String(name)] as [
                          string,
                          string,
                        ];
                      }}
                      contentStyle={TOOLTIP_STYLE}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-2 flex-1">
                  {planData.map((p, i) => (
                    <div
                      key={p.name}
                      className="flex items-center gap-2 text-xs"
                    >
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{
                          background: PLAN_COLORS[i % PLAN_COLORS.length],
                        }}
                      />
                      <span className="text-[#3d4f35] flex-1 truncate">
                        {p.name}
                      </span>
                      <span className="font-medium text-[#111c0a]">
                        {p.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </SectionCard>

          {/* Member growth */}
          <SectionCard
            title="Member growth"
            sub="Cumulative members over 12 months"
          >
            <ResponsiveContainer width="100%" height={120}>
              <AreaChart
                data={memberGrowth}
                margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="memberGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#378add" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#378add" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#e8ede4"
                  vertical={false}
                />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 10, fill: "#6e7f65" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#6e7f65" }}
                  axisLine={false}
                  tickLine={false}
                  width={28}
                  allowDecimals={false}
                />
                <Tooltip
                  formatter={(v, name) => {
                    return [String(Number(v ?? 0)), "Members"] as [
                      string,
                      string,
                    ];
                  }}
                  contentStyle={TOOLTIP_STYLE}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#378add"
                  strokeWidth={2}
                  fill="url(#memberGrad)"
                  dot={false}
                  activeDot={{
                    r: 4,
                    fill: "#378add",
                    stroke: "#fff",
                    strokeWidth: 2,
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
