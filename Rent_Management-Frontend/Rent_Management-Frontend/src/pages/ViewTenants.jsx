import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import PageContainer from "../components/PageContainer";
import "./ViewTenants.css";
import { api } from "../api/client";


export default function ViewTenants() {
  const { id } = useParams(); // property ID is set
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchTenants() {
      setLoading(true);
      setError("");

      if (!token) {
        setError("You must be logged in.");
        setLoading(false);
        return;
      }

      try {
        const res = await api.get(`/properties/${id}/tenancy`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = res.data; // axios puts the JSON here

        if (data?.invite_codes?.length) {
          const claimed = data.invite_codes.filter((t) => t.tenant_id);
          setTenants(claimed);
        } else {
          setTenants([]);
          setError("No tenants found for this property.");
        }
      } catch (err) {
        console.error("Error fetching tenants:", err);
        const backendMsg = err.response?.data?.message || err.response?.data?.error;
        setError(backendMsg || "Error loading tenant data.");
      } finally {
        setLoading(false);
      }
    }

    fetchTenants();
  }, [id, token]);

  if (loading) return <p>Loading tenants...</p>;

  return (
    <PageContainer title="View Tenants" fullWidth>
      <div className="view-tenants-page">
        <div className="view-tenants-header">
          <h2>Tenants for Property #{id}</h2>
          <button onClick={() => navigate(`/landlord/manage-property/${id}`)}>
            ← Back to Manage Property
          </button>
        </div>

        {error && <p className="error">{error}</p>}

        {tenants.length === 0 ? (
          <p>No tenants have joined yet.</p>// if it gets to the viewtentants screen it will show no tenants have joined, if it has tenants that entered the code and joined it will show their details on a table 
        ) : (
          <table className="tenant-table">
            <thead>
              <tr>
                <th>Tenant Name</th>
                <th>Email</th>
                <th>Join Code</th>
                <th>Claimed Date</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t, i) => (
                <tr key={i}>
                  <td>{t.tenant_name || `Tenant #${t.tenant_id}`}</td>
                  <td>{t.tenant_email || "—"}</td>
                  <td>{t.join_code}</td>
                  <td>
                    {t.claimed_at
                      ? new Date(t.claimed_at).toLocaleDateString() 
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </PageContainer>
  );
}
