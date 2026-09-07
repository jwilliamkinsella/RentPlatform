import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children }) {
  const token = localStorage.getItem("token");

  // If no token exists, redirect to login
  if (!token) {
    return <Navigate to="/" replace />;
  }

  // Otherwise, render the protected page
  return children;
}
