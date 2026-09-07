import PageContainer from "../components/PageContainer";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./AddProperty.css";
import { api } from "../api/client"

// form states for input fields
export default function AddProperty() {
  const [address, setAddress] = useState("");
  const [eircode, setEircode] = useState("");
  const [type, setType] = useState("house");
  // message state for showing success or error messages
  const [message, setMessage] = useState(null);
// get the token that was saved from the login 
  const token = localStorage.getItem("token");
  const navigate = useNavigate();


// Handles form submission event for creating a property
const handleSubmit = async (e) => {
  e.preventDefault();
  setMessage(null);

  try {
    await api.post(
      "/properties",
      {
        address,
        eircode,
        property_type: type,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    setMessage({ type: "success", text: "Property created successfully." });
    setAddress("");
    setEircode("");
    setType("house");
  } catch (err) {
    console.error("Error creating property:", err);

    const backendMsg = err.response?.data?.message;

    setMessage({
      type: "error",
      text: backendMsg || "Error creating property.",
    });
  }
}; // ✅ IMPORTANT: closes handleSubmit

  return (
  <PageContainer title="Add Property" fullWidth>
    <div className="add-property-container">
      <header className="dashboard-header">
        <h2>Add Property</h2>
        <div className="dashboard-actions">
        <button onClick={() => navigate("/landlord-dashboard")}>Back</button>
      </div>
      </header>

      <main className="add-property-content">
        <p>Use this form to add a new property to your account.</p>

        <form onSubmit={handleSubmit} className="property-form">
          <div className="form-group">
            <label>Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Enter Address"
              required
            />
          </div>

          <div className="form-group">
            <label>Eircode</label>
            <input
              type="text"
              value={eircode}
              onChange={(e) => setEircode(e.target.value)}
              placeholder="Enter Eircode"
            />
          </div>

          <div className="form-group">
            <label>Property Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="house">House</option>
              <option value="apartment">Apartment</option>
              <option value="studio">Studio</option>
              <option value="other">Other</option>
            </select>
          </div>

          <button type="submit" className="btn-primary">Create Property</button>
        </form>

        {message && (
          <p className={message.type === "success" ? "msg-success" : "msg-error"}>
            {message.text}
          </p>
        )}
      </main>
    </div>
  </PageContainer>
);

}
