import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
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
        setTimeout(() => navigate("/"), 1500);
      }
    } catch (err) {
      setError(err.response?.data?.error || "Registration failed");
    }
  };

  // HTML to show the form to collect the data for account registration
  return (
    <div className="register-page">
      <div className="register-card">
        <h2 className="register-title">Register</h2>

        <form onSubmit={handleRegister}>
          <input
            type="text"
            placeholder="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="tenant">Tenant</option>
            <option value="landlord">Landlord</option>
          </select>

          <button type="submit" className="register-btn">
            Register
          </button>
        </form>

        {error && <p className="register-error">{error}</p>}
        {success && <p className="register-success">{success}</p>}

        <p className="register-footer">
          Already have an account?{" "}
          <Link to="/" className="register-link">
            Login here
          </Link>
        </p>
      </div>
    </div>
  );
}
