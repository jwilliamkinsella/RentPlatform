import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "./EditTenancy.css";
import { api } from "../api/client";


//https://react.dev/reference/react/useState#setstate - Used to manage the variables the setForm, setTenancy, setMessage and setLoading. It creates a variable for the data to be temporarily stored in while the user reads the screen and presses the submit to trigger the submit or warning part 
export default function EditTenancy() {
  const { id } = useParams(); 
  const navigate = useNavigate();
  const token = localStorage.getItem("token"); //gets the bearer token and saves as a variable called token

  const [tenancy, setTenancy] = useState(null); //orignal variable will be null until changed
  const [form, setForm] = useState({
    due_day: "",
    start_day: "",
    end_day: "",
  });// it will expect values for each of the entries inside setForm, they are currently set to be blank and will be filled when used
  const [message, setMessage] = useState(null);//stores user feedback messages such as errors or success notifications
  const [loading, setLoading] = useState(true);  //Tracks whether tenancy data is still being loaded

  // Fetch tenancy details
  useEffect(() => {
    async function fetchTenancy() {
      setLoading(true);
      setMessage(null);

      if (!token) {
        setMessage({ type: "error", text: "You must be logged in." });
        setLoading(false);
        return;
      }

      try {
        const res = await api.get(`/properties/${id}/tenancy`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = res.data;

        if (data) {
          setTenancy(data);
          setForm({
            due_day: data.due_day ?? "",
            start_day: data.start_day ? data.start_day.slice(0, 10) : "",
            end_day: data.end_day ? data.end_day.slice(0, 10) : "",
          });
        } else {
          setMessage({ type: "error", text: "No tenancy found for this property." });
        }
      } catch (err) {
        console.error("Error loading tenancy:", err);
        const backendMsg = err.response?.data?.message;
        setMessage({ type: "error", text: backendMsg || "Unexpected error loading tenancy" });
      } finally {
        setLoading(false);
      }
    }

    fetchTenancy();
  }, [id, token]);


  // Update tenancy
  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);

    if (!token) {
      setMessage({ type: "error", text: "You must be logged in." });
      return;
    }

    if (!tenancy?.tenancy_id) {
      setMessage({ type: "error", text: "No tenancy loaded to update." });
      return;
    }

    try {
      await api.put(
        `/tenancies/${tenancy.tenancy_id}`,
        form,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setMessage({ type: "success", text: "Tenancy updated successfully!" });
      setTimeout(() => navigate(`/landlord/manage-property/${id}`), 1500);
    } catch (err) {
      console.error("Error updating tenancy:", err);
      const backendMsg = err.response?.data?.message;
      setMessage({ type: "error", text: backendMsg || "Error updating tenancy" });
    }
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value }); // this function just ensures that form to edit will be able to collect the data, name is the name of the data and then the value so it can be updated 
  };

  if (loading) {
    return (
      <div className="edit-tenancy-page">
        <p>Loading...</p>
      </div>
    );
  }

  return ( // due date changed to be like the manage proeprty add tenacy. added in Iteration 4
    <div className="edit-tenancy-page">
      <div className="edit-header">
        <h2>Edit Tenancy</h2>
        <button className="back-btn" onClick={() => navigate(`/landlord/manage-property/${id}`)}>
          ← Back to Manage Property
        </button>
      </div>

      {message && <div className={`message ${message.type}`}>{message.text}</div>}

      {tenancy ? (
        <form onSubmit={handleSubmit} className="edit-tenancy-form">
                 

          <label>Due Day</label>
              <select name="due_day" required onChange={handleChange} value={form.due_day}>
                <option value={1}>First working day of month</option>
                <option value={31}>Last working day of month</option>
              </select>

          <label>Start Date</label>
          <input
            type="date"
            name="start_day"
            value={form.start_day}
            onChange={handleChange}
            required
          />

          <label>End Date</label>
          <input
            type="date"
            name="end_day"
            value={form.end_day}
            onChange={handleChange}
          />

          <div className="form-actions">
            <button type="submit" className="save-btn">Save Changes</button>
          </div>
        </form>
      ) : (
        <p>No tenancy found for this property.</p>
      )}
    </div>
  );
}
