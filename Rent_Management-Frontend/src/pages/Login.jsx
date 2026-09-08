import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import PageContainer from "../components/PageContainer";
import Navbar from "../components/Navbar";
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

  return (
    <>
      <Navbar />
      <div className="login-page">
      <div className="login-content">
      <PageContainer title="Login">
          <p className="login-subtitle">
            Sign in to manage your properties and tenancies.
          </p>

          <form
            onSubmit={handleLogin}
            className="login-form"
          >
            <div className="login-field">
              <label htmlFor="login-email" className="login-label">
                Email address
              </label>
              <input
                id="login-email"
                type="email"
                placeholder="you@example.com"
                onChange={(e) => setEmail(e.target.value)}
                required
                className="login-input"
              />
            </div>

            <div className="login-field">
              <label htmlFor="login-password" className="login-label">
                Password
              </label>
              <input
                id="login-password"
                type="password"
                placeholder="Enter your password"
                onChange={(e) => setPassword(e.target.value)}
                required
                className="login-input"
              />
            </div>

            <button
              type="submit"
              className="login-submit"
            >
              Login
            </button>
          </form>

          {error && <p className="login-error">{error}</p>}

          <p className="login-register">
            Don’t have an account?{" "}
            <Link to="/register">
              Register here
            </Link>
          </p>
        </PageContainer>
      </div>
      </div>
    </>
  );
}