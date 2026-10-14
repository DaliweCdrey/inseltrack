"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignUpPage() {
  const router = useRouter();
  const [accountType, setAccountType] = useState<"staff" | "client">("staff");
  const [clients, setClients] = useState<{id:string;name:string}[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (accountType !== "client") return;
    let active = true;
    setClientsLoading(true);
    createClient().rpc("get_signup_clients").then(({ data, error: clientError }) => {
      if (!active) return;
      if (clientError) setError("Could not load the active client list.");
      else setClients((data ?? []) as {id:string;name:string}[]);
      setClientsLoading(false);
    });
    return () => { active = false; };
  }, [accountType]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const data = new FormData(e.currentTarget);
    const email = String(data.get("email"));
    const password = String(data.get("password"));
    const fullName = String(data.get("fullName"));
    const clientId = accountType === "client" ? String(data.get("client_id") ?? "") : "";
    if (accountType === "client" && !clientId) {
      setError("Select the client you represent.");
      return;
    }
    const supabase = createClient();

    const metadata = accountType === "client"
      ? { full_name: fullName, account_type: "client", client_id: clientId }
      : { full_name: fullName, account_type: "staff" };
    const { data: signupData, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata }
    });

    if (error) return setError(error.message);
    setMessage("Your account has been submitted for approval.");
    if (signupData.session) router.replace("/pending-approval");
  }

  return (
    <main className="auth-shell">
      <form className="auth-card" onSubmit={submit}>
        <div className="brand" style={{padding:0, marginBottom:20}}>
          <div className="brandmark" />
          <div><strong style={{color:"#111"}}>InselTrack</strong><span>Project operations</span></div>
        </div>
        <h1>Create account</h1>
        <p>Set up your InselTrack access.</p>
        <div className="field"><label>Full name</label><input name="fullName" required /></div>
        <div className="field"><label>Email</label><input name="email" type="email" required /></div>
        <div className="field"><label>Password</label><input name="password" type="password" minLength={8} required /></div>
        <div className="field">
          <label htmlFor="accountType">Account type</label>
          <select id="accountType" value={accountType} onChange={e => { setAccountType(e.target.value === "client" ? "client" : "staff"); setError(""); }}>
            <option value="staff">Insel Staff</option>
            <option value="client">Client</option>
          </select>
        </div>
        {accountType === "client" && <div className="field">
          <label htmlFor="client_id">Which organisation do you represent?</label>
          <select id="client_id" name="client_id" required defaultValue="" disabled={clientsLoading}>
            <option value="" disabled>{clientsLoading ? "Loading clients..." : "Select a client"}</option>
            {clients.map(client => <option value={client.id} key={client.id}>{client.name}</option>)}
          </select>
        </div>}
        {error && <p style={{color:"#B84343"}}>{error}</p>}
        {message && <p style={{color:"#4B5D0D"}}>{message}</p>}
        <button className="btn lime">Create account</button>
        <Link className="auth-link" href="/sign-in">Already have an account? Sign in</Link>
      </form>
    </main>
  );
}
