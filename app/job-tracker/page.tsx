"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@apollo/client/react";
import { gql } from "@apollo/client";

// ── Types ────────────────────────────────────────────────────────────────────

type ApplicationEvent = { date: string; description: string };

type Application = {
  id: string;
  company: string;
  role: string;
  status: ApplicationStatus;
  appliedAt: string;
  jobUrl?: string;
  notes?: string;
  events: ApplicationEvent[];
};

type ApplicationStatus =
  | "APPLIED"
  | "PHONE_SCREEN"
  | "INTERVIEW"
  | "OFFER"
  | "REJECTED"
  | "WITHDRAWN";

// ── GraphQL Operations ────────────────────────────────────────────────────────

const GET_APPLICATIONS = gql`
  query GetApplications($status: ApplicationStatus) {
    applications(status: $status) {
      id
      company
      role
      status
      appliedAt
      jobUrl
      notes
      events {
        date
        description
      }
    }
  }
`;

const CREATE_APPLICATION = gql`
  mutation CreateApplication($input: CreateApplicationInput!) {
    createApplication(input: $input) {
      id
      company
      role
      status
      appliedAt
      events { date description }
    }
  }
`;

const UPDATE_STATUS = gql`
  mutation UpdateApplicationStatus($id: ID!, $status: ApplicationStatus!) {
    updateApplicationStatus(id: $id, status: $status) {
      id
      status
      events { date description }
    }
  }
`;

const ADD_EVENT = gql`
  mutation AddEvent($id: ID!, $event: ApplicationEventInput!) {
    addEvent(id: $id, event: $event) {
      id
      events { date description }
    }
  }
`;

const DELETE_APPLICATION = gql`
  mutation DeleteApplication($id: ID!) {
    deleteApplication(id: $id)
  }
`;

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  APPLIED: "Applied",
  PHONE_SCREEN: "Phone Screen",
  INTERVIEW: "Interview",
  OFFER: "Offer",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
};

const STATUS_COLORS: Record<ApplicationStatus, string> = {
  APPLIED: "bg-blue-100 text-blue-800",
  PHONE_SCREEN: "bg-yellow-100 text-yellow-800",
  INTERVIEW: "bg-purple-100 text-purple-800",
  OFFER: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  WITHDRAWN: "bg-gray-100 text-gray-600",
};

const ALL_STATUSES = Object.keys(STATUS_LABELS) as ApplicationStatus[];

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

function EventTimeline({ events }: { events: ApplicationEvent[] }) {
  return (
    <ul className="mt-3 space-y-1 border-l-2 border-gray-200 pl-3">
      {[...events].reverse().map((e, i) => (
        <li key={i} className="text-xs text-gray-500">
          <span className="font-medium text-gray-700">{e.date}</span> — {e.description}
        </li>
      ))}
    </ul>
  );
}

