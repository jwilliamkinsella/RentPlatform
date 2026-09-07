import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "./ManageProperty.css";
import { api } from "../api/client";

export default function ManageProperty() {
  const { id } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const [tenancy, setTenancy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [property, setProperty] = useState(null);

  const [form, setForm] = useState({
    rent_amount: "",
    deposit_amount: "",
    due_day: 1,
    start_day: "",
    end_day: "",
    number_of_tenants: 1,
  });
  const [message, setMessage] = useState(null);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // Fetch property and tenancy data
  // Fetch property and tenancy data
  useEffect(() => {
    async function fetchData() {
      try {
        const [tenancyRes, propertyRes] = await Promise.all([
          api.get(`/properties/${id}/tenancy`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          api.get(`/properties/${id}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        // axios puts JSON on .data
        const tenancyData = tenancyRes.data;
        const propertyData = propertyRes.data;

        if (tenancyData) setTenancy(tenancyData);
        if (propertyData) setProperty(propertyData);
      } catch (err) {
        console.error("Error loading tenancy/property:", err);
        const backendMsg = err.response?.data?.message;
        setMessage({ type: "error", text: backendMsg || "Failed to load property data." });
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [id, token]);

  // Create tenancy handler
  const handleCreateTenancy = async (e) => {
    e.preventDefault();
    setMessage(null);

    try {
      const res = await api.post(
        `/properties/${id}/tenancies`,
        form,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      // res.data is what your backend returns
      const data = res.data;

      setTenancy({ ...form, invite_codes: data.invite_codes });
      setMessage({ type: "success", text: "Tenancy created successfully!" });
    } catch (err) {
      console.error("Error creating tenancy:", err);
      const backendMsg = err.response?.data?.message;
      setMessage({ type: "error", text: backendMsg || "Error creating tenancy" });
    }
  };
  if (loading) return <p>Loading...</p>;
  
  return (
    <div className="manage-page">
      <div className="manage-header">
        <h2>Manage Property</h2>
        <div>
          <button
            onClick={() => navigate("/landlord-dashboard")}
            className="back-btn"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>

      {property && (
        <div className="property-info-bar">
          <p><strong>Address:</strong> {property.address}</p>
          <p><strong>Eircode:</strong> {property.eircode || "—"}</p>
        </div>
      )}

      <div className="manage-form-container">
        {message && <div className={`message ${message.type}`}>{message.text}</div>}

        {!tenancy ? ( //if there is no tenancy it will show create the tenancy form. I added the end date which was not previously here and changed the due date to be a drop down for first or last working day and to save
          <>
            <p>No tenancy details found for this property.</p>
            <h3>Create Tenancy</h3>
            <form onSubmit={handleCreateTenancy} className="manage-form">
              <label>Rent Amount (€)</label>
              <input name="rent_amount" type="number" required onChange={handleChange} />

              <label>Deposit Amount (€)</label>
              <input name="deposit_amount" type="number" onChange={handleChange} />

              <label>Due Day</label>
              <select name="due_day" required onChange={handleChange} value={form.due_day}>
                <option value={1}>First working day of month</option>
                <option value={31}>Last working day of month</option>
              </select>

              <label>Start Date</label>
              <input name="start_day" type="date" required onChange={handleChange} />

              <label>End Date</label>
              <input name="end_day" type="date" required onChange={handleChange} /> 


              <label>Number of Tenants</label>
              <select
                name="number_of_tenants"
                onChange={handleChange}
                value={form.number_of_tenants}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>

              <div className="form-actions">
                <button type="submit" className="create-btn">Create Tenancy</button>
              </div>
            </form>
          </>
        ) : (// otherwise it will show this 
          <>
            <h3>Current Tenancy</h3>
            <p><strong>Rent:</strong> €{tenancy.rent_amount}</p>
            <p><strong>Deposit:</strong> €{tenancy.deposit_amount}</p>
            <p><strong>Due Day:</strong> {tenancy.due_day}</p>
            <p><strong>Start Date:</strong> {tenancy.start_day}</p>
            <div className="manage-actions">
            <button
                className="edit-tenancy-btn"
                onClick={() => navigate(`/landlord/edit-tenancy/${id}`)}
            >
                Edit Tenancy
            </button>
            </div>

            <div className="invite-codes">
              <div className="invite-codes-header">
                <h4>Invite Codes</h4>

                <button
                  className="assign-splits-btn"
                  onClick={() => navigate(`/landlord/tenancies/${tenancy.tenancy_id}/splits`)}
                >
                  Set room names & split amounts
                </button>
              </div>

                <ul>
                    {tenancy.invite_codes?.map((c, i) => (//if there is a tenancy it shows the number of tenants with their codes, if its claimed it will turn green and if not it will remain the same and say not claimed
                    <li key={i}>
                        <strong>Code:</strong> {typeof c === "string" ? c : c.join_code}{"  "}
                        {c.tenant_id ? (
                        <>
                            — Claimed by <strong>{c.tenant_name  || `Tenant #${c.tenant_id }`}</strong> 
                             on {new Date (c.claimed_at ).toLocaleDateString()}
                        </>
                        ) : (
                        <em> — Not yet claimed</em>
                        )}
                    </li>
                    ))}
                </ul>
            </div>
            {tenancy.invite_codes?.some(c => c.tenant_id) && (
            <div className="view-tenants-action">
                <button
                className="view-tenants-btn"
                onClick={() => navigate(`/landlord/view-tenants/${id}`)}
                >
                View Tenants
                </button>
            </div>
            )}

          </>
        )}
      </div>
    </div>
  );
}
