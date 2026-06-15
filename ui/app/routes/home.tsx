import { Navigate } from "react-router";

export default function HomeRedirect() {
  return <Navigate to="/inspect/local/overview" replace />;
}
