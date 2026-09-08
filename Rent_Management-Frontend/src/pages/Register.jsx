import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import "./Register.css";
import { api } from "../api/client";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("tenant");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const navigate = useNavigate();

  // Handles registration form submission
  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Send POST request to backend API with user details,
    // axios automatically converts the form data into JSON format
    // before inserting into the database table.
    try {
      const res = await api.post("/auth/register", {
        name,
        email,
        password,
        role,
      });

      if (res.status === 200) {
        setSuccess("Account created successfully!");
        setTimeout(() => navigate("/login"), 1500);
      }
    } catch (err) {
      setError(err.response?.data?.error || "Registration failed");
    }
  };

  // HTML to show the form to collect the data for account registration
  return (
    <>
      <Navbar />
      <div className="register-page">
        <div className="register-card">
          <h2 className="register-title">Register</h2>
          <p className="register-subtitle">
            Create an account to manage or track a tenancy.
          </p>

          <form onSubmit={handleRegister} className="register-form">
            <div className="register-field">
              <label htmlFor="register-name" className="register-label">
                Full name
              </label>
              <input
                id="register-name"
                type="text"
                placeholder="Jane Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="register-input"
              />
            </div>

            <div className="register-field">
              <label htmlFor="register-email" className="register-label">
                Email address
              </label>
              <input
                id="register-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="register-input"
              />
            </div>

            <div className="register-field">
              <label htmlFor="register-password" className="register-label">
                Password
              </label>
              <input
                id="register-password"
                type="password"
                placeholder="Create a password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="register-input"
              />
            </div>

            <div className="register-field">
              <label htmlFor="register-role" className="register-label">
                I am a
              </label>
              <select
                id="register-role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="register-select"
              >
                <option value="tenant">Tenant</option>
                <option value="landlord">Landlord</option>
              </select>
            </div>

            <button type="submit" className="register-btn">
              Register
            </button>
          </form>

          {error && <p className="register-error">{error}</p>}
          {success && <p className="register-success">{success}</p>}

          <p className="register-footer">
            Already have an account?{" "}
            <Link to="/login" className="register-link">
              Login here
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
