"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AccountRole } from "@/types/database";

const staffItems: [string, string, string][] = [
  ["/dashboard", "⌂", "Dashboard"],
  ["/projects", "▦", "Projects"],
  ["/clients", "◉", "Clients"],
  ["/reports", "✉", "Reports"],
  ["/activity", "↻", "Activity"]
];

export function Sidebar({ role, fullName, email }: { role: AccountRole | null; fullName: string; email: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const items = role === "guest"
    ? staffItems.filter(([href]) => href !== "/dashboard" && href !== "/activity")
    : role === "admin"
      ? [...staffItems.slice(0, 4), ["/users", "◎", "Users & Access"], staffItems[4]]
      : staffItems;
  const initials = fullName.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "IT";

  async function signOut() {
    setSigningOut(true);
    setSignOutError("");
    try {
      const { error } = await createClient().auth.signOut();
      if (error) throw error;
    } catch {
      setSignOutError("Could not sign out. Please try again.");
      setSigningOut(false);
      return;
    }
    router.replace("/sign-in");
    router.refresh();
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brandmark" />
        <div>
          <strong>InselTrack</strong>
          <span>Project operations</span>
        </div>
      </div>

      <div className="nav-label">Workspace</div>
      <nav className="nav">
        {items.map(([href, icon, label]) => (
          <Link key={href} href={href} className={`nav-link ${pathname.startsWith(href) ? "active" : ""}`}>
            <span className="nav-icon">{icon}</span>
            <span>{label}</span>
          </Link>
        ))}
      </nav>

      {role === "admin" && <>
        <div className="nav-label">System</div>
        <nav className="nav">
          <Link href="/settings" className={`nav-link ${pathname.startsWith("/settings") ? "active" : ""}`}>
            <span className="nav-icon">⚙</span><span>Settings</span>
          </Link>
        </nav>
      </>}

      <div className="sidebar-bottom">
        <div className="sidebar-profile">
          <div className="avatar">{initials}</div>
          <div><strong>{fullName || email || "InselTrack user"}</strong><span>{fullName && email ? email : role === "admin" ? "Administrator" : role === "guest" ? "Client account" : "Insel Staff"}</span></div>
        </div>
        {signOutError && <p className="sidebar-signout-error" role="alert">{signOutError}</p>}
        <button className="nav-link sidebar-signout" type="button" onClick={signOut} disabled={signingOut}>
          <span className="nav-icon">↪</span>
          <span>{signingOut ? "Signing out..." : "Sign out"}</span>
        </button>
      </div>
    </aside>
  );
}
