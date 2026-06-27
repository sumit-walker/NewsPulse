import { NavLink } from "react-router-dom";

export default function Navbar() {
  const linkStyle = (p) =>
    p.isActive ? "nav-link active" : "nav-link";

  return (
    <header className="navbar">
      <a href="/" className="logo">News<span>Pulse</span></a>
      <nav>
        <NavLink to="/" className={linkStyle}>Articles</NavLink>
        <NavLink to="/clusters" className={linkStyle}>Clusters</NavLink>
        <NavLink to="/timeline" className={linkStyle}>Timeline</NavLink>
      </nav>
    </header>
  );
}
