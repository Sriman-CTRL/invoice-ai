import { Navigate } from "react-router-dom";
import { useAuth } from "./auth";
import { Shell } from "./components";

/** Signed-in area wrapper. Lives in its own file so the app shell loads only for signed-in routes. */
export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return user ? <Shell>{children}</Shell> : <Navigate to="/login" replace />;
}
