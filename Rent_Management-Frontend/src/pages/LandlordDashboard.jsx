import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import PageContainer from "../components/PageContainer";
import "./LandlordDashboard.css";
import logo from "../assets/dashboard-logo.png";
import { getStripeConnectStatus, startStripeOnboarding } from "../api/stripe";
import { api } from "../api/client";

export default function LandlordDashboard() {
  const navigate = useNavigate();

  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Stripe connect states
  const [stripeStatus, setStripeStatus] = useState(null);
  const [stripeError, setStripeError] = useState("");
  const [stripeLoading, setStripeLoading] = useState(false);

  // Logout handler
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  useEffect(() => {
    const token = localStorage.getItem("token");

    async function loadPropertiesAndStripe() {
      setLoading(true);

      try {
        // 1) Load properties
        const res = await api.get("/properties", {
          headers: { Authorization: `Bearer ${token}` },
        });

        setProperties(res.data);
        setError("");

        // 2) Load Stripe status for this landlord
        const userStr = localStorage.getItem("user");
        const user = userStr ? JSON.parse(userStr) : null;
        const landlordUserId = user?.id;

        if (!landlordUserId) {
          setStripeError("Missing user id. Please log in again.");
          return;
        }

        try {
          const status = await getStripeConnectStatus({ landlordUserId, token });
          setStripeStatus(status);
          setStripeError("");
        } catch (e) {
          setStripeError(e.message || "Failed to load Stripe status");
        }
      } catch (err) {
        console.error("Error loading properties/stripe:", err);
        const backendMsg = err.response?.data?.message;
        setError(backendMsg || "An unexpected error occurred while loading properties.");
      } finally {
        setLoading(false);
      }
    }

    loadPropertiesAndStripe();
  }, []);

  const handleDelete = async (propertyId) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this property? Deleting this property will delete all tenant and property information and cannot be undone!"
    );
    if (!confirmDelete) return;

    const token = localStorage.getItem("token");

    try {
      await api.delete(`/properties/${propertyId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setProperties((prev) => prev.filter((p) => p.property_id !== propertyId));
    } catch (err) {
      console.error("Error deleting property:", err);
      const backendMsg = err.response?.data?.message;
      alert(backendMsg || "Failed to delete property.");
    }
  };

  const handleConnectStripe = async () => {
    setStripeError("");
    setStripeLoading(true);

    try {
      const token = localStorage.getItem("token");

      const userStr = localStorage.getItem("user");
      const user = userStr ? JSON.parse(userStr) : null;
      const landlordUserId = user?.id;

      if (!landlordUserId) throw new Error("Missing user id. Please log in again.");

      const { url } = await startStripeOnboarding({ landlordUserId, token });

      // Redirect landlord to Stripe onboarding
      window.location.href = url;
    } catch (e) {
      setStripeError(e.message || "Failed to start Stripe onboarding");
      setStripeLoading(false);
    }
  };

  // ✅ Only "ready" if onboarding complete AND payouts/charges enabled
  const stripeReady =
    stripeStatus?.onboarding_status === "complete" &&
    stripeStatus?.payouts_enabled === true &&
    stripeStatus?.charges_enabled === true;

  // If account exists but not ready, we show "pending" UI
  const stripeHasAccount = !!stripeStatus?.stripe_account_id;

  return (
    <div className="dashboard-bg-wrap">
      <PageContainer title="Landlord Dashboard" fullWidth>
        <div className="dashboard-page">
          <div className="dashboard-header">
            <div className="dashboard-title">
              <img src={logo} alt="Logo" className="dashboard-logo" />
              <h2>Landlord Dashboard</h2>
            </div>

            <div className="dashboard-actions">
              {properties.length > 0 && (
                <button
                  onClick={() => navigate("/landlord/add-property")}
                  className="nav-add-btn"
                >
                  Add Property
                </button>
              )}
              <button onClick={handleLogout}>Logout</button>
            </div>
          </div>

          <div className="dashboard-content">
            <p>Welcome, Landlord! You are logged in.</p>

            {/* Payments / Stripe Connect section */}
            <div style={{ marginTop: 16 }}>
              <h3>Payments</h3>

              {stripeError && <p className="error">{stripeError}</p>}

              {stripeReady ? (
                <p>✅ Stripe connected and ready to receive rent payments.</p>
              ) : (
                <div>
                  {stripeHasAccount ? (
                    <>
                      <p>
                        Stripe setup is <strong>pending</strong>. Please complete onboarding
                        to receive payments.
                      </p>
                      <button onClick={handleConnectStripe} disabled={stripeLoading}>
                        {stripeLoading ? "Redirecting…" : "Continue Stripe Setup"}
                      </button>
                    </>
                  ) : (
                    <>
                      <p>
                        Stripe isn’t connected yet. Connect Stripe to receive rent payments.
                      </p>
                      <button onClick={handleConnectStripe} disabled={stripeLoading}>
                        {stripeLoading ? "Redirecting…" : "Connect Stripe"}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {loading && <p>Loading properties...</p>}
            {error && <p className="error">{error}</p>}

            {!loading && !error && (
              <>
                {properties.length === 0 ? (
                  <div className="empty-state">
                    <p>You have no properties yet.</p>
                    <button
                      onClick={() => navigate("/landlord/add-property")}
                      className="add-property-btn"
                    >
                      Add Property
                    </button>
                  </div>
                ) : (
                  <div>
                    <h3>Your Properties</h3>
                    <ul className="property-list">
                      {properties.map((prop) => (
                        <li key={prop.property_id} className="property-item">
                          <span>{prop.address}</span>

                          <div className="property-actions">
                            <button
                              className="manage-btn"
                              onClick={() =>
                                navigate(`/landlord/manage-property/${prop.property_id}`)
                              }
                            >
                              Manage
                            </button>

                            <button
                              className="payments-btn"
                              onClick={() =>
                                navigate(`/landlord/payments/${prop.property_id}`)
                              }
                            >
                              Payments
                            </button>

                            <button
                              className="maintenance-btn"
                              onClick={() =>
                                navigate(`/landlord/maintenance/${prop.property_id}`)
                              }
                            >
                              Maintenance
                            </button>

                            <button
                              className="edit-btn"
                              onClick={() =>
                                navigate(`/landlord/edit-property/${prop.property_id}`)
                              }
                            >
                              Edit
                            </button>

                            <button
                              className="delete-btn"
                              onClick={() => handleDelete(prop.property_id)}
                            >
                              Delete
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </PageContainer>
    </div>
  );
}