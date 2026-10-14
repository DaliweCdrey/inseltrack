import Link from "next/link";

export default function AccountDisabledPage() {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="brand" style={{padding:0, marginBottom:20}}><div className="brandmark" /><div><strong style={{color:"#111"}}>InselTrack</strong><span>Project operations</span></div></div>
        <h1>Account disabled</h1>
        <p>Your account is currently disabled. Contact an Insel administrator if you need access restored.</p>
        <Link className="btn lime" href="/sign-in">Return to sign in</Link>
      </section>
    </main>
  );
}
