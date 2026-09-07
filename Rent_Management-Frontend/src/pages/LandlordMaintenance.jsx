// src/pages/LandlordMaintenance.jsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import PageContainer from "../components/PageContainer";
import { api } from "../api/client";
import "./LandlordMaintenance.css";



 //AI assistance: used for drafting the initial LandlordMaintenance page structure (ticket list, inline edit form, and summary counts).
 //integrated with existing API endpoints/auth, aligned fields with the database schema, fixed issues found during testing, and validated in deployed system tests.
 //Source: see iteration docuemnt References, See claude.


const STATUS_OPTIONS = ["open", "in_progress", "resolved", "closed"];
const PRIORITY_OPTIONS = ["low", "medium", "high", "urgent"];

export default function LandlordMaintenance() {
  const { propertyId } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const [tickets, setTickets] = useState([]);
  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Track which ticket is being edited
  const [editingId, setEditingId] = useState(null);
  const [editFields, setEditFields] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);

  useEffect(() => {
    if (!token) {
      setError("You must be logged in.");
      setLoading(false);
      return;
    }

    const headers = { Authorization: `Bearer ${token}` };

    const loadData = async () => {
      try {
        const propRes = await api.get(`/properties/${propertyId}`, { headers });
        setProperty(propRes.data);

        const ticketRes = await api.get(`/properties/${propertyId}/maintenance`, { headers });
        setTickets(Array.isArray(ticketRes.data) ? ticketRes.data : []);
      } catch (e) {
        const msg = e.response?.data?.message || e.message || "Failed to load maintenance tickets";
        setError(msg);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [token, propertyId]);

  const startEdit = (ticket) => {
    setEditingId(ticket.ticket_id);
    setEditFields({
      status: ticket.status || "open",
      priority: ticket.priority || "",
      cost: ticket.cost ?? "",
      due_date: ticket.due_date ? ticket.due_date.slice(0, 10) : "",
    });
    setSaveMsg(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditFields({});
    setSaveMsg(null);
  };

  const handleSave = async (ticketId) => {
    setSaving(true);
    setSaveMsg(null);

    try {
      await api.put(
        `/maintenance/${ticketId}`,
        {
          status: editFields.status,
          priority: editFields.priority || null,
          cost: editFields.cost !== "" ? Number(editFields.cost) : null,
          due_date: editFields.due_date || null,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Update local state
      setTickets((prev) =>
        prev.map((t) =>
          t.ticket_id === ticketId
            ? {
                ...t,
                status: editFields.status,
                priority: editFields.priority || null,
                cost: editFields.cost !== "" ? Number(editFields.cost) : null,
                due_date: editFields.due_date || null,
                resolved_at: editFields.status === "resolved" ? new Date().toISOString() : t.resolved_at,
              }
            : t
        )
      );
      setEditingId(null);
      setSaveMsg({ type: "success", text: "Ticket updated." });
    } catch (e) {
      const msg = e.response?.data?.message || "Failed to update ticket.";
      setSaveMsg({ type: "error", text: msg });
    } finally {
      setSaving(false);
    }
  };

  const openCount = tickets.filter((t) => t.status === "open").length;
  const inProgressCount = tickets.filter((t) => t.status === "in_progress").length;
  const resolvedCount = tickets.filter((t) => t.status === "resolved" || t.status === "closed").length;

  return (
    <div className="lm-bg-wrap">
      <PageContainer title="" fullWidth>
        {/* Header */}
        <div className="lm-header">
          <div>
            <h2>Maintenance Requests</h2>
            {property && <span className="lm-address">{property.address}</span>}
          </div>
          <button className="lm-back-btn" onClick={() => navigate("/landlord-dashboard")}>
            Back to Dashboard
          </button>
        </div>

        <div className="lm-body">
          {loading && <p className="lm-loading">Loading tickets...</p>}
          {error && <p className="lm-error">{error}</p>}

          {saveMsg && (
            <div className={`lm-save-msg ${saveMsg.type}`}>{saveMsg.text}</div>
          )}

          {!loading && !error && (
            <>
              {/* Summary card */}
              <div className="lm-summary">
                <div>
                  <span className="lm-label">Open</span>
                  <span className="lm-value lm-open-val">{openCount}</span>
                </div>
                <div>
                  <span className="lm-label">In Progress</span>
                  <span className="lm-value lm-progress-val">{inProgressCount}</span>
                </div>
                <div>
                  <span className="lm-label">Resolved / Closed</span>
                  <span className="lm-value lm-resolved-val">{resolvedCount}</span>
                </div>
                <div>
                  <span className="lm-label">Total</span>
                  <span className="lm-value">{tickets.length}</span>
                </div>
              </div>

              {/* Tickets */}
              {tickets.length === 0 ? (
                <div className="lm-card">
                  <p className="lm-empty">No maintenance requests for this property.</p>
                </div>
              ) : (
                tickets.map((t) => (
                  <div key={t.ticket_id} className="lm-ticket-card">
                    {/* Ticket header row */}
                    <div className="lm-ticket-top">
                      <div className="lm-ticket-meta">
                        <span className={`lm-status-badge ${t.status}`}>{t.status?.replace("_", " ")}</span>
                        {t.priority && (
                          <span className={`lm-priority-badge ${t.priority}`}>{t.priority}</span>
                        )}
                        <span className="lm-ticket-date">
                          {new Date(t.created_at).toLocaleDateString("en-IE", {
                            timeZone: "Europe/Dublin",
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                      <div>
                        {editingId === t.ticket_id ? (
                          <div className="lm-edit-actions">
                            <button
                              className="lm-save-btn"
                              onClick={() => handleSave(t.ticket_id)}
                              disabled={saving}
                            >
                              {saving ? "Saving..." : "Save"}
                            </button>
                            <button className="lm-cancel-btn" onClick={cancelEdit}>
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button className="lm-edit-btn" onClick={() => startEdit(t)}>
                            Edit
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Ticket body */}
                    <div className="lm-ticket-body">
                      <div className="lm-ticket-info">
                        <span className="lm-field-label">Tenant</span>
                        <span>{t.tenant_name || "—"}</span>
                      </div>
                      <div className="lm-ticket-info">
                        <span className="lm-field-label">Category</span>
                        <span>{t.category || "—"}</span>
                      </div>
                      <div className="lm-ticket-info lm-ticket-desc">
                        <span className="lm-field-label">Description</span>
                        <span>{t.description || "—"}</span>
                      </div>
                    </div>

                    {/* Edit form (inline) */}
                    {editingId === t.ticket_id && (
                      <div className="lm-edit-form">
                        <div className="lm-edit-grid">
                          <div>
                            <label>Status</label>
                            <select
                              value={editFields.status}
                              onChange={(e) =>
                                setEditFields({ ...editFields, status: e.target.value })
                              }
                            >
                              {STATUS_OPTIONS.map((s) => (
                                <option key={s} value={s}>
                                  {s.replace("_", " ")}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label>Priority</label>
                            <select
                              value={editFields.priority}
                              onChange={(e) =>
                                setEditFields({ ...editFields, priority: e.target.value })
                              }
                            >
                              <option value="">Not set</option>
                              {PRIORITY_OPTIONS.map((p) => (
                                <option key={p} value={p}>
                                  {p}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label>Estimated Cost (€)</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={editFields.cost}
                              onChange={(e) =>
                                setEditFields({ ...editFields, cost: e.target.value })
                              }
                              placeholder="Optional"
                            />
                          </div>
                          <div>
                            <label>Due Date</label>
                            <input
                              type="date"
                              value={editFields.due_date}
                              onChange={(e) =>
                                setEditFields({ ...editFields, due_date: e.target.value })
                              }
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Footer info */}
                    {(t.cost != null || t.due_date || t.resolved_at) && editingId !== t.ticket_id && (
                      <div className="lm-ticket-footer">
                        {t.cost != null && (
                          <span>Cost: €{Number(t.cost).toFixed(2)}</span>
                        )}
                        {t.due_date && (
                          <span>
                            Due:{" "}
                            {new Date(t.due_date).toLocaleDateString("en-IE", {
                              timeZone: "Europe/Dublin",
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                            })}
                          </span>
                        )}
                        {t.resolved_at && (
                          <span>
                            Resolved:{" "}
                            {new Date(t.resolved_at).toLocaleDateString("en-IE", {
                              timeZone: "Europe/Dublin",
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                            })}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </>
          )}
        </div>
      </PageContainer>
    </div>
  );
}