# 004: Reverse Proxy

**Status:** ✅ Complete (100%)  
**Phase:** 1 - Foundation  
**Original Spec:** [../spec/004-reverse-proxy/spec.md](../../spec/004-reverse-proxy/spec.md)

---

## Summary

YARP-based reverse proxy for accessing internal services (Seq, Grafana, RabbitMQ, etc.) through MiniCluster with authentication.

## Implemented Features

- ✅ YARP (Yet Another Reverse Proxy) integration
- ✅ Path prefix routing (`/proxy/seq/...` → `http://localhost:5341`)
- ✅ Subdomain routing (nip.io/sslip.io support)
- ✅ Database-driven configuration
- ✅ Dynamic route reload without restart
- ✅ Health check endpoints
- ✅ Proxy settings management UI
- ✅ ProxyRoutes CRUD operations
- ✅ Authentication passthrough

## Technical Implementation

**Backend:**
- `ProxyRoutesController.cs` - Route management API
- `ProxySettingsController.cs` - Settings management
- `Configuration/ProxyConfig.cs` - YARP configuration provider
- `Models/ProxyRoute.cs` - Database entity
- `Data/AppDbContext.cs` - EF Core context

**Frontend:**
- `app/routes/proxy.tsx` - Proxy management UI
- `app/services/proxyService.ts` - API client

**Database:**
- `ProxyRoutes` table - Route definitions
- `ProxySettings` table - Global proxy configuration

## Use Cases

- Access Seq logs at `/proxy/seq`
- Access Grafana dashboards at `/proxy/grafana`
- Access RabbitMQ admin at `/proxy/rabbitmq`
- Expose internal services with authentication

## Related Features

- Works with **003 Authentication** to secure proxied services
- Future: Will integrate with **012 Plugin System** for plugin-provided routes

---

For complete details, see the [full reverse proxy spec](../../spec/004-reverse-proxy/spec.md).
