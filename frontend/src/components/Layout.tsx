import { Link, useLocation } from "react-router-dom";

type LayoutProps = {
  children: React.ReactNode;
};

const nav = [
  { to: "/", label: "Markets" },
  { to: "/create", label: "Create" },
  { to: "/portfolio", label: "Portfolio" },
];

export function Layout({ children }: LayoutProps) {
  const { pathname } = useLocation();

  return (
    <div className="app-shell">
      <header className="top-bar">
        <Link to="/" className="brand">
          Prediction Market
        </Link>
        <nav className="nav" aria-label="Main">
          {nav.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={pathname === to ? "nav-link active" : "nav-link"}
            >
              {label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="main">{children}</main>
      <footer className="footer">
        <span className="footer-hint">
          Skeleton UI — wallet & on-chain actions not wired yet.
        </span>
      </footer>
    </div>
  );
}
