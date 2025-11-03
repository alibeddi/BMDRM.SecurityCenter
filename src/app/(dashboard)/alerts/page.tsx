/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import {
  CheckIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import {
  Legend,
  Line,
  LineChart,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { useEffect, useMemo, useState } from "react";

import { format } from "date-fns";

// Helpers to map API alert meta array to useful fields
function getMetaValue(metaArr: any[] | undefined, key: string) {
  if (!Array.isArray(metaArr)) return undefined;
  return metaArr.find((m) => m?.key === key)?.value;
}

const severityColors = {
  Critical: "bg-red-100 text-red-800",
  High: "bg-orange-100 text-orange-800",
  Medium: "bg-yellow-100 text-yellow-800",
  Low: "bg-green-100 text-green-800",
};

const statusColors = {
  Active: "bg-red-100 text-red-800",
  Resolved: "bg-green-100 text-green-800",
  Investigated: "bg-blue-100 text-blue-800",
  False: "bg-gray-100 text-gray-800",
};

export default function AlertsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [severityFilter, setSeverityFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [alerts, setAlerts] = useState<any[]>([]);
  const [limit, setLimit] = useState(10);
  const [loading, setLoading] = useState(false);

  const now = useMemo(() => new Date(), []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    (async () => {
      if (!cancelled) setLoading(true);
      try {
        const r = await fetch(`/api/alerts?limit=${limit}`, {
          signal: controller.signal,
        });
        const d = await r.json();
        if (!cancelled) setAlerts(Array.isArray(d?.alerts) ? d.alerts : []);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [limit]);

  // ------- Visualizer data (top summaries) -------
  function groupCount<T extends string>(
    items: any[],
    keyFn: (a: any) => T | undefined
  ) {
    const m = new Map<T, number>();
    for (const it of items) {
      const k = keyFn(it);
      if (!k) continue;
      m.set(k, (m.get(k) || 0) + 1);
    }
    return Array.from(m, ([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }

  const topSourceIp = groupCount(
    alerts,
    (a) => a?.source?.ip || a?.source?.value || a?.decisions?.[0]?.value
  );
  const topASNs = groupCount(
    alerts,
    (a) =>
      getMetaValue(a?.events?.[0]?.meta, "ASNOrg") ||
      getMetaValue(a?.events?.[0]?.meta, "ASNNumber")
  );
  const topEngines = groupCount(alerts, (a) =>
    getMetaValue(a?.events?.[0]?.meta, "machine")
  );
  const topScenarios = groupCount(alerts, (a) => a?.scenario);

  // Build a daily series for the CURRENT month only
  function getMonthDays(year: number, month: number) {
    const last = new Date(year, month + 1, 0).getDate();
    const out: string[] = [];
    for (let d = 1; d <= last; d++) out.push(`${year}-${month + 1}-${d}`);
    return out;
  }
  function seriesByDay(items: any[]) {
    const month = now.getMonth();
    const year = now.getFullYear();
    const keyOf = (d: Date) =>
      `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    const m = new Map<string, number>();
    for (const a of items) {
      const d = new Date(a?.start_at || a?.stop_at || now);
      if (d.getMonth() !== month || d.getFullYear() !== year) continue;
      const key = keyOf(d);
      m.set(key, (m.get(key) || 0) + 1);
    }
    return getMonthDays(year, month).map((date) => ({
      date,
      value: m.get(date) || 0,
    }));
  }

  const series = seriesByDay(alerts);

  // Build multi-series (top 3) for charts like CrowdSec
  function seriesByDayForKeys(
    items: any[],
    keyFn: (a: any) => string | undefined,
    keys: string[]
  ) {
    const month = now.getMonth();
    const year = now.getFullYear();
    const dayKey = (d: Date) =>
      `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    const map = new Map<string, any>();
    for (const a of items) {
      const k = keyFn(a);
      if (!k || !keys.includes(k)) continue;
      const d = new Date(a?.start_at || a?.stop_at || now);
      if (d.getMonth() !== month || d.getFullYear() !== year) continue;
      const dk = dayKey(d);
      if (!map.has(dk)) map.set(dk, { date: dk });
      const row = map.get(dk);
      row[k] = (row[k] || 0) + 1;
    }
    // produce one row per day of current month
    return getMonthDays(year, month).map((date) => {
      const base: any = { date };
      for (const k of keys) base[k] = 0;
      const found = map.get(date);
      return found ? { ...base, ...found } : base;
    });
  }
  
  // Source IP chart data
  const sourceTopKeys = topSourceIp.map((t) => t.name).slice(0, 3) as string[];
  const sourceSeries = seriesByDayForKeys(
    alerts,
    (a) => a?.source?.ip || a?.source?.value || a?.decisions?.[0]?.value,
    sourceTopKeys
  );
  
  // ASNs chart data
  const asnTopKeys = topASNs.map((t) => t.name).slice(0, 3) as string[];
  const asnSeries = seriesByDayForKeys(
    alerts,
    (a) => getMetaValue(a?.events?.[0]?.meta, "ASNOrg") || getMetaValue(a?.events?.[0]?.meta, "ASNNumber"),
    asnTopKeys
  );
  
  // Engines chart data
  const engineTopKeys = topEngines.map((t) => t.name).slice(0, 3) as string[];
  const engineSeries = seriesByDayForKeys(
    alerts,
    (a) => getMetaValue(a?.events?.[0]?.meta, "machine"),
    engineTopKeys
  );
  
  // Scenarios chart data
  const scenarioTopKeys = topScenarios.map((t) => t.name).slice(0, 3) as string[];
  const scenarioSeries = seriesByDayForKeys(
    alerts,
    (a) => a?.scenario,
    scenarioTopKeys
  );

  const filteredAlerts = alerts.filter((alert) => {
    const matchesSearch = searchTerm === "" || JSON.stringify(alert).toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSeverity = severityFilter === "All";
    const matchesStatus = statusFilter === "All";
    return matchesSearch && matchesSeverity && matchesStatus;
  });



  return (
    <div className="p-4 md:p-6">
      {/* Visualizer */}
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
          Security Alerts
        </h1>
        <p className="mt-2 text-sm md:text-base text-gray-600">
          Monitor and manage security events and threats
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Source IP */}
        <div className="bg-white rounded-lg shadow p-4 ">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-800">Source IP</h3>
          </div>
          <div className="h-28">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={sourceSeries}
                margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <XAxis dataKey="date" />
                <YAxis />
                <RechartsTooltip />
                {sourceTopKeys.map((k, i) => (
                  <Line
                    key={k}
                    type="monotone"
                    dataKey={k}
                    name={`${i + 1}st ${k}`}
                    stroke={["#3b82f6", "#f59e0b", "#64748b"][i % 3]}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
                {/* <Legend verticalAlign="bottom" height={24} /> */}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 space-y-1">
            {topSourceIp.map((t, i) => (
              <div
                key={t.name}
                className="text-sm text-gray-700 flex items-center justify-between">
                <span>
                  {i + 1}st {t.name}
                </span>
                <span className="text-gray-400">x{t.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Source ASs */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-800">Source ASs</h3>
          </div>
          <div className="h-28">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={asnSeries}
                margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="date" />
                <YAxis />
                <RechartsTooltip />
                {asnTopKeys.map((k, i) => (
                  <Line
                    key={k}
                    type="monotone"
                    dataKey={k}
                    name={`${i + 1}st ${k}`}
                    stroke={["#8b5cf6", "#a78bfa", "#c4b5fd"][i % 3]}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 space-y-1">
            {topASNs.map((t, i) => (
              <div
                key={t.name}
                className="text-sm text-gray-700 flex items-center justify-between">
                <span>
                  {i + 1}st {t.name}
                </span>
                <span className="text-gray-400">x{t.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Targeted Security Engines */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-800">
              Targeted Security Engines
            </h3>
          </div>
          <div className="h-28">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={engineSeries}
                margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="date" />
                <YAxis />
                <RechartsTooltip />
                {engineTopKeys.map((k, i) => (
                  <Line
                    key={k}
                    type="monotone"
                    dataKey={k}
                    name={`${i + 1}st ${k || "-"}`}
                    stroke={["#10b981", "#34d399", "#6ee7b7"][i % 3]}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 space-y-1">
            {topEngines.map((t, i) => (
              <div
                key={t.name}
                className="text-sm text-gray-700 flex items-center justify-between">
                <span>
                  {i + 1}st {t.name || "-"}
                </span>
                <span className="text-gray-400">x{t.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Scenarios */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-800">Scenarios</h3>
          </div>
          <div className="h-28">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={scenarioSeries}
                margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="date" />
                <YAxis />
                <RechartsTooltip />
                {scenarioTopKeys.map((k, i) => (
                  <Line
                    key={k}
                    type="monotone"
                    dataKey={k}
                    name={`${i + 1}st ${k}`}
                    stroke={["#f59e0b", "#fbbf24", "#fcd34d"][i % 3]}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 space-y-1">
            {topScenarios.map((t, i) => (
              <div
                key={t.name}
                className="text-sm text-gray-700 flex items-center justify-between">
                <span>
                  {i + 1}st {t.name}
                </span>
                <span className="text-gray-400">x{t.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white shadow rounded-lg mb-6">
        <div className="px-4 py-5 sm:p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search
              </label>
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search alerts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Severity
              </label>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                <option value="All">All Severities</option>
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                <option value="All">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Resolved">Resolved</option>
                <option value="Investigated">Investigated</option>
                <option value="False">False Positive</option>
              </select>
            </div>

            <div className="flex items-end">
              <button className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <FunnelIcon className="h-4 w-4 mr-2" />
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts Table Section */}

      {/* Alerts Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Scenario
                </th>
                <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Source
                </th>
                <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Target
                </th>
                <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Context
                </th>
                <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  When
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAlerts.map((alert) => (
                <tr key={alert.id} className="hover:bg-gray-50">
                  {/* Scenario */}
                  <td className="px-3 md:px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <ExclamationTriangleIcon className="h-4 w-4 md:h-5 md:w-5 text-gray-400 mr-2 md:mr-3" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {alert.scenario}
                        </div>
                        <div 
                          className="text-xs md:text-sm text-gray-500 relative group"
                          title={alert.message}
                        >
                          <span className="inline-block max-w-[200px] truncate">
                            {alert.message}
                          </span>
                          <div className="absolute z-10 hidden group-hover:block bg-gray-900 text-white text-xs rounded p-2 w-64 mt-1 left-0">
                            {alert.message}
                          </div>
                        </div>
                      </div>
                    </div>
                  </td>
                  {/* Source */}
                  <td className="px-3 md:px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {alert?.source?.ip || alert?.source?.value || "-"}
                    </div>
                    <div className="text-xs md:text-sm text-gray-500">
                      {getMetaValue(alert?.events?.[0]?.meta, "ASNOrg") || 
                       getMetaValue(alert?.events?.[0]?.meta, "ASNNumber") || "-"}
                    </div>
                  </td>
                  {/* Target */}
                  <td className="px-3 md:px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {getMetaValue(alert?.meta, "security_engine_id") || "-"}
                    </div>
                    <div className="text-xs md:text-sm text-gray-500">
                      {getMetaValue(alert?.meta, "security_engine_ip") || "-"}
                    </div>
                  </td>
                  {/* Context */}
                  <td className="px-3 md:px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {getMetaValue(alert?.meta, "target_user") || "-"}
                    </div>
                    <div className="text-xs md:text-sm text-gray-500">
                      {alert?.events_count || alert?.events?.length || 0} events
                    </div>
                  </td>
                  {/* When */}
                  <td className="px-3 md:px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {format(
                        new Date(alert?.stop_at || alert?.start_at || now),
                        "MMM d, yyyy"
                      )}
                    </div>
                    <div className="text-xs md:text-sm text-gray-500">
                      {format(
                        new Date(alert?.stop_at || alert?.start_at || now),
                        "HH:mm:ss"
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Load More */}
      <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 mt-6">
        <p className="text-sm text-gray-700">
          Showing {filteredAlerts.length} of {alerts.length}
        </p>
        <button
          onClick={() => setLimit((l) => l + 10)}
          className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
          Load more
        </button>
      </div>
    </div>
  );
}
