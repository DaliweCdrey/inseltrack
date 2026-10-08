import Link from "next/link";

export function Topbar({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="topbar">
      <div className="breadcrumb">
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </div>
      <div className="top-actions">
        <button className="icon-btn" aria-label="Notifications">●</button>
        <Link className="btn" href="/reports">Preview reports</Link>
        <Link className="btn dark" href="/projects/new">+ Add project</Link>
      </div>
    </header>
  );
}
