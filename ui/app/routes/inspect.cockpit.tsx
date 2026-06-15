import { Navigate } from "react-router";

// Redirect /inspect/cockpit to /inspect/local/overview (default machine)
export default function CockpitRedirect() {
  return <Navigate to="/inspect/local/overview" replace />;
}
