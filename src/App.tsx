import { Suspense, lazy, useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { trackPageView } from "./analytics";
import { LandingPage } from "./LandingPage";

// Only the landing page is in the first download. Everything else loads when its route is opened.
const named = <T extends Record<string, React.ComponentType<any>>>(load: () => Promise<T>, key: keyof T) =>
  lazy(async () => ({ default: (await load())[key] }));

const WhatsNewPage = named(() => import("./WhatsNewPage"), "WhatsNewPage");
const PricingPage = named(() => import("./PricingPage"), "PricingPage");
const AuthPage = named(() => import("./pages/AuthPage"), "AuthPage");
const PublicPayPage = named(() => import("./PublicPayPage"), "PublicPayPage");
const ClientPortalPage = named(() => import("./ClientPortalPage"), "ClientPortalPage");
const PrivacyPolicyPage = named(() => import("./LegalPages"), "PrivacyPolicyPage");
const TermsOfServicePage = named(() => import("./LegalPages"), "TermsOfServicePage");
const PlaygroundPage = named(() => import("./playground"), "PlaygroundPage");
const DashboardPage = named(() => import("./pages/DashboardPage"), "DashboardPage");
const InvoicesPage = named(() => import("./pages/InvoicesPage"), "InvoicesPage");
const InvoiceDetailPage = named(() => import("./pages/InvoiceDetailPage"), "InvoiceDetailPage");
const CustomersPage = named(() => import("./pages/CustomersPage"), "CustomersPage");
const CustomerDetailPage = named(() => import("./pages/CustomerDetailPage"), "CustomerDetailPage");
const ConversationsPage = named(() => import("./pages/ConversationsPage"), "ConversationsPage");
const ConversationDetailPage = named(() => import("./pages/ConversationDetailPage"), "ConversationDetailPage");
const ActionsPage = named(() => import("./pages/ActionsPage"), "ActionsPage");
const SettingsPage = named(() => import("./pages/SettingsPage"), "SettingsPage");
const AnalyticsPage = named(() => import("./pages/AnalyticsPage"), "AnalyticsPage");
const AdminPage = named(() => import("./pages/AdminPage"), "AdminPage");
const AdminGrowthPage = named(() => import("./pages/AdminGrowthPage"), "AdminGrowthPage");
const ProtectedRoute = lazy(() => import("./ProtectedRoute"));

function Protected({ children }: { children: React.ReactNode }) { return <ProtectedRoute>{children}</ProtectedRoute>; }

function PageFallback() {
  return <div role="status" aria-label="Loading" style={{ minHeight: "100vh", background: "#070a13", display: "grid", placeItems: "center", color: "#64748b", fontFamily: "system-ui, sans-serif", fontSize: 14 }}>Loading…</div>;
}

function RouteTracker() {
  const { pathname } = useLocation();
  useEffect(() => trackPageView(pathname), [pathname]);
  return null;
}

export function App() {
  return (
    <>
    <RouteTracker />
    <Suspense fallback={<PageFallback />}>
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/whats-new" element={<WhatsNewPage />} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
      <Route path="/pay/:invoiceNumber" element={<PublicPayPage />} />
      <Route path="/client/:customerId/:token" element={<ClientPortalPage />} />
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
      <Route path="/analytics" element={<Protected><AnalyticsPage /></Protected>} />
      <Route path="/admin/growth" element={<Protected><AdminGrowthPage /></Protected>} />
      <Route path="/admin" element={<Protected><AdminPage /></Protected>} />
      <Route path="/playground" element={<Protected><PlaygroundPage /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
    </>
  );
}
