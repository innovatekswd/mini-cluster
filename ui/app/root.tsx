import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
} from "react-router";
import type { Route as RouteType } from "./+types/root";
import "./app.css";

import { AppProviders } from "./components/AppProviders";
import { useAuth } from "./context/AuthContext";
import { Navigate } from "react-router";

// Public routes that don't require authentication
const PUBLIC_ROUTES = ["/login"];

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading: loading } = useAuth();
  const location = useLocation();
  
  const isPublicRoute = PUBLIC_ROUTES.some(route => location.pathname === route);
  
  if (loading) {
    return (
      <div className="h-dvh flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }
  
  // If not authenticated and not on a public route, redirect to login
  if (!user && !isPublicRoute) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  // If authenticated and on login page, redirect to home
  if (user && location.pathname === "/login") {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
}

export const links: RouteType.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];

// This is the main root component that sets up the HTML structure
export default function App() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* Inline critical styles prevent the flash of unstyled white content
            before the Tailwind/app CSS bundle is parsed and applied. */}
        <style dangerouslySetInnerHTML={{ __html: `
          html,body{background:#0f172a;color:#e2e8f0;margin:0}
        ` }} />
        <Meta />
        <Links />
      </head>
      <body className="h-dvh">
        <AppProviders>
          <AuthGate>
            <Outlet />
          </AuthGate>
        </AppProviders>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

// SPA mode hydration fallback — prevents "Hey developer 👋" React Router warning
export function HydrateFallback() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style dangerouslySetInnerHTML={{ __html: `
          html,body{background:#0f172a;color:#e2e8f0;margin:0}
        ` }} />
        <Meta />
        <Links />
      </head>
      <body className="h-dvh bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto" />
          <p className="mt-4 text-gray-400">Loading...</p>
        </div>
        <Scripts />
      </body>
    </html>
  );
}

export function ErrorBoundary({ error }: RouteType.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="h-dvh">
        <main className="pt-16 p-4 container mx-auto flex h-dvh">
          <h1>{message}</h1>
          <p>{details}</p>
          {stack && (
            <pre className="w-full p-4 overflow-x-auto">
              <code>{stack}</code>
            </pre>
          )}
        </main>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
