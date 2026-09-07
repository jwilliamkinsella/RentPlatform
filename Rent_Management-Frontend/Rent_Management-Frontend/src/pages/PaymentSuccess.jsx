// src/pages/PaymentSuccess.jsx
import React from "react";
import { useSearchParams, Link } from "react-router-dom";

export default function PaymentSuccess() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");

  return (
    <div>
      <h2>Payment setup complete ✅</h2>
      <p>Stripe Checkout session: {sessionId || "N/A"}</p>
      <p>Your payment will appear in your history once Stripe confirms it (webhook).</p>
      <Link to="/tenant/dashboard">Back to dashboard</Link>
    </div>
  );
}
