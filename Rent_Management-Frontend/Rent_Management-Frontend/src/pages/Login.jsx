import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import PageContainer from "../components/PageContainer";
import "./Login.css";
import { api } from "../api/client";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  // handles the login, will take the entry for email and password, use axios to pass from text to JSON and send it to that API route for login where it will come back with the correct redirect to the users dashboard or a fail message
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post("/auth/login", {
        email,
        password,
      });

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));
      const role = res.data.user.role;
      if (role === "tenant") navigate("/tenant-dashboard");
      else if (role === "landlord") navigate("/landlord-dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    }
  };
//Wrapped the page in the class for login page to allow me to use the generated images for the background 
  return (
    <div className="login-page"> 
      <div className="login-bg" />

      <div className="login-content">
      <PageContainer title="Login" style={{ margin: 0 }}>
          <form
            onSubmit={handleLogin}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <input
              type="email"
              placeholder="Email"
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: "90%",
                padding: "12px",
                marginBottom: "15px",
                borderRadius: "6px",
                border: "1px solid #ccc",
                fontSize: "15px",
                outlineColor: "var(--primary-color)",
              }}
            />

            <input
              type="password"
              placeholder="Password"
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: "90%",
                padding: "12px",
                marginBottom: "20px",
                borderRadius: "6px",
                border: "1px solid #f8f5f5e2",
                fontSize: "15px",
                outlineColor: "var(--primary-color)",
              }}
            />

            <button
              type="submit"
              style={{
                width: "95%",
                padding: "12px",
                backgroundColor: "#017444d5",
                color: "#ffffff",
                border: "none",
                borderRadius: "var(--border-radius)",
                cursor: "pointer",
                fontSize: "16px",
                fontWeight: "600",
                transition: "background-color 0.2s ease, transform 0.1s ease",
              }}
            >
              Login
            </button>
          </form>

          {error && (
            <p style={{ color: "red", marginTop: "10px", fontWeight: "500" }}>
              {error}
            </p>
          )}

          <p style={{ marginTop: "20px" }}>
            Don’t have an account?{" "}
            <a href="/register" style={{ color: "#5315ff" }}>
              Register here
            </a>
          </p>
        </PageContainer>
      </div>
    </div>
  );
}