"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SignUpPage() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const data = new FormData(e.currentTarget);
    const email = String(data.get("email"));
    const password = String(data.get("password"));
    const fullName = String(data.get("fullName"));
    const supabase = createClient();

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } }
    });

    if (error) return setError(error.message);
    setMessage("Account created. Check your email if confirmation is enabled.");
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
        {error && <p style={{color:"#B84343"}}>{error}</p>}
        {message && <p style={{color:"#4B5D0D"}}>{message}</p>}
        <button className="btn lime">Create account</button>
        <Link className="auth-link" href="/sign-in">Already have an account? Sign in</Link>
      </form>
    </main>
  );
}
