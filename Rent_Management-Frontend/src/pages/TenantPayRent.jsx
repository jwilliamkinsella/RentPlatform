// src/pages/TenantPayRent.jsx
import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { createRentCheckoutSession } from "../api/stripe";
import { api } from "../api/client";
import PageContainer from "../components/PageContainer";
import "./TenantPayRent.css";

//AI assistance: used for drafting due-date calculation logic and the UI logic
 //integrated with existing tenancy/payment endpoints and Stripe checkout flow, aligned with DB fields, fixed edge cases found during testing,and validated via deployed system testing.
 //see iteration document References, see claude.
 

/* ─── Due-date helpers  ─── */

function isWeekend(d) {
  const day = d.getDay();
  return day === 0 || day === 6; // Sunday or Saturday
}

// Returns the first Monday–Friday of a given month
function firstWorkingDay(year, monthIndex0) {
  const d = new Date(year, monthIndex0, 1);
  while (isWeekend(d)) d.setDate(d.getDate() + 1);
  return d;
}

// Returns the last Monday–Friday of a given month
function lastWorkingDay(year, monthIndex0) {
  const d = new Date(year, monthIndex0 + 1, 0); // last calendar day
  while (isWeekend(d)) d.setDate(d.getDate() - 1);
  return d;
}

// Compute the due date for a specific month based on dueDay rule (1 or 31)
function dueDateForMonth(year, monthIndex0, dueDay) {
  if (dueDay === 1) return firstWorkingDay(year, monthIndex0);
  if (dueDay === 31) return lastWorkingDay(year, monthIndex0);
  return null;
}

/**
 * Get the NEXT upcoming due date from today.
 * If this month's due date hasn't passed yet → return it.
 * Otherwise → return next month's due date.
 */
function getNextDueDate(dueDay) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const thisMonthDue = dueDateForMonth(today.getFullYear(), today.getMonth(), dueDay);

  if (thisMonthDue && thisMonthDue >= today) {
    return thisMonthDue;
  }

  // Move to next month
  const nextMonth = today.getMonth() + 1;
  const nextYear = nextMonth > 11 ? today.getFullYear() + 1 : today.getFullYear();
  return dueDateForMonth(nextYear, nextMonth % 12, dueDay);
}

/**
 * Given a due date, return the due date for the FOLLOWING month.
 * Used to show "Next payment due on ..." after the current month is paid.
 */
function getDueDateAfter(currentDueDate, dueDay) {
  const nextMonth = currentDueDate.getMonth() + 1;
  const nextYear = nextMonth > 11 ? currentDueDate.getFullYear() + 1 : currentDueDate.getFullYear();
  return dueDateForMonth(nextYear, nextMonth % 12, dueDay);
}

/**
 * Calculate the number of whole days between today and a future date.
 */
