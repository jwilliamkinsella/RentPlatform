import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import PageContainer from "../components/PageContainer";
import "./TenantDashboard.css";
import { api } from "../api/client";
import logo from "../assets/dashboard-logo.png";


export default function TenantDashboard() {
  const navigate = useNavigate();
  const [tenancy, setTenancy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Logout handler
  const handleLogout = () => {
    localStorage.removeItem("token"); // removes the token from the storage if the object exists this ensures the token cannot be retrived and used to login using the bearer token
    localStorage.removeItem("user"); // removes stored user object to fully clear session
    navigate("/");
  };

  // Load tenant's tenancy data
  useEffect(() => {
    const token = localStorage.getItem("token");

    async function loadTenancy() {
      setLoading(true);
      setError("");

      if (!token) {
        setError("You must be logged in.");
        setLoading(false);
        return;
      }

      try {
        const res = await api.get("/me/tenancy", {
          headers: { Authorization: `Bearer ${token}` },
        });

        setTenancy(res.data); // axios puts JSON on .data
      } catch (err) {
        console.error("Error loading tenancy:", err);
        const backendMsg = err.response?.data?.message;
        setError(backendMsg || "An unexpected error occurred while loading tenancy.");
      } finally {
        setLoading(false);
      }
    }

    loadTenancy();
  }, []);

  return ( // changed the data shown for the rent due, change to rent share amount to show what the landlord set the rent to be for that tenant 
    <div className="tenant-bg-wrap">
      <PageContainer title="Tenant Dashboard" fullWidth>
        <div className="dashboard-header">
          <div className="dashboard-title">
            <img src={logo} alt="Logo" className="dashboard-logo" />
            <h2>Tenant Dashboard</h2>
          </div>

          <div className="dashboard-actions">
            <button onClick={handleLogout}>Logout</button>
          </div>
        </div>

        <div className="dashboard-content">
          <p>Welcome, Tenant! You are logged in.</p>

          {loading && <p>Loading tenancy details...</p>}
          {error && <p className="error">{error}</p>}

          {!loading && !error && (
            <>
              {tenancy ? (
                <div className="tenancy-card">
                  <h3>Your Tenancy Details</h3>
                  <p><strong>Address:</strong> {tenancy.address}</p>
                  <p><strong>Eircode:</strong> {tenancy.eircode}</p>
                  <p>
                    <strong>Your Rent Share:</strong>{" "}
                    {tenancy.rent_share_amount != null ? `€${tenancy.rent_share_amount}` : "Not set yet"}
                  </p>
                  <p><strong>Deposit:</strong> €{tenancy.deposit_amount}</p>
                  <p><strong>Due Day:</strong> {tenancy.due_day}</p>
                  <p>
                    <strong>Start Date:</strong>{" "}
                    {new Date(tenancy.start_day).toLocaleDateString("en-IE", { // i had to use chatgpt to help me change the format of the date as the backend stores it including the timestamp which i didnt want. https://chatgpt.com/share/6973a70b-1d68-8003-8492-08803425730b
                      timeZone: "Europe/Dublin",
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                  </p>

                    {tenancy?.tenancy_tenant_id && (
                      <div className="tenant-actions" style={{ marginTop: 16 }}>
                        <button onClick={() => navigate("/tenant/payments")}>
                          Payments
                        </button>

                        <button onClick={() => navigate("/tenant/log-maintenance")}>
                          Log Maintenance
                        </button>
                      </div>
                    )}
                </div>
              ) : (
                <div className="empty-state">
                  <p>You haven't joined a tenancy yet.</p>
                  <button
                    onClick={() => navigate("/tenant/join-tenancy")}
                    className="join-tenancy-btn"
                  >
                    Join with Code
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </PageContainer>
    </div>
  );
}