/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

// --- recharts imports ---
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartBarIcon,
  ClipboardDocumentListIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import { useEffect, useMemo, useState } from "react";

import Link from "next/link";

type Decision = {
  type: string;
  metadata?: { isoCode?: string } | null;
};

const pieColors = [
  "#0070f3",
  "#f59e42",
  "#16a34a",
  "#ef4444",
  "#f43f5e",
  "#8b5cf6",
  "#6ee7b7",
  "#fdba74",
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

  // Load statistics for overview cards
  useEffect(() => {
    setLoadingStats(true);
    fetch("/api/statistics")
      .then((r) => r.json())
      .then((s) => {
        setStatsError(null);
        // Map to expected shape based on provided preview
        const totalAlerts = s?.totalAlerts ?? s?.alertsTotal ?? 0;
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
  // Decision types data for Pie
  const typeCounts = Array.from(
    decisions.reduce((m, d) => {
      m.set(d.type, (m.get(d.type) || 0) + 1);
      return m;
    }, new Map()),
    ([type, value]) => ({ type, value })
  );

  // Top country counts for Bar
  const countryCounts = Array.from(
    decisions.reduce((m, d) => {
      const iso = d?.metadata?.isoCode || "?";
      m.set(iso, (m.get(iso) || 0) + 1);
      return m;
    }, new Map()),
    ([iso, value]) => ({ country: iso, value })
  )
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  return (
    <div className="p-4 md:p-6">
      {statsError && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {statsError}
        </div>
      )}
      {alertsError && (
        <div className="mb-4 rounded border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
          {alertsError}
        </div>
      )}
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
          Security Dashboard
        </h1>
        <p className="mt-2 text-sm md:text-base text-gray-600">
          Monitor and manage security events across your infrastructure
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow flex flex-col items-center py-5">
          <h3 className="font-semibold mb-3 text-gray-800 text-center">
            Decisions by Type
          </h3>
          <ResponsiveContainer
            width="100%"
            height={220}
            minWidth={200}
            minHeight={180}>
            <PieChart>
              <Pie
                data={typeCounts}
                dataKey="value"
                nameKey="type"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={({ type, percent }) =>
                  `${type} (${Math.round(Number(percent ?? 0) * 100)}%)`
                }>
                {typeCounts.map((entry, i) => (
                  <Cell
                    key={entry.type}
                    fill={pieColors[i % pieColors.length]}
                  />
                ))}
              </Pie>
              <RechartsTooltip />
              <Legend verticalAlign="bottom" height={36} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-lg shadow flex flex-col items-center py-5">
          <h3 className="font-semibold mb-3 text-gray-800 text-center">
            Top Countries
          </h3>
          <ResponsiveContainer
            width="100%"
            height={220}
            minWidth={200}
            minHeight={180}>
            <BarChart
              data={countryCounts}
              layout="vertical"
              margin={{ top: 20, right: 20, left: 15, bottom: 10 }}>
              <XAxis type="number" hide domain={[0, "dataMax"]} />
              <YAxis type="category" dataKey="country" width={48} />
              <Bar dataKey="value">
                {countryCounts.map((entry, i) => (
                  <Cell
                    key={entry.country}
                    fill={pieColors[i % pieColors.length]}
                  />
                ))}
              </Bar>
              <RechartsTooltip />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Stats Grid (from /api/statistics) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6 md:mb-8">
        {(cards.length ? cards : []).map((stat) => (
          <div
            key={stat.name}
            className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-4 md:p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <stat.icon
                    className="h-5 w-5 md:h-6 md:w-6 text-gray-400"
                    aria-hidden="true"
                  />
                </div>
                <div className="ml-3 md:ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-xs md:text-sm font-medium text-gray-500 truncate">
                      {stat.name}
                    </dt>
                    <dd className="flex items-baseline">
                      <div className="text-lg md:text-2xl font-semibold text-gray-900">
                        {stat.value}
                      </div>
                      {stat.change && (
                        <div
                          className={`ml-1 md:ml-2 flex items-baseline text-xs md:text-sm font-semibold ${
                            stat.changeType === "increase"
                              ? "text-green-600"
                              : "text-red-600"
                          }`}>
                          {stat.change}
                        </div>
                      )}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Recent Alerts (from /api/alerts?limit=...) */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-4 md:py-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Recent Alerts
              </h3>
              <Link
                href="/alerts"
                className="text-sm font-medium text-blue-600 hover:text-blue-500">
                View all
              </Link>
            </div>
            <div className="flow-root">
              <ul className="-my-5 divide-y divide-gray-200">
                {alerts.map((alert: any) => (
                  <li key={alert.id} className="py-4">
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0">
                        <div
                          className={`h-2 w-2 rounded-full ${
                            (alert?.severity || "High") === "Critical"
                              ? "bg-red-400"
                              : (alert?.severity || "High") === "High"
                              ? "bg-orange-400"
                              : "bg-yellow-400"
                          }`}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {alert?.scenario || "Alert"}
                        </p>
                        <p className="text-sm text-gray-500 truncate">
                          {alert?.decisions?.[0]?.value || "-"}
                        </p>
                      </div>
                      <div className="flex-shrink-0 text-sm text-gray-500">
                        {new Date(
                          alert?.stop_at || alert?.start_at || now
                        ).toLocaleString()}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              {!alertsFromStats && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-gray-500">
                    Showing {alerts.length} alerts
                  </p>
                  <button
                    onClick={() => setAlertLimit((l) => l + 10)}
                    className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    Load more
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-4 md:py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Quick Actions
            </h3>
            <div className="space-y-2 md:space-y-3">
              <Link
                href="/alerts"
                className="w-full flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                View All Alerts
              </Link>
              <Link
                href="/decisions"
                className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                Manage Decisions
              </Link>
              <button className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                Export Report
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