function daysUntil(futureDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = futureDate.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/** How many days before the due date the Pay button unlocks */
const EARLY_PAY_DAYS = 7;

/**
 * Check if a payment exists for a given billing period.
 *
 * A succeeded payment counts for a due date if:
 *  – the backend tagged it with a month_label that matches, OR
 *  – it was made in the same calendar month as the due date, OR
 *  – it was made within EARLY_PAY_DAYS before the due date
 *    (handles cross-month early payments, e.g. paying for a June 1st
 *     due date on May 26th).
 */
function isCurrentMonthPaid(payments, nextDueDate) {
  if (!payments || payments.length === 0 || !nextDueDate) return false;

  const dueMonth = nextDueDate.getMonth();
  const dueYear = nextDueDate.getFullYear();

  // Earliest date a payment could have been made for this billing period
  const windowStart = new Date(nextDueDate);
  windowStart.setDate(windowStart.getDate() - EARLY_PAY_DAYS);
  windowStart.setHours(0, 0, 0, 0);

  return payments.some((p) => {
    if (p.status !== "succeeded" && p.status !== "Succeeded") return false;

    // If backend provides a billing-period label, use it 
    if (p.month_label) {
      const [y, m] = p.month_label.split("-").map(Number);
      return y === dueYear && m === dueMonth + 1;
    }

    const pDate = new Date(p.payment_date);
    pDate.setHours(0, 0, 0, 0);

    // Same calendar month as the due date
    if (pDate.getMonth() === dueMonth && pDate.getFullYear() === dueYear) return true;

    // Within the early-pay window (handles cross-month edge case for due_day = 1)
    if (pDate >= windowStart && pDate <= nextDueDate) return true;

    return false;
  });
}

/* ─── Component ─── */

export default function TenantPayRent() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const [tenancy, setTenancy] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payLoading, setPayLoading] = useState(false);
  const [err, setErr] = useState("");
  const [payErr, setPayErr] = useState("");

  /* ── Fetch tenancy + payment history on mount ── */
  useEffect(() => {
    if (!token) {
      setErr("You must be logged in.");
      setLoading(false);
      return;
    }

    const headers = { Authorization: `Bearer ${token}` };

    const loadData = async () => {
      try {
        setErr("");

        // Tenancy info
        const tenancyRes = await api.get("/me/tenancy", { headers });
        setTenancy(tenancyRes.data);

        // Payment history
        try {
          const payRes = await api.get("/me/payments", { headers });
          setPayments(Array.isArray(payRes.data) ? payRes.data : []);
        } catch {
          // Payment history endpoint may not exist yet – non-fatal
          setPayments([]);
        }
      } catch (e) {
        const msg = e.response?.data?.message || e.message || "Failed to load payment info";
        setErr(msg);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [token]);

  /* ── Computed due-date info ── */
  const dueInfo = useMemo(() => {
    if (!tenancy?.due_day) return null;

    const dueDay = Number(tenancy.due_day);
    if (![1, 31].includes(dueDay)) return null;

    const nextDue = getNextDueDate(dueDay);
    if (!nextDue) return null;

    const days = daysUntil(nextDue);
    const monthName = nextDue.toLocaleDateString("en-IE", { month: "long" });
    const formattedDate = nextDue.toLocaleDateString("en-IE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    // Also compute the FOLLOWING month's due date (shown when current month is paid)
    const followingDue = getDueDateAfter(nextDue, dueDay);
    const followingFormatted = followingDue
      ? followingDue.toLocaleDateString("en-IE", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      : null;
    const followingMonthName = followingDue
      ? followingDue.toLocaleDateString("en-IE", { month: "long" })
      : null;

    return { nextDue, days, monthName, formattedDate, dueDay, followingFormatted, followingMonthName };
  }, [tenancy]);

  const monthPaid = useMemo(() => {
    if (!dueInfo) return false;
    return isCurrentMonthPaid(payments, dueInfo.nextDue);
  }, [payments, dueInfo]);

  // Button is only enabled when within the early-pay window AND not already paid
  const canPay = !monthPaid && dueInfo && dueInfo.days <= EARLY_PAY_DAYS;
  const daysUntilWindowOpens = dueInfo ? dueInfo.days - EARLY_PAY_DAYS : null;

  /* ── Pay handler ── */
  const onPay = async () => {
    setPayErr("");
    setPayLoading(true);
    try {
      const userStr = localStorage.getItem("user");
      const user = userStr ? JSON.parse(userStr) : null;
      const tenantUserId = user?.id;
      const tenancyTenantId = tenancy?.tenancy_tenant_id;

      if (!tenantUserId || !tenancyTenantId) {
        throw new Error("Missing tenancy details. Try refreshing.");
      }

      const { url } = await createRentCheckoutSession({
        tenancyTenantId,
        tenantUserId,
        token,
      });
      window.location.href = url;
    } catch (e) {
      setPayErr(e.message || "Something went wrong");
      setPayLoading(false);
    }
  };

  /* ── Render helpers ── */
  const dueDayLabel = tenancy?.due_day === 1 ? "1st working day" : "Last working day";
  const rentAmount = tenancy?.rent_share_amount ?? tenancy?.rent_amount;

  return (
    <div className="pay-rent-bg-wrap">
      <PageContainer title="" fullWidth>
        {/* Header bar */}
        <div className="pay-rent-header">
          <h2>Payments</h2>
          <button className="back-btn" onClick={() => navigate("/tenant-dashboard")}>
            Back to Dashboard
          </button>
        </div>

        <div className="pay-rent-body">
          {loading && <p className="loading-text">Loading payment details...</p>}
          {err && <p className="pay-rent-error">{err}</p>}

          {!loading && !err && tenancy && (
            <>
              {/* ── Payment Information Card ── */}
              <div className="pay-info-card">
                <h3 className="card-title">Payment Information</h3>

                <div className="info-grid">
                  <div>
                    <span className="info-label">Property</span>
                    <span className="info-value">{tenancy.address || "—"}</span>
                  </div>
                  <div>
                    <span className="info-label">Monthly Rent</span>
                    <span className="info-value rent-amount">
                      €{Number(rentAmount || 0).toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="info-label">Due Day</span>
                    <span className="info-value">{dueDayLabel}</span>
                  </div>
                  <div>
                    <span className="info-label">Room</span>
                    <span className="info-value">{tenancy.room_label || "Not assigned"}</span>
                  </div>
                </div>

                <hr className="card-divider" />

                {/* ── Due-date countdown banner ── */}
                {dueInfo && (
                  <div className={`due-banner ${
                    monthPaid ? "paid"
                    : dueInfo.days === 0 ? "urgent"
                    : canPay ? "open"
                    : "locked"
                  }`}>
                    {monthPaid ? (
                      <>
                        <span className="due-icon">✓</span>
                        <span>
                          <strong>{dueInfo.monthName} rent has been paid.</strong>
                          <br />
                          {dueInfo.followingMonthName} rent must be paid before {dueInfo.followingFormatted || dueInfo.formattedDate}.
                          <br />
                          <span className="due-subtext">
                            Payment for {dueInfo.followingMonthName} will open {EARLY_PAY_DAYS} days before the due date.
                          </span>
                        </span>
                      </>
                    ) : dueInfo.days === 0 ? (
                      <>
                        <span className="due-icon">⚠</span>
                        <span>
                          <strong>{dueInfo.monthName} rent is due today!</strong>
                          <br />
                          Due date: {dueInfo.formattedDate} — please pay now.
                        </span>
                      </>
                    ) : canPay ? (
                      <>
                        <span className="due-icon">📅</span>
                        <span>
                          <strong>{dueInfo.days} day{dueInfo.days !== 1 ? "s" : ""} remaining</strong> until{" "}
                          {dueInfo.monthName} rent is due.
                          <br />
                          Must be paid before {dueInfo.formattedDate}.
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="due-icon">🔒</span>
                        <span>
                          <strong>{dueInfo.monthName} rent is due on {dueInfo.formattedDate}.</strong>
                          <br />
                          Payment will open in {daysUntilWindowOpens} day{daysUntilWindowOpens !== 1 ? "s" : ""}{" "}
                          ({EARLY_PAY_DAYS} days before the due date).
                        </span>
                      </>
                    )}
                  </div>
                )}

                {/* ── Pay button ── */}
                {payErr && <p className="pay-rent-error" style={{ marginTop: 8 }}>{payErr}</p>}

                <button
                  className={`pay-btn ${monthPaid ? "disabled-paid" : !canPay ? "disabled-locked" : ""}`}
                  onClick={onPay}
                  disabled={payLoading || !canPay || !tenancy.tenancy_tenant_id}
                >
                  {payLoading
                    ? "Redirecting…"
                    : monthPaid
                    ? "Rent Paid ✓"
                    : !canPay
                    ? "Payment Not Yet Open"
                    : "Pay Rent"}
                </button>

                {canPay && (
                  <p className="stripe-note">
                    You will be redirected to Stripe to complete your payment securely.
                  </p>
                )}
              </div>

              {/* ── Payment History Card ── */}
              <div className="pay-history-card">
                <h3 className="card-title">Payment History</h3>

                {payments.length === 0 ? (
                  <p className="no-history">No payments recorded yet.</p>
                ) : (
                  <div className="history-table-wrap">
                    <table className="history-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Amount</th>
                          <th>Status</th>
                          <th>Method</th>
                          <th>Receipt</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.map((p, i) => (
                          <tr key={p.id || i}>
                            <td>
                              {new Date(p.payment_date).toLocaleDateString("en-IE", {
                                timeZone: "Europe/Dublin",
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                              })}
                            </td>
                            <td className="amount-cell">€{Number(p.amount).toFixed(2)}</td>
                            <td>
                              <span
                                className={`status-badge ${
                                  p.status === "succeeded" || p.status === "Succeeded"
                                    ? "succeeded"
                                    : "other"
                                }`}
                              >
                                {p.status}
                              </span>
                            </td>
                            <td>{p.payment_method || "card"}</td>
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