import Link from "next/link";

export default function AccountRejectedPage() {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="brand" style={{padding:0, marginBottom:20}}><div className="brandmark" /><div><strong style={{color:"#111"}}>InselTrack</strong><span>Project operations</span></div></div>
        <h1>Account request declined</h1>
        <p>Your account request was not approved. Contact an Insel administrator if you believe this was a mistake.</p>
        <Link className="btn lime" href="/sign-in">Return to sign in</Link>
      </section>
    </main>
  );
}
