import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import PageContainer from "../components/PageContainer";
import "./EditProperty.css";
import { api } from "../api/client";

export default function EditProperty() {
  const { id } = useParams(); // get property id from URL
  const navigate = useNavigate();

  const [address, setAddress] = useState("");
  const [eircode, setEircode] = useState("");
  const [type, setType] = useState("house");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  const token = localStorage.getItem("token");

  // Load property details when the page opens
  useEffect(() => {
    async function fetchProperty() {
      setLoading(true);

      if (!token) {
        setMessage({ type: "error", text: "You must be logged in." });
        setLoading(false);
        return;
      }

      try {
        const res = await api.get(`/properties/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = res.data;

        setAddress(data.address || "");
        setEircode(data.eircode || "");
        setType(data.property_type || "house");
        setLoading(false);

      } catch (err) {
        console.error("Error fetching property:", err);
        const backendMsg = err.response?.data?.message;

        setMessage({ type: "error", text: backendMsg || "Property not found." });
        setLoading(false);
      }
    }

    fetchProperty();
  }, [id, token]);

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);

    if (!token) {
      setMessage({ type: "error", text: "You must be logged in." });
      return;
    }

    try {
      await api.put(
        `/properties/${id}`,
        { address, eircode, property_type: type },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setMessage({ type: "success", text: "Property updated successfully." });
      setTimeout(() => navigate("/landlord-dashboard"), 1000);

    } catch (err) {
      console.error("Error updating property:", err);
      const backendMsg = err.response?.data?.message;

      setMessage({ type: "error", text: backendMsg || "Failed to update property." });
    }
  };
  
  if (loading) {
    return (
      <PageContainer title="Edit Property">
        <p>Loading...</p>
      </PageContainer>
    );
  }
  return (
    <PageContainer title="Edit Property">
      {message && (
        <p
          style={{
            color: message.type === "success" ? "green" : "red",
            marginBottom: "1rem",
          }}
        >
          {message.text}
        </p>
      )}

      <form onSubmit={handleSubmit} className="edit-property-form">
        <label>Address</label>
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          required
        />

        <label>Eircode</label>
        <input
          type="text"
          value={eircode}
          onChange={(e) => setEircode(e.target.value)}
        />

        <label>Property Type</label>
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="house">House</option>
          <option value="apartment">Apartment</option>
          <option value="studio">Studio</option>
          <option value="other">Other</option>
        </select>

        <div className="form-actions">
          <button type="submit" className="save-btn">Save Changes</button>
          <button
            type="button"
            className="cancel-btn"
            onClick={() => navigate("/landlord-dashboard")}
          >
            Cancel
          </button>
        </div>
      </form>
    </PageContainer>
  );
}
