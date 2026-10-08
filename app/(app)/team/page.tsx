import { Topbar } from "@/components/topbar";
export default function TeamPage(){
  const people=[["Prince","Designer"],["Kwame","Designer"],["Ama","Designer"],["Rowland","Design Lead"]];
  return <><Topbar title="Team" subtitle="Workload and assignments"/><div className="content"><div className="page-intro"><div><h1>Team</h1><p>See the people handling active work.</p></div></div><div className="card-grid">{people.map(([name,role])=><div className="panel team-card" key={name}><div className="avatar">{name[0]}</div><h3>{name}</h3><p>{role}</p></div>)}</div></div></>
}
