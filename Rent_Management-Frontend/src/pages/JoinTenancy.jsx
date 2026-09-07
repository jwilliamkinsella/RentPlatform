import { useState } from "react";
import { useNavigate } from "react-router-dom";
import PageContainer from "../components/PageContainer";
import "./JoinTenancy.css";
import { api } from "../api/client";

export default function JoinTenancy() {
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState("");
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  const token = localStorage.getItem("token");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      await api.post(
        "/tenancies/join",
        { join_code: joinCode },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setMessage({ type: "success", text: "Successfully joined tenancy!" });
      setTimeout(() => navigate("/tenant-dashboard"), 1500);
    } catch (err) {
      console.error("Error joining tenancy:", err);
      const backendMsg = err.response?.data?.message;
      setMessage({ type: "error", text: backendMsg || "Invalid code." });
    } finally {
      setLoading(false);
    }
  };
  return (
    <PageContainer title="Join Tenancy" fullWidth>
      <div className="join-tenancy-page">
        <div className="join-tenancy-header">
          <h2>Join a Tenancy</h2>
          <button
            onClick={() => navigate("/tenant-dashboard")}
            className="back-btn"
          >
            ← Back to Dashboard
          </button>
        </div>

        <div className="join-tenancy-form-container">
          {message && (
            <div className={`message ${message.type}`}>{message.text}</div>
          )}

          <form onSubmit={handleSubmit} className="join-tenancy-form">
            <label htmlFor="joinCode">Enter Invite Code</label>
            <input
              type="text"
              id="joinCode"
              name="joinCode"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}//if there are letters it ensures they are all uppercase for the code entering and submission
              required
              placeholder="Enter your code (e.g. ABC123)"
            />

            <button type="submit" disabled={loading}>
              {loading ? "Joining..." : "Join Tenancy"}
            </button>
          </form>
        </div>
      </div>
    </PageContainer>
  );
}
