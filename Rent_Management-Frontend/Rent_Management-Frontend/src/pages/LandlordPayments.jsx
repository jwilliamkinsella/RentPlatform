// src/pages/LandlordPayments.jsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import PageContainer from "../components/PageContainer";
import { api } from "../api/client";
import "./LandlordPayments.css";


 //AI assistance: used for drafting the initial LandlordPayments page structure (summary totals + payment history table).
 //integrated with existing auth/API client, aligned fields with the payments table schema, fixed issues found during testing(including webhook configuration), and validated in the deployed Azure environment.
 //see iteration document References Claude.
 

export default function LandlordPayments() {
  const { propertyId } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const [payments, setPayments] = useState([]);
  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setError("You must be logged in.");
      setLoading(false);
      return;
    }

    const headers = { Authorization: `Bearer ${token}` };

    const loadData = async () => {
      try {
        // Load property info for the heading
        const propRes = await api.get(`/properties/${propertyId}`, { headers });
        setProperty(propRes.data);

        // Load payments for this property
        const payRes = await api.get(`/properties/${propertyId}/payments`, { headers });
        setPayments(Array.isArray(payRes.data) ? payRes.data : []);
      } catch (e) {
        const msg = e.response?.data?.message || e.message || "Failed to load payments";
        setError(msg);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [token, propertyId]);

  // Group payments by tenant name for easier reading
  const totalReceived = payments
    .filter((p) => p.status === "succeeded" || p.status === "Succeeded")
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  return (
    <div className="lp-bg-wrap">
      <PageContainer title="" fullWidth>
        {/* Header */}
        <div className="lp-header">
          <div>
            <h2>Tenant Payments</h2>
            {property && (
              <span className="lp-address">{property.address}</span>
            )}
          </div>
          <button className="lp-back-btn" onClick={() => navigate("/landlord-dashboard")}>
            Back to Dashboard
          </button>
        </div>

        <div className="lp-body">
          {loading && <p className="lp-loading">Loading payments...</p>}
          {error && <p className="lp-error">{error}</p>}

          {!loading && !error && (
            <>
              {/* Summary card */}
              <div className="lp-summary-card">
                <div>
                  <span className="lp-label">Total Payments</span>
                  <span className="lp-value">{payments.length}</span>
                </div>
                <div>
                  <span className="lp-label">Total Received</span>
                  <span className="lp-value lp-amount">€{totalReceived.toFixed(2)}</span>
                </div>
                <div>
                  <span className="lp-label">Successful</span>
                  <span className="lp-value">
                    {payments.filter((p) => p.status === "succeeded" || p.status === "Succeeded").length}
                  </span>
                </div>
              </div>

              {/* Payments table */}
              <div className="lp-table-card">
                <h3 className="lp-card-title">Payment History</h3>

                {payments.length === 0 ? (
                  <p className="lp-empty">No payments have been made for this property yet.</p>
                ) : (
                  <div className="lp-table-wrap">
                    <table className="lp-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Tenant</th>
                          <th>Room</th>
                          <th>Amount</th>
                          <th>Status</th>
                          <th>Method</th>
                          <th>Receipt</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.map((p, i) => (
                          <tr key={p.payment_id || i}>
                            <td>
                              {new Date(p.payment_date).toLocaleDateString("en-IE", {
                                timeZone: "Europe/Dublin",
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                              })}
                            </td>
                            <td>{p.tenant_name || "—"}</td>
                            <td>{p.room_label || "—"}</td>
                            <td className="lp-amount-cell">€{Number(p.amount).toFixed(2)}</td>
                            <td>
                              <span
                                className={`lp-status ${
                                  p.status === "succeeded" || p.status === "Succeeded"
                                    ? "lp-succeeded"
                                    : "lp-other"
                                }`}
                              >
                                {p.status}
                              </span>
                            </td>
                            <td>{p.method || "card"}</td>
                            <td>
                              {p.receipt_url ? (
                                <a href={p.receipt_url} target="_blank" rel="noopener noreferrer">
                                  View
                                </a>
                              ) : (
                                "—"
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </PageContainer>
    </div>
  );
}