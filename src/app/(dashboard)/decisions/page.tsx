/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import {
  CheckIcon,
  ClipboardDocumentListIcon,
  ClockIcon,
  EyeIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  ShieldCheckIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";

import { format } from "date-fns";

// ISO 3166-1 alpha-2 (e.g. "FR", "US") to Unicode flag
function isoToFlag(iso: string) {
  try {
    if (!iso || iso.length !== 2) return "";
    // Only accept A-Z
    const code = iso.toUpperCase();
    return String.fromCodePoint(
      ...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
    );
  } catch {
    return "";
  }
}

const statusBadge = (sim: boolean) =>
  sim
    ? "inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800"
    : "inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800";

const typeBadge = (type: string) => {
  switch (type) {
    case "ban":
      return "inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800";
    case "captcha":
      return "inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800";
    case "throttle":
      return "inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800";
    default:
      return "inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800";
  }
};

export default function DecisionsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedDecisions, setSelectedDecisions] = useState<number[]>([]);
  const [decisions, setDecisions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(10);
  const [busyIds, setBusyIds] = useState<number[]>([]);

  useEffect(() => {
    setLoading(true);
    fetch("/api/decisions")
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load decisions");
        const data = await res.json();
        if (!Array.isArray(data.decisions)) throw new Error("Invalid data");
        setDecisions(data.decisions);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load");
        setLoading(false);
      });
  }, []);

  const filteredDecisions = decisions.filter((decision) => {
    const meta = decision.metadata || {};
    const matchesSearch =
      decision.value.includes(searchTerm) ||
      (decision.scenario || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      (meta.asnOrg || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (decision.origin || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === "All" || decision.type === typeFilter;
    const status = decision.simulated ? "Simulated" : "Active";
    const matchesStatus = statusFilter === "All" || statusFilter === status;
    return matchesSearch && matchesType && matchesStatus;
  });

  const pagedDecisions = filteredDecisions.slice(0, visibleCount);
  const canLoadMore = visibleCount < filteredDecisions.length;

  const handleSelectDecision = (decisionId: number) => {
    setSelectedDecisions((prev) =>
      prev.includes(decisionId)
        ? prev.filter((id) => id !== decisionId)
        : [...prev, decisionId]
    );
  };

  const handleSelectAll = () => {
    if (selectedDecisions.length === pagedDecisions.length) {
      setSelectedDecisions([]);
    } else {
      setSelectedDecisions(pagedDecisions.map((decision) => decision.id));
    }
  };

  async function deleteOne(id: number) {
    try {
      setBusyIds((b) => [...b, id]);
      const res = await fetch(`/api/decisions/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      setDecisions((prev) => prev.filter((d) => d.id !== id));
      setSelectedDecisions((s) => s.filter((x) => x !== id));
    } catch (e) {
      console.error("Delete failed", e);
    } finally {
      setBusyIds((b) => b.filter((x) => x !== id));
    }
  }

  async function deleteSelected() {
    const ids = selectedDecisions;
    if (ids.length === 0) return;
    try {
      setBusyIds((b) => [...b, ...ids]);
      const res = await fetch(`/api/decisions/bulk-delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error(await res.text());
      setDecisions((prev) => prev.filter((d) => !ids.includes(d.id)));
      setSelectedDecisions([]);
    } catch (e) {
      console.error("Bulk delete failed", e);
    } finally {
      setBusyIds((b) => b.filter((x) => !ids.includes(x)));
    }
  }

  // Stats (unchanged)
  const bans = decisions.filter((d) => d.type === "ban").length;
  const captchas = decisions.filter((d) => d.type === "captcha").length;
  const activeDecisions = decisions.length;

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Security Decisions</h1>
        <p className="mt-2 text-gray-600">
          Manage active security decisions and enforcement actions
        </p>
      </div>

      {loading && (
        <div className="text-center text-gray-500 p-8">Loading...</div>
      )}
      {error && <div className="text-center text-red-500 p-8">{error}</div>}

      {/* Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-4 mb-8">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ShieldCheckIcon className="h-6 w-6 text-green-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Active Decisions
                  </dt>
                  <dd className="text-2xl font-semibold text-gray-900">
                    {activeDecisions}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ClipboardDocumentListIcon className="h-6 w-6 text-red-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Bans
                  </dt>
                  <dd className="text-2xl font-semibold text-gray-900">
                    {bans}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ClockIcon className="h-6 w-6 text-yellow-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Captchas
                  </dt>
                  <dd className="text-2xl font-semibold text-gray-900">
                    {captchas}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <XMarkIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Simulated
                  </dt>
                  <dd className="text-2xl font-semibold text-gray-900">
                    {decisions.filter((d) => d.simulated).length}
                  </dd>
                </dl>
              </div>
            </div>
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
                  placeholder="Search decisions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type
              </label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                <option value="All">All Types</option>
                <option value="ban">Ban</option>
                <option value="captcha">Captcha</option>
                <option value="throttle">Throttle</option>
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
                <option value="Expired">Expired</option>
                <option value="Revoked">Revoked</option>
                <option value="Pending">Pending</option>
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

      {/* Actions Bar */}
      {selectedDecisions.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-800">
              {selectedDecisions.length} decision
              {selectedDecisions.length > 1 ? "s" : ""} selected
            </span>
            <div className="flex space-x-2">
              <button
                onClick={deleteSelected}
                className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500">
                Delete selected
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Decisions Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={
                      selectedDecisions.length === pagedDecisions.length &&
                      pagedDecisions.length > 0
                    }
                    onChange={handleSelectAll}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Value
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Origin
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Scenario
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Scope
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ASN Org
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Country
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Timestamp
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {pagedDecisions.map((decision) => {
                const meta = decision.metadata || {};
                return (
                  <tr key={decision.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedDecisions.includes(decision.id)}
                        onChange={() => handleSelectDecision(decision.id)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={typeBadge(decision.type)}>
                        {decision.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {decision.value}
                      </div>
                      <div className="text-sm text-gray-500">
                        {meta.isoCode || "-"} • {meta.asnNumber || "-"}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {decision.origin}
                    </td>
                    <td
                      className="px-6 py-4 truncate max-w-[160px]"
                      title={decision.scenario || ""}>
                      {decision.scenario}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {decision.scope}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {decision.duration}
                    </td>
                    <td
                      className="px-6 py-4 truncate max-w-[160px]"
                      title={meta.asnOrg || ""}>
                      {meta.asnOrg || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        title={meta.isoCode || ""}
                        className="flex items-center">
                        <span className="mr-1 text-xl">
                          {isoToFlag(meta.isoCode || "")}
                        </span>
                        <span className="text-xs text-gray-500">
                          {meta.isoCode || "-"}
                        </span>
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {meta.timestamp
                        ? format(new Date(meta.timestamp), "MMM dd, HH:mm")
                        : "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button className="text-blue-600 hover:text-blue-900">
                          <EyeIcon className="h-4 w-4" />
                        </button>
                        <button
                          disabled={busyIds.includes(decision.id)}
                          onClick={() => deleteOne(decision.id)}
                          className="text-red-600 hover:text-red-900 disabled:opacity-50">
                          <XMarkIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* footer counter */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
          <p className="text-sm text-gray-600">
            {Math.min(visibleCount, filteredDecisions.length)} decisions
            displayed
          </p>
          {canLoadMore && (
            <button
              onClick={() => setVisibleCount((c) => c + 10)}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
              Load more
            </button>
          )}
        </div>
      </div>

      {/* Pagination component below can remain or be removed; we replaced with Load more */}
    </div>
  );
}
