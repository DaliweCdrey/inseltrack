"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  ["/dashboard", "⌂", "Dashboard"],
  ["/projects", "▦", "Projects"],
  ["/clients", "◉", "Clients"],
  ["/reports", "✉", "Reports"],
  ["/team", "◎", "Team"],
  ["/activity", "↻", "Activity"]
];

export function Sidebar() {
  const pathname = usePathname();
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

      <div className="nav-label">System</div>
      <nav className="nav">
        <Link href="/settings" className={`nav-link ${pathname.startsWith("/settings") ? "active" : ""}`}>
          <span className="nav-icon">⚙</span><span>Settings</span>
        </Link>
      </nav>

      <div className="sidebar-bottom">
        <div className="sidebar-profile">
          <div className="avatar">RD</div>
          <div><strong>Rowland Daliwe</strong><span>Design Lead</span></div>
        </div>
      </div>
    </aside>
  );
}
