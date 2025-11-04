/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Area,
  AreaChart,
} from "recharts";
import {
  ChartBarIcon,
  ClipboardDocumentListIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
  GlobeAltIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";
import { useEffect, useMemo, useState } from "react";
import { Chart } from "react-google-charts";
import Link from "next/link";

type Decision = {
  type: string;
  metadata?: { isoCode?: string } | null;
};

const pieColors = [
  "#3b82f6",
  "#f59e0b",
  "#10b981",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#6366f1",
  "#14b8a6",
];
function useDecisionStats() {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch("/api/decisions")
      .then((r) => r.json())
      .then((d) => {
        const arr = Array.isArray(d.decisions)
          ? (d.decisions as Decision[])
          : [];
        setDecisions(arr);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);
  return { decisions, loading };
}

// Dashboard overview cards will be populated from /api/statistics
type StatCard = {
  name: string;
  value: string;
  change?: string;
  changeType?: "increase" | "decrease";
  icon: any;
};

// Alerts are loaded from /api/alerts?limit=10 with "Load more"

export default function Dashboard() {
  const { decisions, loading } = useDecisionStats();
  const [cards, setCards] = useState<StatCard[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [alertLimit, setAlertLimit] = useState(10);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const [alertsFromStats, setAlertsFromStats] = useState(false);
  const now = useMemo(() => new Date(), []);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [alertsError, setAlertsError] = useState<string | null>(null);

  // New: Store statistics data for charts
  const [countryGraphData, setCountryGraphData] = useState<any[]>([]);
  const [decisionsByTypeData, setDecisionsByTypeData] = useState<any[]>([]);

  // Load statistics for overview cards
  useEffect(() => {
    setLoadingStats(true);
    fetch("/api/statistics")
      .then((r) => r.json())
      .then((s) => {
        setStatsError(null);
        // Map to expected shape based on new API structure
        const totalAlerts = s?.totalAlerts ?? 0;
        const activeDecisions = s?.activeDecisions ?? 0;
        const blockedIps = s?.blockedIps ?? 0;
        const successRate = s?.successRate ?? null;

        const mapped: StatCard[] = [
          {
            name: "Total Alerts",
            value: String(totalAlerts),
            changeType: "increase",
            icon: ExclamationTriangleIcon,
          },
          {
            name: "Active Decisions",
            value: String(activeDecisions),
            changeType: "increase",
            icon: ClipboardDocumentListIcon,
          },
          {
            name: "Blocked IPs",
            value: String(blockedIps),
            changeType: "decrease",
            icon: ShieldCheckIcon,
          },
        ];
        if (successRate != null) {
          mapped.push({
            name: "Success Rate",
            value: `${successRate}%`,
            changeType: "increase",
            icon: ChartBarIcon,
          });
        }
        setCards(mapped);

        // Handle new countryGraph data
        if (Array.isArray(s?.countryGraph)) {
          setCountryGraphData(s.countryGraph);
        }

        // Handle new decisionsByType data
        if (Array.isArray(s?.decisionsByType)) {
          setDecisionsByTypeData(s.decisionsByType);
        }

        // Handle topRecentAlerts
        if (Array.isArray(s?.topRecentAlerts)) {
          const normalized = s.topRecentAlerts.map((a: any, idx: number) => ({
            id: idx,
            scenario: a?.name,
            decisions: [{ value: a?.ip }],
            stop_at: a?.timestamp,
          }));
          setAlerts(normalized);
          setAlertsFromStats(true);
        }
        setLoadingStats(false);
      })
      .catch(() => {
        setStatsError("Failed to load statistics");
        setLoadingStats(false);
      });
  }, []);

  // Load alerts with limit
  useEffect(() => {
    if (alertsFromStats) return;
    let cancelled = false;
    const controller = new AbortController();
    (async () => {
      if (!cancelled) setLoadingAlerts(true);
      try {
        const r = await fetch(`/api/alerts?limit=${alertLimit}`, {
          signal: controller.signal,
        });
        const a = await r.json();
        const list = Array.isArray(a?.alerts) ? a.alerts : [];
        if (!cancelled) {
          setAlerts(list);
          setAlertsError(null);
        }
      } catch {
        if (!cancelled) setAlertsError("Failed to load alerts");
      } finally {
        if (!cancelled) setLoadingAlerts(false);
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [alertLimit, alertsFromStats]);
  // Decision types data for Pie - use stats data if available, otherwise fallback to decisions
  const typeCounts = useMemo(() => {
    if (decisionsByTypeData.length > 0) {
      // Use data from statistics API
      return decisionsByTypeData.map((item: any) => ({
        type: item.type,
        value: item.count,
      }));
    }
    // Fallback to calculating from decisions
    return Array.from(
      decisions.reduce((m, d) => {
        m.set(d.type, (m.get(d.type) || 0) + 1);
        return m;
      }, new Map()),
      ([type, value]) => ({ type, value })
    );
  }, [decisionsByTypeData, decisions]);

  // Top country counts for Bar - use stats data if available, otherwise fallback to decisions
  const countryCounts = useMemo(() => {
    if (countryGraphData.length > 0) {
      // Use data from statistics API
      // Handle both formats: { country: "US", count: 86 } or { country: { value: "US" }, count: 86 }
      return countryGraphData
        .map((item: any) => {
          const iso =
            typeof item?.country === "string"
              ? item.country
              : item?.country?.value || "?";
          const count = item?.count || 0;
          return { country: iso, value: count };
        })
        .filter((item) => item.country !== "?")
        .sort((a, b) => b.value - a.value)
        .slice(0, 6);
    }
    // Fallback to calculating from decisions
    return Array.from(
      decisions.reduce((m, d) => {
        const iso = d?.metadata?.isoCode || "?";
        m.set(iso, (m.get(iso) || 0) + 1);
        return m;
      }, new Map()),
      ([iso, value]) => ({ country: iso, value })
    )
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [countryGraphData, decisions]);

  // World map data - use stats data if available, otherwise fallback to decisions
  const worldMapData = useMemo(() => {
    if (countryGraphData.length > 0) {
      // Use data from statistics API
      // Handle both formats: { country: "US", count: 86 } or { country: { value: "US" }, count: 86 }
      const chartData = countryGraphData
        .map((item: any) => {
          const iso =
            typeof item?.country === "string"
              ? item.country
              : item?.country?.value;
          const count = item?.count || 0;
          if (iso && iso !== "?") {
            return [iso, count];
          }
          return null;
        })
        .filter((item): item is [string, number] => item !== null);

      return [["Country", "Threats"], ...chartData];
    }
    // Fallback to calculating from decisions
    return [
      ["Country", "Threats"],
      ...Array.from(
        decisions.reduce((m, d) => {
          const iso = d?.metadata?.isoCode;
          if (iso && iso !== "?") {
            m.set(iso, (m.get(iso) || 0) + 1);
          }
          return m;
        }, new Map()),
        ([iso, value]) => [iso, value]
      ),
    ];
  }, [countryGraphData, decisions]);

  return (
    <div className="p-4 md:p-8 bg-gray-50 min-h-screen">
      {statsError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {statsError}
        </div>
      )}
      {alertsError && (
        <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          {alertsError}
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
          Security Dashboard
        </h1>
        <p className="text-base text-gray-600">
          Real-time monitoring and analytics for your security infrastructure
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        {cards.map((stat) => (
          <div
            key={stat.name}
            className="bg-white overflow-hidden shadow-lg rounded-xl border border-gray-100 hover:shadow-xl transition-shadow duration-200">
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-500 mb-1">
                    {stat.name}
                  </p>
                  <p className="text-3xl font-bold text-gray-900">
                    {stat.value}
                  </p>
                  {stat.change && (
                    <p
                      className={`mt-2 text-sm font-semibold ${
                        stat.changeType === "increase"
                          ? "text-green-600"
                          : "text-red-600"
                      }`}>
                      {stat.change}
                    </p>
                  )}
                </div>
                <div className="shrink-0">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <stat.icon
                      className="h-8 w-8 text-blue-600"
                      aria-hidden="true"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      {/* World Map - Full Width */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-8">
        <div className="flex items-center mb-6">
          <GlobeAltIcon className="h-6 w-6 text-blue-600 mr-2" />
          <h3 className="text-xl font-semibold text-gray-900">
            Global Threat Map
          </h3>
        </div>
        <div className="h-[500px]">
          <Chart
            chartType="GeoChart"
            width="100%"
            height="100%"
            data={worldMapData}
            options={{
              colorAxis: {
                colors: ["#dbeafe", "#93c5fd", "#3b82f6", "#1e40af", "#1e3a8a"],
                minValue: 0,
              },
              backgroundColor: "#f9fafb",
              datalessRegionColor: "#e5e7eb",
              defaultColor: "#f3f4f6",
              legend: "none",
              tooltip: {
                textStyle: { fontSize: 12 },
                trigger: "focus",
              },
            }}
          />
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Decision Types - Pie Chart */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
          <div className="flex items-center mb-6">
            <ChartBarIcon className="h-6 w-6 text-blue-600 mr-2" />
            <h3 className="text-xl font-semibold text-gray-900">
              Decisions by Type
            </h3>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={typeCounts}
                dataKey="value"
                nameKey="type"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={({ type, percent }) =>
                  `${type} (${Math.round(Number(percent ?? 0) * 100)}%)`
                }
                labelLine={true}>
                {typeCounts.map((entry, i) => (
                  <Cell
                    key={entry.type}
                    fill={pieColors[i % pieColors.length]}
                  />
                ))}
              </Pie>
              <RechartsTooltip />
              <Legend
                verticalAlign="bottom"
                height={40}
                wrapperStyle={{ paddingTop: "20px" }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Top Countries - Bar Chart */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
          <div className="flex items-center mb-6">
            <GlobeAltIcon className="h-6 w-6 text-blue-600 mr-2" />
            <h3 className="text-xl font-semibold text-gray-900">
              Top Countries (Bar)
            </h3>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={countryCounts}
              margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="country"
                tick={{ fill: "#6b7280", fontSize: 12 }}
              />
              <YAxis tick={{ fill: "#6b7280", fontSize: 12 }} />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                }}
              />
              <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                {countryCounts.map((entry, i) => (
                  <Cell
                    key={entry.country}
                    fill={pieColors[i % pieColors.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
        {/* Recent Alerts - Takes 2 columns */}
        <div className="lg:col-span-2 bg-white shadow-lg rounded-xl border border-gray-100">
          <div className="px-6 py-5 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <ClockIcon className="h-6 w-6 text-blue-600 mr-2" />
                <h3 className="text-xl font-semibold text-gray-900">
                  Recent Alerts
                </h3>
              </div>
              <Link
                href="/alerts"
                className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline">
                View all →
              </Link>
            </div>
          </div>
          <div className="px-6 py-4">
            <div className="flow-root">
              <ul className="divide-y divide-gray-100">
                {alerts.slice(0, 8).map((alert: any) => (
                  <li
                    key={alert.id}
                    className="py-4 hover:bg-gray-50 px-2 rounded-lg transition-colors">
                    <div className="flex items-center space-x-4">
                      <div className="shrink-0">
                        <div
                          className={`h-3 w-3 rounded-full ${
                            (alert?.severity || "High") === "Critical"
                              ? "bg-red-500 animate-pulse"
                              : (alert?.severity || "High") === "High"
                              ? "bg-orange-500"
                              : "bg-yellow-500"
                          }`}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {alert?.scenario || "Alert"}
                        </p>
                        <p className="text-sm text-gray-600 truncate">
                          IP: {alert?.decisions?.[0]?.value || "-"}
                        </p>
                      </div>
                      <div className="shrink-0 text-sm text-gray-500">
                        {new Date(
                          alert?.stop_at || alert?.start_at || now
                        ).toLocaleString()}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              {!alertsFromStats && alerts.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-center">
                  <button
                    onClick={() => setAlertLimit((l) => l + 10)}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors">
                    Load more alerts
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions
        <div className="bg-white shadow-lg rounded-xl border border-gray-100">
          <div className="px-6 py-5 border-b border-gray-100">
            <h3 className="text-xl font-semibold text-gray-900">
              Quick Actions
            </h3>
          </div>
          <div className="px-6 py-5">
            <div className="space-y-3">
              <Link
                href="/alerts"
                className="w-full flex items-center justify-center px-4 py-3 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors shadow-sm">
                View All Alerts
              </Link>
              <Link
                href="/decisions"
                className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors">
                Manage Decisions
              </Link>
              <button className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors">
                Export Report
              </button>
              <Link
                href="/settings"
                className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors">
                Settings
              </Link>
            </div>
          </div>
        </div> */}
      </div>
    </div>
  );
}
