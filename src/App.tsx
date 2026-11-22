import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import { Shell } from "./components";
import { ActionsPage, AuthPage, ConversationDetailPage, ConversationsPage, CustomerDetailPage, CustomersPage, DashboardPage, InvoiceDetailPage, InvoicesPage, SettingsPage, AdminPage } from "./pages";
import { LandingPage } from "./LandingPage";
import { PricingPage } from "./PricingPage";
import { PlaygroundPage } from "./playground";
import { PublicPayPage } from "./PublicPayPage";
import { PrivacyPolicyPage, TermsOfServicePage } from "./LegalPages";

function Protected({ children }: { children: React.ReactNode }) { const { user } = useAuth(); return user ? <Shell>{children}</Shell> : <Navigate to="/login" replace/>; }

export function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
      <Route path="/pay/:invoiceNumber" element={<PublicPayPage />} />
      <Route path="/privacy" element={<PrivacyPolicyPage />} />
      <Route path="/terms" element={<TermsOfServicePage />} />
      <Route path="/dashboard" element={<Protected><DashboardPage /></Protected>} />
      <Route path="/invoices" element={<Protected><InvoicesPage /></Protected>} />
      <Route path="/invoices/:id" element={<Protected><InvoiceDetailPage /></Protected>} />
      <Route path="/customers" element={<Protected><CustomersPage /></Protected>} />
      <Route path="/customers/:id" element={<Protected><CustomerDetailPage /></Protected>} />
      <Route path="/conversations" element={<Protected><ConversationsPage /></Protected>} />
      <Route path="/conversations/:id" element={<Protected><ConversationDetailPage /></Protected>} />
      <Route path="/collection-actions" element={<Protected><ActionsPage /></Protected>} />
      <Route path="/settings" element={<Protected><SettingsPage /></Protected>} />
      <Route path="/admin" element={<Protected><AdminPage /></Protected>} />
      <Route path="/playground" element={<Protected><PlaygroundPage /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
