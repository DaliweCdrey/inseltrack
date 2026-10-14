import Link from "next/link";

export default function PendingApprovalPage() {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="brand" style={{padding:0, marginBottom:20}}>
          <div className="brandmark" />
          <div><strong style={{color:"#111"}}>InselTrack</strong><span>Project operations</span></div>
        </div>
        <h1>Pending approval</h1>
        <p>Your account has been submitted for approval.</p>
        <p>An Insel administrator will review your request before access is enabled.</p>
        <Link className="btn lime" href="/sign-in">Return to sign in</Link>
      </section>
    </main>
  );
}
