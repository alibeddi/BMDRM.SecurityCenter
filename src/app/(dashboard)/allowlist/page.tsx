"use client";

import { useEffect, useState } from "react";
import {
  ShieldCheckIcon,
  TrashIcon,
  PlusIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

type AllowlistEntry = {
  ip: string;
  reason?: string;
  created_at?: string;
  updated_at?: string;
};

export default function AllowlistPage() {
  const [entries, setEntries] = useState<AllowlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newIp, setNewIp] = useState("");
  const [newReason, setNewReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deleteInProgress, setDeleteInProgress] = useState<string | null>(null);

  // Fetch allowlist entries
  const fetchAllowlist = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/allowlist", {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch allowlist: ${res.statusText}`);
      }
      const data = await res.json();
      // Handle different response formats
      const list = Array.isArray(data) ? data : data.allowlist || [];
      setEntries(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load allowlist");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllowlist();
  }, []);

  // Add new IP to allowlist
  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIp.trim()) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/allowlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ip: newIp.trim(),
          reason: newReason.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to add IP to allowlist");
      }

      // Reset form and close modal
      setNewIp("");
      setNewReason("");
      setShowAddModal(false);

      // Refresh the list
      await fetchAllowlist();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add entry");
    } finally {
      setSubmitting(false);
    }
  };

  // Delete IP from allowlist
  const handleDeleteEntry = async (ip: string) => {
    if (!confirm(`Are you sure you want to remove ${ip} from the allowlist?`)) {
      return;
    }

    setDeleteInProgress(ip);
    setError(null);
    try {
      const res = await fetch(`/api/allowlist/${encodeURIComponent(ip)}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(
          errorData.error || "Failed to remove IP from allowlist"
        );
      }

      // Refresh the list
      await fetchAllowlist();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete entry");
    } finally {
      setDeleteInProgress(null);
    }
  };

  return (
    <div className="p-4 md:p-8 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
            IP Allowlist
          </h1>
          <p className="text-base text-gray-600">
            Manage trusted IP addresses that bypass security rules
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors shadow-sm">
          <PlusIcon className="h-5 w-5 mr-2" />
          Add IP
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Allowlist Table */}
      <div className="bg-white shadow-lg rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="flex items-center">
            <ShieldCheckIcon className="h-6 w-6 text-blue-600 mr-2" />
            <h3 className="text-xl font-semibold text-gray-900">
              Allowed IP Addresses
            </h3>
            <span className="ml-3 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
              {entries.length} {entries.length === 1 ? "entry" : "entries"}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="px-6 py-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-sm text-gray-500">Loading allowlist...</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <ShieldCheckIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              No entries
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Get started by adding an IP address to the allowlist.
            </p>
            <div className="mt-6">
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors">
                <PlusIcon className="h-5 w-5 mr-2" />
                Add IP Address
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    IP Address
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Reason
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Added
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {entries.map((entry) => (
                  <tr
                    key={entry.ip}
                    className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-2 w-2 rounded-full bg-green-500 mr-3"></div>
                        <span className="text-sm font-medium text-gray-900">
                          {entry.ip}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600">
                        {entry.reason || "—"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {entry.created_at
                        ? new Date(entry.created_at).toLocaleString()
                        : "—"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleDeleteEntry(entry.ip)}
                        disabled={deleteInProgress === entry.ip}
                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                        {deleteInProgress === entry.ip ? (
                          <>
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-red-700 mr-1"></div>
                            Removing...
                          </>
                        ) : (
                          <>
                            <TrashIcon className="h-4 w-4 mr-1" />
                            Remove
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add IP Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
            <div className="px-6 py-5 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Add IP to Allowlist
                </h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-gray-400 hover:text-gray-500 transition-colors">
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
            </div>
            <form onSubmit={handleAddEntry}>
              <div className="px-6 py-4 space-y-4">
                <div>
                  <label
                    htmlFor="ip"
                    className="block text-sm font-medium text-gray-700 mb-1">
                    IP Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="ip"
                    required
                    value={newIp}
                    onChange={(e) => setNewIp(e.target.value)}
                    placeholder="e.g., 192.168.1.100"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label
                    htmlFor="reason"
                    className="block text-sm font-medium text-gray-700 mb-1">
                    Reason (optional)
                  </label>
                  <textarea
                    id="reason"
                    value={newReason}
                    onChange={(e) => setNewReason(e.target.value)}
                    placeholder="Why is this IP being allowlisted?"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                </div>
              </div>
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end space-x-3 rounded-b-xl">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !newIp.trim()}
                  className="px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                  {submitting ? "Adding..." : "Add to Allowlist"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