function ApplicationCard({
  app,
  onRefetch,
}: {
  app: Application;
  onRefetch: () => void;
}) {
  const [showEventForm, setShowEventForm] = useState(false);
  const [eventDesc, setEventDesc] = useState("");
  const [eventDate, setEventDate] = useState(new Date().toISOString().split("T")[0]);
  const [addEvent] = useMutation(ADD_EVENT);
  const [updateStatus] = useMutation(UPDATE_STATUS);
  const [deleteApp] = useMutation(DELETE_APPLICATION);

  const handleAddEvent = async () => {
    if (!eventDesc.trim()) return;
    await addEvent({ variables: { id: app.id, event: { date: eventDate, description: eventDesc.trim() } } });
    setEventDesc("");
    setEventDate(new Date().toISOString().split("T")[0]);
    setShowEventForm(false);
    onRefetch();
  };

  const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    await updateStatus({ variables: { id: app.id, status: e.target.value } });
    onRefetch();
  };

  const handleDelete = async () => {
    if (!confirm(`Delete ${app.company} — ${app.role}?`)) return;
    await deleteApp({ variables: { id: app.id } });
    onRefetch();
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold text-gray-900 text-base">{app.company}</p>
          <p className="text-sm text-gray-600">{app.role}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <StatusBadge status={app.status} />
          <button onClick={handleDelete} className="text-gray-300 hover:text-red-400 text-lg leading-none" title="Delete">×</button>
        </div>
      </div>

      <p className="text-xs text-gray-400">Applied {app.appliedAt}</p>

      {app.jobUrl && (
        <a href={app.jobUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline truncate">
          {app.jobUrl}
        </a>
      )}

      {app.notes && <p className="text-xs text-gray-500 italic">{app.notes}</p>}

      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500">Status:</label>
        <select
          value={app.status}
          onChange={handleStatusChange}
          className="text-xs border border-gray-200 rounded px-1 py-0.5 bg-white"
        >
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
      </div>

      <EventTimeline events={app.events} />

      {showEventForm ? (
        <div className="flex flex-col gap-1 mt-1">
          <div className="flex gap-2">
            <input
              type="date"
              className="text-xs border border-gray-200 rounded px-2 py-1"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
            />
            <input
              className="flex-1 text-xs border border-gray-200 rounded px-2 py-1"
              placeholder="Event description..."
              value={eventDesc}
              onChange={(e) => setEventDesc(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddEvent()}
              autoFocus
            />
          </div>
          <div className="flex gap-2">
            <button onClick={handleAddEvent} className="text-xs bg-gray-800 text-white px-2 py-1 rounded hover:bg-gray-700">Add</button>
            <button onClick={() => setShowEventForm(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowEventForm(true)}
          className="text-xs text-gray-400 hover:text-gray-700 text-left mt-1"
        >
          + Add event
        </button>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function JobTrackerPage() {
  const [activeFilter, setActiveFilter] = useState<ApplicationStatus | "ALL">("ALL");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ company: "", role: "", appliedAt: new Date().toISOString().split("T")[0], jobUrl: "", notes: "" });

  const { data, loading, error, refetch } = useQuery(GET_APPLICATIONS, {
    variables: activeFilter !== "ALL" ? { status: activeFilter } : {},
    fetchPolicy: "network-only",
  });

  const [createApplication] = useMutation(CREATE_APPLICATION);

  const handleCreate = async () => {
    if (!form.company.trim() || !form.role.trim()) return;
    await createApplication({
      variables: {
        input: {
          company: form.company.trim(),
          role: form.role.trim(),
          appliedAt: form.appliedAt || undefined,
          jobUrl: form.jobUrl.trim() || undefined,
          notes: form.notes.trim() || undefined,
        },
      },
    });
    setForm({ company: "", role: "", appliedAt: new Date().toISOString().split("T")[0], jobUrl: "", notes: "" });
    setShowForm(false);
    refetch();
  };

  const applications: Application[] = (data as { applications?: Application[] })?.applications ?? [];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Job Tracker</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {applications.length} application{applications.length !== 1 ? "s" : ""}
              {activeFilter !== "ALL" ? ` · ${STATUS_LABELS[activeFilter]}` : ""}
            </p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700"
          >
            {showForm ? "Cancel" : "+ Add Application"}
          </button>
        </div>

        {/* Add Application Form */}
        {showForm && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 shadow-sm">
            <h2 className="font-semibold text-gray-800 mb-3">New Application</h2>
            <div className="grid grid-cols-2 gap-3">
              <input
                className="border border-gray-200 rounded px-3 py-2 text-sm col-span-1"
                placeholder="Company *"
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
              />
              <input
                className="border border-gray-200 rounded px-3 py-2 text-sm col-span-1"
                placeholder="Role *"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              />
              <div className="col-span-2 flex items-center gap-2">
                <label className="text-xs text-gray-500 whitespace-nowrap">Applied on</label>
                <input
                  type="date"
                  className="border border-gray-200 rounded px-3 py-2 text-sm"
                  value={form.appliedAt}
                  onChange={(e) => setForm({ ...form, appliedAt: e.target.value })}
                />
              </div>
              <input
                className="border border-gray-200 rounded px-3 py-2 text-sm col-span-2"
                placeholder="Job posting URL"
                value={form.jobUrl}
                onChange={(e) => setForm({ ...form, jobUrl: e.target.value })}
              />
              <textarea
                className="border border-gray-200 rounded px-3 py-2 text-sm col-span-2 resize-none"
                placeholder="Notes (optional)"
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            <button
              onClick={handleCreate}
              disabled={!form.company.trim() || !form.role.trim()}
              className="mt-3 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Save
            </button>
          </div>
        )}

        {/* Status Filter Tabs */}
        <div className="flex gap-1 flex-wrap mb-6">
          {(["ALL", ...ALL_STATUSES] as (ApplicationStatus | "ALL")[]).map((s) => (
            <button
              key={s}
              onClick={() => setActiveFilter(s)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                activeFilter === s
                  ? "bg-gray-900 text-white"
                  : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {s === "ALL" ? "All" : STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        {/* Application Grid */}
        {loading && <p className="text-sm text-gray-400">Loading...</p>}
        {error && <p className="text-sm text-red-500">Error: {error.message}</p>}

        {!loading && applications.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">📋</p>
            <p className="font-medium">No applications yet</p>
            <p className="text-sm mt-1">Click "+ Add Application" to get started</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {applications.map((app) => (
            <ApplicationCard key={app.id} app={app} onRefetch={refetch} />
          ))}
        </div>
      </div>
    </div>
  );
}
