import { Link, NavLink } from "react-router-dom";
import "./Navbar.css";

const FEATURE_LINKS = [
  { id: "rtb-compliance", label: "Irish tenancy law & RTB" },
  { id: "per-room-tenancy", label: "Per-room tenancy" },
  { id: "rent-collection", label: "Rent collection" },
  { id: "arrears-handling", label: "Automated arrears" },
  { id: "maintenance-routing", label: "Maintenance routing" },
  { id: "notices", label: "Notices & communication" },
];

const PRICING_LINKS = [
  { id: "pricing-starter", label: "Starter", price: "€19/mo" },
  { id: "pricing-growth", label: "Growth", price: "€49/mo" },
  { id: "pricing-portfolio", label: "Portfolio", price: "€129/mo" },
  { id: "pricing-enterprise", label: "Enterprise", price: "Custom" },
];

export default function Navbar() {
  return (
    <header className="site-navbar">
      <NavLink to="/" end className="site-navbar-brand">
        RentPlatform
      </NavLink>

      <nav className="site-navbar-links">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            "site-navbar-link" + (isActive ? " site-navbar-link-active" : "")
          }
        >
          Home
        </NavLink>

        <div className="site-navbar-dropdown">
          <span className="site-navbar-link site-navbar-dropdown-trigger">
            Features <span className="site-navbar-caret">&#9662;</span>
          </span>
          <div className="site-navbar-dropdown-menu">
            {FEATURE_LINKS.map((item) => (
              <Link key={item.id} to={`/#${item.id}`}>
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="site-navbar-dropdown">
          <span className="site-navbar-link site-navbar-dropdown-trigger">
            Pricing <span className="site-navbar-caret">&#9662;</span>
          </span>
          <div className="site-navbar-dropdown-menu">
            {PRICING_LINKS.map((item) => (
              <Link key={item.id} to={`/#${item.id}`}>
                {item.label}
                <span className="site-navbar-dropdown-price">{item.price}</span>
              </Link>
            ))}
          </div>
        </div>
      </nav>

      <div className="site-navbar-actions">
        <NavLink
          to="/login"
          className={({ isActive }) =>
            "site-navbar-btn site-navbar-btn-ghost" + (isActive ? " site-navbar-btn-active" : "")
          }
        >
          Login
        </NavLink>
        <NavLink
          to="/register"
          className={({ isActive }) =>
            "site-navbar-btn site-navbar-btn-primary" + (isActive ? " site-navbar-btn-active" : "")
          }
        >
          Register
        </NavLink>
      </div>
    </header>
  );
}
