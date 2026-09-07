// src/pages/PaymentCancel.jsx
import React from "react";
import { Link } from "react-router-dom";

export default function PaymentCancel() {
  return (
    <div>
      <h2>Payment cancelled</h2>
      <p>No changes were made.</p>
      <Link to="/tenant/payments">Try again</Link>
    </div>
  );
}
