import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import TenantDashboard from "./pages/TenantDashboard";
import LandlordDashboard from "./pages/LandlordDashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import AddProperty from "./pages/AddProperty";
import EditProperty from "./pages/EditProperty";
import ManageProperty from "./pages/ManageProperty";
import JoinTenancy from "./pages/JoinTenancy"; 
import ViewTenants from "./pages/ViewTenants";
import EditTenancy from "./pages/EditTenancy";
import SplitRent from "./pages/SplitRent";
import TenantPayRent from "./pages/TenantPayRent";
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentCancel from "./pages/PaymentCancel";
import LogMaintenance from "./pages/LogMaintenance";
import LandlordPayments from "./pages/LandlordPayments";
import LandlordMaintenance from "./pages/LandlordMaintenance";


function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Tenant routes */}
        <Route
          path="/tenant-dashboard"
          element={
            <ProtectedRoute>
              <TenantDashboard />
            </ProtectedRoute>
          }
        />

        <Route 
        path="/tenant/log-maintenance"
        element={
          <ProtectedRoute>
            <LogMaintenance/>
          </ProtectedRoute>
        }
        />

        <Route
          path="/tenant/join-tenancy"
          element={
            <ProtectedRoute>
              <JoinTenancy />
            </ProtectedRoute>
          }
        />

        <Route
          path="/tenant/payments"
          element={
            <ProtectedRoute>
              <TenantPayRent />
            </ProtectedRoute>
          }
        />

        <Route
          path="/tenant/payments/success"
          element={
            <ProtectedRoute>
              <PaymentSuccess />
            </ProtectedRoute>
          }
        />

        <Route
          path="/tenant/payments/cancel"
          element={
            <ProtectedRoute>
              <PaymentCancel />
            </ProtectedRoute>
          }
        />

        {/* Landlord routes */}
        <Route
          path="/landlord-dashboard"
          element={
            <ProtectedRoute>
              <LandlordDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/landlord/payments/:propertyId"
          element={
            <ProtectedRoute>
              <LandlordPayments />
            </ProtectedRoute>
          }
        />

        <Route
          path="/landlord/view-tenants/:id"
          element={
            <ProtectedRoute>
              <ViewTenants />
            </ProtectedRoute>
          }
        />

        <Route
          path="/landlord/add-property"
          element={
            <ProtectedRoute>
              <AddProperty />
            </ProtectedRoute>
          }
        />

        <Route
          path="/landlord/edit-property/:id"
          element={
            <ProtectedRoute>
              <EditProperty />
            </ProtectedRoute>
          }
        />

        <Route
          path="/landlord/maintenance/:propertyId"
          element={
            <ProtectedRoute>
              <LandlordMaintenance />
            </ProtectedRoute>
          }
        />

        <Route
          path="/landlord/manage-property/:id"
          element={
            <ProtectedRoute>
              <ManageProperty />
            </ProtectedRoute>
          }
        />

        <Route
          path="/landlord/tenancies/:tenancyId/splits"
          element={
            <ProtectedRoute>
              <SplitRent />
            </ProtectedRoute>
          }
        />


        <Route
          path="/landlord/edit-tenancy/:id"
          element={
            <ProtectedRoute>
              <EditTenancy />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
