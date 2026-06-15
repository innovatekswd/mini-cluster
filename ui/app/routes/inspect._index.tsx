import { Navigate } from "react-router";

// Redirect /inspect to /inspect/local/overview (default machine)
export default function InspectIndex() {
  return <Navigate to="/inspect/local/overview" replace />;
}
