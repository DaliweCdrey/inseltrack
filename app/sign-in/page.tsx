"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignInPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const data = new FormData(e.currentTarget);
    const email = String(data.get("email"));
    const password = String(data.get("password"));
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="auth-shell">
      <form className="auth-card" onSubmit={submit}>
        <div className="brand" style={{padding:0, marginBottom:20}}>
          <div className="brandmark" />
          <div><strong style={{color:"#111"}}>InselTrack</strong><span>Project operations</span></div>
        </div>
        <h1>Sign in</h1>
        <p>Access project tracking, client reports and weekly activity.</p>
        <div className="field"><label>Email</label><input name="email" type="email" required /></div>
        <div className="field"><label>Password</label><input name="password" type="password" required /></div>
        {error && <p style={{color:"#B84343"}}>{error}</p>}
        <button className="btn lime" disabled={loading}>{loading ? "Signing in..." : "Sign in"}</button>
        <Link className="auth-link" href="/sign-up">Need an account? Sign up</Link>
      </form>
    </main>
  );
}
