import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./SplitRent.css";
import { api } from "../api/client";

//AI assistance: draft structure/logic for payments UI.
//integration with existing DB, debugging and deployed testing.
//Iteration document, see refernces, claude.


export default function SplitRent() {
  const { tenancyId } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const [loading, setLoading] = useState(true);
  const [tenancy, setTenancy] = useState(null);
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState(null);

  // Fetch tenancy + codes
  useEffect(() => {
    async function load() {
      setLoading(true);
      setMessage(null);

      try {
        const res = await api.get(`/tenancies/${tenancyId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = res.data;
        setTenancy(data);

        const initial = (data.invite_codes || []).map((c) => ({
          id: c.id,
          join_code: c.join_code,
          tenant_id: c.tenant_id,
          tenant_name: c.tenant_name,
          room_label: c.room_label || "",
          rent_share_amount:
            c.rent_share_amount === null || c.rent_share_amount === undefined
              ? ""
              : c.rent_share_amount,
        }));

        setRows(initial);
      } catch (e) {
        console.error(e);
        const backendMsg = e.response?.data?.message;
        setMessage({
          type: "error",
          text: backendMsg || "Failed to load tenancy",
        });
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [tenancyId, token]);

  const rentAmount = Number(tenancy?.rent_amount) || 0;

  const totalShare = useMemo(() => {
    return rows.reduce((sum, r) => sum + (Number(r.rent_share_amount) || 0), 0);
  }, [rows]);

  // How much is left to allocate
  const remaining = Math.round((rentAmount - totalShare) * 100) / 100;

  // Check if the total matches the rent amount (allow tiny floating point tolerance)
  const isBalanced = Math.abs(remaining) < 0.01;

  function updateRow(id, patch) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  // Auto-fill the last empty tenant with the remaining amount
  function handleAutoFill() {
    if (remaining <= 0) return;

    // Find the last row that has no amount entered
    const emptyRows = rows.filter(
      (r) => r.rent_share_amount === "" || r.rent_share_amount === 0
    );

    if (emptyRows.length === 1) {
      // Only one empty row — fill it with the remaining
      updateRow(emptyRows[0].id, { rent_share_amount: remaining });
    } else if (emptyRows.length > 1) {
      // Multiple empty rows — split remaining evenly among them
      const each = Math.floor((remaining / emptyRows.length) * 100) / 100;
      const lastExtra = Math.round((remaining - each * emptyRows.length) * 100) / 100;

      emptyRows.forEach((r, i) => {
        const amt = i === emptyRows.length - 1 ? each + lastExtra : each;
        updateRow(r.id, { rent_share_amount: amt });
      });
    }
  }

  // Split evenly among all tenants
  function handleEvenSplit() {
    if (rows.length === 0 || rentAmount === 0) return;

    const each = Math.floor((rentAmount / rows.length) * 100) / 100;
    const lastExtra = Math.round((rentAmount - each * rows.length) * 100) / 100;

    setRows((prev) =>
      prev.map((r, i) => ({
        ...r,
        rent_share_amount: i === prev.length - 1 ? each + lastExtra : each,
      }))
    );
  }

  async function handleSave() {
    setMessage(null);

    for (const r of rows) {
      if (!r.id) {
        return setMessage({
          type: "error",
          text: "Missing row id. Ensure backend returns tenancy_tenants.id.",
        });
      }

      if (r.rent_share_amount === "" || r.rent_share_amount == null) {
        return setMessage({
          type: "error",
          text: "Please enter an amount for all rooms.",
        });
      }

      const amt = Number(r.rent_share_amount);
      if (!Number.isFinite(amt) || amt < 0) {
        return setMessage({
          type: "error",
          text: "Rent share amounts must be valid numbers >= 0.",
        });
      }
    }

    // Validate total matches rent amount
    if (!isBalanced) {
      return setMessage({
        type: "error",
        text: `The total rent shares (€${totalShare.toFixed(2)}) must equal the total rent (€${rentAmount.toFixed(2)}). You have €${Math.abs(remaining).toFixed(2)} ${remaining > 0 ? "remaining to allocate" : "over the rent amount"}.`,
      });
    }

    try {
      const payload = {
        splits: rows.map((r) => ({
          id: r.id,
          room_label: r.room_label?.trim() || null,
          rent_share_amount: Number(r.rent_share_amount),
        })),
      };

      await api.put(`/tenancies/${tenancyId}/splits`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setMessage({ type: "success", text: "Room labels and rent share amounts saved." });
    } catch (e) {
      console.error(e);
      const backendMsg = e.response?.data?.message;
      setMessage({ type: "error", text: backendMsg || "Unexpected error saving changes." });
    }
  }

  if (loading) return <p>Loading...</p>;

  return (
    <div className="splitrent-page">
      <div className="splitrent-header">
        <h2>Split Rent</h2>
        <button className="back-btn" onClick={() => navigate(-1)}>
          ← Back
        </button>
      </div>

      {message && <div className={`message ${message.type}`}>{message.text}</div>}

      {tenancy && (
        <div className="splitrent-summary">
          <div className="splitrent-summary-row">
            <p>
              <strong>Total Rent:</strong> €{rentAmount.toFixed(2)}
            </p>
            <p>
              <strong>Allocated:</strong>{" "}
              <span className={isBalanced ? "amount-balanced" : totalShare > rentAmount ? "amount-over" : ""}>
                €{totalShare.toFixed(2)}
              </span>
            </p>
            <p className={`remaining-indicator ${isBalanced ? "balanced" : remaining < 0 ? "over" : "under"}`}>
              {isBalanced
                ? "✓ Fully allocated"
                : remaining > 0
                ? `€${remaining.toFixed(2)} remaining`
                : `€${Math.abs(remaining).toFixed(2)} over`}
            </p>
          </div>

          {/* Progress bar showing allocation */}
          <div className="splitrent-progress-wrap">
            <div
              className={`splitrent-progress-bar ${isBalanced ? "balanced" : totalShare > rentAmount ? "over" : ""}`}
              style={{ width: `${Math.min((totalShare / rentAmount) * 100, 100)}%` }}
            />
          </div>

          {/* Quick action buttons */}
          <div className="splitrent-quick-actions">
            <button className="quick-btn" onClick={handleEvenSplit} type="button">
              Split Evenly
            </button>
            {remaining > 0 && (
              <button className="quick-btn" onClick={handleAutoFill} type="button">
                Auto-fill Remaining
              </button>
            )}
          </div>
        </div>
      )}

      <div className="splitrent-table">
        <div className="splitrent-row splitrent-head">
          <div>Room / Label</div>
          <div>Join Code</div>
          <div>Amount (€)</div>
          <div>Status</div>
        </div>

        {rows.map((r) => (
          <div key={r.id} className="splitrent-row">
            <input
              value={r.room_label}
              placeholder="e.g. Master Bedroom"
              onChange={(e) => updateRow(r.id, { room_label: e.target.value })}
            />

            <div className="code-cell">{r.join_code}</div>

            <input
              type="number"
              min="0"
              step="0.01"
              value={r.rent_share_amount}
              onChange={(e) =>
                updateRow(r.id, { rent_share_amount: e.target.value })
              }
            />

            <div>
              {r.tenant_id
                ? `Claimed (${r.tenant_name || "Tenant"})`
                : "Unclaimed"}
            </div>
          </div>
        ))}
      </div>

      <div className="splitrent-actions">
        <button
          className={`save-btn ${!isBalanced ? "save-btn-disabled" : ""}`}
          onClick={handleSave}
          disabled={!isBalanced}
          title={!isBalanced ? "Total shares must equal total rent before saving" : ""}
        >
          Save
        </button>
      </div>
    </div>
  );
}