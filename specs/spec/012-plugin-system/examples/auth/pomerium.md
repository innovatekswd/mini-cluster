# Pomerium Plugin

## Overview
Pomerium - Zero-trust secure access proxy with identity-aware routing.

## Why Pomerium
| Advantage | Benefit |
|-----------|---------|
| Zero-trust | Every request authenticated |
| Identity-aware | Route based on user/groups |
| Single sign-on | Integrate with IdPs |
| Audit logging | Full access trail |

## Capabilities
```csharp
public PluginCapabilities Capabilities => 
    PluginCapabilities.ReverseProxy |
    PluginCapabilities.OAuth2 |
    PluginCapabilities.OIDC;
```

## Detection Paths
| OS | Binary |
|----|--------|
| Linux | `/usr/bin/pomerium` |
| Windows | `C:\pomerium\pomerium.exe` |

## Config Schema
```json
{
  "authenticate_service_url": "https://auth.example.com",
  "idp_provider": "google",
  "idp_client_id": "",
  "idp_client_secret": "",
  "cookie_secret": "",
  "routes": [
    {
      "from": "https://app.example.com",
      "to": "http://localhost:8080",
      "allowed_users": ["admin@example.com"],
      "allowed_groups": ["engineering"]
    }
  ]
}
```

## Integration with MiniCluster Apps
Apps can be protected by Pomerium with:
```json
{
  "appId": "my-app",
  "pomerium": {
    "enabled": true,
    "allowedGroups": ["developers"]
  }
}
```

## Estimated Effort: 1-2 weeks
