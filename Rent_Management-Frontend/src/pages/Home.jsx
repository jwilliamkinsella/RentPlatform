import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Navbar from "../components/Navbar";
import "./Home.css";

const DIFFERENTIATORS = [
  {
    id: "rtb-compliance",
    title: "Built for Irish tenancy law, not adapted for it",
    points: [
      "RTB registration numbers stored per property and visible to tenants — most international platforms have no concept of this",
      "Tenants can verify their tenancy is legally registered, which is unusual and genuinely valuable to them",
      "Ireland-first positioning against tools that treat RTB as a document-storage problem",
    ],
  },
  {
    id: "per-room-tenancy",
    title: "Per-room tenancy, not just per-property",
    points: [
      "Handles shared houses where each tenant has their own login, own rent obligation, own payment history",
      "Also handles whole-property lets with a single tenant, so one system covers both",
      "This is the real gap in the market — most platforms assume one tenant per unit and force landlords into workarounds for HMOs",
    ],
  },
  {
    id: "rent-collection",
    title: "Rent collection that actually settles",
    points: [
      "Stripe-based payment loop rather than passively reading bank feeds",
      "Landlord sees payment confirmed at the moment it happens, not the next business day",
      "Split rent across housemates without one tenant chasing the others",
    ],
  },
  {
    id: "arrears-handling",
    title: "Automated arrears handling",
    points: [
      "Rent reminders before the due date",
      "Late fees applied automatically per your rules, no manual chasing",
      "Removes the most uncomfortable part of being a landlord",
    ],
  },
  {
    id: "maintenance-routing",
    title: "Maintenance routing",
    points: [
      "Tenants log issues directly; no lost WhatsApp messages",
      "Requests route to the right contact email by issue type, so plumbing goes to the plumber",
      "Audit trail of what was reported and when — useful in an RTB dispute",
    ],
  },
  {
    id: "notices",
    title: "Notices and communication in one place",
    points: [
      "Formal notices sent and recorded through the platform",
      "Timestamped record of what the tenant was told, which matters legally",
    ],
  },
];

const PRICING_TIERS = [
  {
    id: "pricing-starter",
    name: "Starter",
    price: "€19",
    cap: "Up to 5 tenancies",
    cta: "Get Started",
  },
  {
    id: "pricing-growth",
    name: "Growth",
    price: "€49",
    cap: "Up to 15 tenancies",
    cta: "Get Started",
    highlighted: true,
  },
  {
    id: "pricing-portfolio",
    name: "Portfolio",
    price: "€129",
    cap: "Up to 50 tenancies",
    cta: "Get Started",
  },
  {
    id: "pricing-enterprise",
    name: "Enterprise",
    price: "Custom",
    cap: "Above 50 tenancies",
    cta: "Contact Sales",
  },
];

export default function Home() {
  const navigate = useNavigate();
  const location = useLocation();

  // Lets nav links like /#pricing land on the right section when arriving
  // from another page, not just scrolling within the home page itself.
  useEffect(() => {
    if (!location.hash) return;
    const target = document.getElementById(location.hash.slice(1));
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [location.hash]);

  return (
    <div className="home-page">
      <Navbar />

      <section className="home-hero">
        <div className="home-hero-content">
          <h1 className="home-hero-title">Property management, simplified.</h1>
          <p className="home-hero-subtitle">
            RentPlatform brings landlords and tenants together in one place —
            collect rent, track maintenance, and manage tenancies without the
            back-and-forth of spreadsheets and email chains.
          </p>

          <div className="home-hero-actions">
            <button
              className="home-btn home-btn-primary home-btn-large"
              onClick={() => navigate("/register")}
            >
              Get Started
            </button>
            <button
              className="home-btn home-btn-outline home-btn-large"
              onClick={() => navigate("/login")}
            >
              Login
            </button>
          </div>
        </div>
      </section>

      <section id="features" className="home-differentiators">
        <div className="home-container">
          <h2 className="home-section-title">Built for how Irish rentals actually work</h2>
          <p className="home-section-subtitle">
            Not a generic rent tracker with Ireland bolted on — the platform
            is built around RTB registration, shared houses, and the rules
            landlords here actually have to follow.
          </p>

          <div className="home-diff-grid">
            {DIFFERENTIATORS.map((item) => (
              <div className="home-diff-card" id={item.id} key={item.id}>
                <h3>{item.title}</h3>
                <ul>
                  {item.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="home-tenant-callout">
            <h3>Tenant-side value</h3>
            <ul>
              <li>Landlords sell this to tenants as a benefit, not an imposition</li>
              <li>
                Payment history, RTB visibility, maintenance tracking —
                reduces landlord support burden
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section id="pricing" className="home-pricing">
        <div className="home-container">
          <h2 className="home-section-title">Simple, transparent pricing</h2>
          <p className="home-section-subtitle">
            Priced by the number of tenancies you manage. Upgrade as your
            portfolio grows.
          </p>

          <div className="home-pricing-grid">
            {PRICING_TIERS.map((tier) => (
              <div
                className={
                  "home-pricing-card" +
                  (tier.highlighted ? " home-pricing-card-highlighted" : "")
                }
                id={tier.id}
                key={tier.id}
              >
                {tier.highlighted && (
                  <span className="home-pricing-badge">Most popular</span>
                )}
                <h3>{tier.name}</h3>
                <p className="home-pricing-price">
                  {tier.price}
                  {tier.price !== "Custom" && <span>/month</span>}
                </p>
                <p className="home-pricing-cap">{tier.cap}</p>
                <button
                  className={
                    "home-btn " +
                    (tier.highlighted ? "home-btn-primary" : "home-btn-outline-dark")
                  }
                  onClick={() => navigate("/register")}
                >
                  {tier.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="home-footer">
        <p>&copy; {new Date().getFullYear()} RentPlatform. All rights reserved.</p>
      </footer>
    </div>
  );
}
