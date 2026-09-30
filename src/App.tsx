import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import { Shell } from "./components";
import {
  ActionsPage,
  AuthPage,
  ConversationDetailPage,
  ConversationsPage,
  CustomerDetailPage,
  CustomersPage,
  DashboardPage,
  InvoiceDetailPage,
  InvoicesPage,
  SettingsPage,
} from "./pages";

function Protected({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return user ? <Shell>{children}</Shell> : <Navigate to="/login" replace />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
      <Route
        path="/dashboard"
        element={
          <Protected>
            <DashboardPage />
          </Protected>
        }
      />
      <Route
        path="/invoices"
        element={
          <Protected>
            <InvoicesPage />
          </Protected>
        }
      />
      <Route
        path="/invoices/:id"
        element={
          <Protected>
            <InvoiceDetailPage />
          </Protected>
        }
      />
      <Route
        path="/customers"
        element={
          <Protected>
            <CustomersPage />
          </Protected>
        }
      />
      <Route
        path="/customers/:id"
        element={
          <Protected>
            <CustomerDetailPage />
          </Protected>
        }
      />
      <Route
        path="/conversations"
        element={
          <Protected>
            <ConversationsPage />
          </Protected>
        }
      />
      <Route
        path="/conversations/:id"
        element={
          <Protected>
            <ConversationDetailPage />
          </Protected>
        }
      />
      <Route
        path="/collection-actions"
        element={
          <Protected>
            <ActionsPage />
          </Protected>
        }
      />
      <Route
        path="/settings"
        element={
          <Protected>
            <SettingsPage />
          </Protected>
        }
      />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
