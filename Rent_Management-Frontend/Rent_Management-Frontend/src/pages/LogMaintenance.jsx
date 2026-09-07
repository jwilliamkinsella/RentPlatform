import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageContainer from "../components/PageContainer";
import { api } from "../api/client";
import "./LogMaintenance.css";


 //AI assistance: used for drafting the initial LogMaintenance UI flow and request/history structure.
 //integrated with existing API endpoints, adapted to match DB fields, and tested in deployed system tests.
 //see Iteration document References (Claude).
 

const CATEGORIES = [
  "Plumbing",
  "Electrical",
  "Heating",
  "Appliance",
  "Structural",
  "Pest Control",
  "Damp / Mould",
  "Other",
];

export default function LogMaintenance() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState(null);

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load existing tickets on mount
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    const headers = { Authorization: `Bearer ${token}` };

    api
      .get("/me/maintenance", { headers })
      .then((res) => setTickets(Array.isArray(res.data) ? res.data : []))
      .catch(() => setTickets([]))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg(null);

    if (!category) {
      setMsg({ type: "error", text: "Please select a category." });
      return;
    }
    if (!description.trim()) {
      setMsg({ type: "error", text: "Please describe the issue." });
      return;
    }

    setSubmitting(true);

    try {
      const res = await api.post(
        "/me/maintenance",
        { category, description: description.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Add new ticket to list
      setTickets((prev) => [
        { ticket_id: res.data.ticket_id, category, description: description.trim(), status: "open", created_at: new Date().toISOString() },
        ...prev,
      ]);

      setCategory("");
      setDescription("");
      setMsg({ type: "success", text: "Maintenance request submitted successfully." });
    } catch (err) {
      const backendMsg = err.response?.data?.message || err.message || "Failed to submit request.";
      setMsg({ type: "error", text: backendMsg });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="maint-bg-wrap">
      <PageContainer title="" fullWidth>
        <div className="maint-header">
          <h2>Log Maintenance</h2>
          <button className="maint-back-btn" onClick={() => navigate("/tenant-dashboard")}>
            Back to Dashboard
          </button>
        </div>

        <div className="maint-body">
          <div className="maint-card">
            <h3 className="maint-card-title">Report an Issue</h3>
            <p className="maint-subtitle">
              Select a category and describe the problem. Your landlord will be notified.
            </p>

            {msg && (
              <div className={`maint-msg ${msg.type}`}>
                {msg.text}
              </div>
            )}

            <form onSubmit={handleSubmit} className="maint-form">
              <label htmlFor="category">Category</label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
              >
                <option value="" disabled>
                  Select a category...
                </option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                rows="5"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the issue in detail..."
                required
              />

              <button type="submit" className="maint-submit-btn" disabled={submitting}>
                {submitting ? "Submitting..." : "Submit Request"}
              </button>
            </form>
          </div>

          <div className="maint-card">
            <h3 className="maint-card-title">Your Maintenance Requests</h3>

            {loading ? (
              <p className="maint-loading">Loading...</p>
            ) : tickets.length === 0 ? (
              <p className="maint-empty">You have no maintenance requests yet.</p>
            ) : (
              <div className="maint-table-wrap">
                <table className="maint-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Category</th>
                      <th>Description</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.map((t, i) => (
                      <tr key={t.ticket_id || i}>
                        <td>
                          {new Date(t.created_at).toLocaleDateString("en-IE", {
                            timeZone: "Europe/Dublin",
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          })}
                        </td>
                        <td>{t.category}</td>
                        <td className="maint-desc-cell">{t.description || "—"}</td>
                        <td>
                          <span className={`maint-status ${t.status}`}>
                            {t.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </PageContainer>
    </div>
  );
}