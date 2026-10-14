"use client";

import { useState, type FormEvent } from "react";

type Recipient = { id: string; name: string; email: string; is_active: boolean };
type Props = {
  clientId: string;
  reportingEnabled: boolean;
  reportingDay: string;
  reportingTime: string;
  recipients: Recipient[];
  canManage: boolean;
  isGuest: boolean;
};

export function ClientReportingSettings(props: Props) {
  const [enabled, setEnabled] = useState(props.reportingEnabled);
  const [day, setDay] = useState(props.reportingDay);
  const [time, setTime] = useState(props.reportingTime.slice(0, 5));
  const [recipients, setRecipients] = useState(props.recipients);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [messageIsError, setMessageIsError] = useState(false);

  async function request(url: string, method: string, body?: unknown) {
    const response = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
    const responseBody = await response.text();
    let data: { success?: boolean; recipient?: Recipient; error?: string } = {};
    if (responseBody.trim()) {
      try {
        data = JSON.parse(responseBody);
      } catch {
        throw new Error(response.ok
          ? "The server returned an unreadable response. Please try again."
          : `The request failed (${response.status}). Please try again.`);
      }
    } else if (response.ok) {
      throw new Error("The server returned an empty response. Please try again.");
    }
    if (!response.ok || data.success === false) {
      throw new Error(data.error ?? `The request failed (${response.status}). Please try again.`);
    }
    return data;
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await request(`/api/clients/${props.clientId}/reporting`, "PUT", {
        reporting_enabled: enabled,
        reporting_day: day,
        reporting_time: time
      });
      setMessage("Reporting schedule saved.");
      setMessageIsError(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save reporting settings.");
      setMessageIsError(true);
    } finally {
      setBusy(false);
    }
  }

  async function saveRecipient(recipient: Recipient) {
    setBusy(true);
    setMessage("");
    try {
      const data = await request(`/api/clients/${props.clientId}/recipients`, "PATCH", recipient);
      if (!data.recipient) throw new Error("The server did not return the updated recipient.");
      setRecipients(current => current.map(item => item.id === recipient.id ? data.recipient! : item));
      setMessage("Recipient saved.");
      setMessageIsError(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save recipient.");
      setMessageIsError(true);
    } finally {
      setBusy(false);
    }
  }

  async function addRecipient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const data = await request(`/api/clients/${props.clientId}/recipients`, "POST", { name: newName, email: newEmail, is_active: true });
      if (!data.recipient) throw new Error("The server did not return the new recipient.");
      setRecipients(current => [...current, data.recipient!].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName("");
      setNewEmail("");
      setMessage("Recipient added.");
      setMessageIsError(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not add recipient.");
      setMessageIsError(true);
    } finally {
      setBusy(false);
    }
  }

  async function removeRecipient(id: string) {
    setBusy(true);
    setMessage("");
    try {
      await request(`/api/clients/${props.clientId}/recipients?recipient_id=${encodeURIComponent(id)}`, "DELETE");
      setRecipients(current => current.filter(recipient => recipient.id !== id));
      setMessage("Recipient removed.");
      setMessageIsError(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not remove recipient.");
      setMessageIsError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="client-reporting-settings">
      <h3>Reporting settings</h3>
      {props.canManage ? <form onSubmit={saveSettings} className="reporting-settings-form">
        <label className="reporting-enabled"><input type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)} /> Automatic weekly reports enabled</label>
        <div className="reporting-schedule-fields">
          <label>Reporting day<select value={day} onChange={event => setDay(event.target.value)}>{["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(value => <option key={value}>{value}</option>)}</select></label>
          <label>Reporting time (UTC)<input type="time" value={time} onChange={event => setTime(event.target.value)} required /></label>
        </div>
        <button className="btn lime" type="submit" disabled={busy}>Save schedule</button>
      </form> : <p>Automatic reporting: <strong>{enabled ? "Enabled" : "Disabled"}</strong>{enabled ? ` · ${day} at ${time} UTC` : ""}</p>}

      {!props.isGuest && <div className="recipient-management">
        <h4>Recipients</h4>
        {recipients.length ? recipients.map(recipient => <div className="recipient-editor" key={recipient.id}>
          {props.canManage ? <>
            <label>Name<input value={recipient.name} onChange={event => setRecipients(current => current.map(item => item.id === recipient.id ? { ...item, name: event.target.value } : item))} /></label>
            <label>Email<input type="email" value={recipient.email} onChange={event => setRecipients(current => current.map(item => item.id === recipient.id ? { ...item, email: event.target.value } : item))} /></label>
            <label className="recipient-active"><input type="checkbox" checked={recipient.is_active} onChange={event => setRecipients(current => current.map(item => item.id === recipient.id ? { ...item, is_active: event.target.checked } : item))} /> Active</label>
            <button className="btn" type="button" disabled={busy} onClick={() => saveRecipient(recipient)}>Save</button>
            <button className="btn" type="button" disabled={busy} onClick={() => removeRecipient(recipient.id)}>Remove</button>
          </> : <p>{recipient.name} · {recipient.email} · {recipient.is_active ? "Active" : "Disabled"}</p>}
        </div>) : <p>No recipients configured.</p>}
        {props.canManage && <form className="recipient-add" onSubmit={addRecipient}>
          <label>Name<input value={newName} onChange={event => setNewName(event.target.value)} required maxLength={160} /></label>
          <label>Email<input type="email" value={newEmail} onChange={event => setNewEmail(event.target.value)} required maxLength={320} /></label>
          <button className="btn lime" type="submit" disabled={busy}>Add recipient</button>
        </form>}
      </div>}
      {message && <p className={messageIsError ? "report-message error" : "report-message"} role="status">{message}</p>}
    </div>
  );
}