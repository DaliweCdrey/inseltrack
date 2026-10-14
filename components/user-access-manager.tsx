"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type AccessUser = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: "admin" | "user" | "guest";
  client_id: string | null;
  clients: { name: string } | null;
  approved: boolean;
  is_active: boolean;
  rejected_at: string | null;
  created_at: string;
  status: "pending" | "approved" | "rejected" | "disabled";
};

type ClientOption = { id: string; name: string };
type Action = "approve" | "reject" | "change_role" | "change_client" | "disable" | "enable" | "restore_pending" | "convert_guest_to_staff";

export function UserAccessManager({ users, clients }: { users: AccessUser[]; clients: ClientOption[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function perform(user: AccessUser, action: Action, extra: Record<string, unknown> = {}) {
    setBusyId(user.id);
    setMessage("");
    setError("");
    const response = await fetch(`/api/admin/users/${user.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra })
    });
    const result = await response.json().catch(() => ({}));
    setBusyId("");
    if (!response.ok) {
      setError(result.error ?? "Could not update account.");
      return;
    }
    setMessage("Account updated.");
    router.refresh();
  }

  return (
    <>
      {(message || error) && <p className={error ? "access-message error" : "access-message"}>{error || message}</p>}
      <section className="panel table-wrap user-access-table">
        <div className="table-heading"><div><h3>Accounts</h3><p>{users.length} accounts</p></div></div>
        <table>
          <thead><tr><th>User</th><th>Account type</th><th>Role</th><th>Client</th><th>Status</th><th>Created</th><th>Admin actions</th></tr></thead>
          <tbody>
            {users.map(user => <tr key={user.id}>
              <td><strong>{user.full_name || "—"}</strong><span className="sub">{user.email || "—"}</span></td>
              <td>{user.role === "guest" ? "Client" : "Insel Staff"}</td>
              <td>{user.role}</td>
              <td>{user.role === "guest" ? (user.clients?.name ?? "Unassigned") : "Internal"}</td>
              <td><span className={`badge ${user.status === "approved" ? "b-complete" : user.status === "disabled" || user.status === "rejected" ? "b-hold" : "b-feedback"}`}>{user.status}</span></td>
              <td>{new Date(user.created_at).toLocaleDateString()}</td>
              <td><Actions user={user} clients={clients} busy={busyId === user.id} perform={perform} /></td>
            </tr>)}
          </tbody>
        </table>
      </section>
    </>
  );
}

function Actions({ user, clients, busy, perform }: {
  user: AccessUser;
  clients: ClientOption[];
  busy: boolean;
  perform: (user: AccessUser, action: Action, extra?: Record<string, unknown>) => Promise<void>;
}) {
  const [promote, setPromote] = useState(false);
  const [selectedClient, setSelectedClient] = useState(user.client_id ?? "");
  const [selectedRole, setSelectedRole] = useState<"user" | "admin">(user.role === "admin" ? "admin" : "user");

  if (user.status === "pending") return <div className="user-actions">
    {user.role === "guest" && <select aria-label={`Assign client to ${user.email}`} value={selectedClient} onChange={event => setSelectedClient(event.target.value)}>
      <option value="">Select client</option>{clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
    </select>}
    {user.role === "user" && <label className="promote-option"><input type="checkbox" checked={promote} onChange={event => setPromote(event.target.checked)} /> Promote to Admin</label>}
    <button className="btn lime" disabled={busy || (user.role === "guest" && !selectedClient)} onClick={() => perform(user, "approve", { promote_to_admin: promote, ...(user.role === "guest" ? { client_id: selectedClient } : {}) })}>Approve</button>
    {user.role === "guest" && selectedClient !== user.client_id && <button className="btn" disabled={busy || !selectedClient} onClick={() => perform(user, "change_client", { client_id: selectedClient })}>Save client</button>}
    <button className="btn" disabled={busy} onClick={() => perform(user, "reject")}>Reject</button>
  </div>;

  if (user.status === "rejected") return <div className="user-actions"><button className="btn" disabled={busy} onClick={() => perform(user, "restore_pending")}>Restore to pending</button></div>;

  if (user.status === "disabled") return <div className="user-actions"><button className="btn lime" disabled={busy} onClick={() => perform(user, "enable")}>Enable account</button></div>;

  return <div className="user-actions">
    {user.role === "guest" ? <>
      <select aria-label={`Change client for ${user.email}`} value={selectedClient} onChange={event => setSelectedClient(event.target.value)}>
        {clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
      </select>
      {selectedClient !== user.client_id && <button className="btn" disabled={busy} onClick={() => perform(user, "change_client", { client_id: selectedClient })}>Save client</button>}
      <button className="btn" disabled={busy} onClick={() => perform(user, "convert_guest_to_staff")}>Convert to Staff</button>
    </> : <>
      <select aria-label={`Role for ${user.email}`} value={selectedRole} onChange={event => setSelectedRole(event.target.value === "admin" ? "admin" : "user")}>
        <option value="user">User</option><option value="admin">Admin</option>
      </select>
      {selectedRole !== user.role && <button className="btn" disabled={busy} onClick={() => perform(user, "change_role", { role: selectedRole })}>Save role</button>}
    </>}
    <button className="btn" disabled={busy} onClick={() => perform(user, "disable")}>Disable</button>
  </div>;
}
