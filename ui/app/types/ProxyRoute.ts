// Proxy route types matching backend DTOs

export interface PathPrefixConfig {
  enabled: boolean;
  prefix?: string;
  rewriteUrls: boolean;
  rewriteWebSocket: boolean;
  url?: string;
}

export interface SubdomainConfig {
  enabled: boolean;
  subdomain?: string;
  url?: string;
}

export interface PortConfig {
  enabled: boolean;
  port?: number;
  url?: string;
}

export interface IframeConfig {
  enabled: boolean;
  stripXFrameOptions: boolean;
  embedUrl?: string;
}

export interface ProxyUrls {
  pathPrefix?: string;
  subdomain?: string;
  port?: string;
  iframe?: string;
  recommended?: string;
}

export interface ProxyRoute {
  id: number;
  name: string;
  description?: string;
  icon?: string;
  targetUrl: string;
  
  // Access methods
  pathPrefix?: PathPrefixConfig;
  subdomain?: SubdomainConfig;
  port?: PortConfig;
  iframe?: IframeConfig;
  
  // Security
  requireAuth: boolean;
  allowedRoles?: string[];
  
  // Status
  isEnabled: boolean;
  isHealthy: boolean;
  lastHealthCheck?: string;
  
  // Metadata
  createdAt: string;
  updatedAt?: string;
  
  // Generated URLs
  urls?: ProxyUrls;
}

export interface CreateProxyRouteDto {
  name: string;
  description?: string;
  icon?: string;
  targetUrl: string;
  
  // Path Prefix Mode
  enablePathPrefix: boolean;
  pathPrefix?: string;
  rewriteUrls: boolean;
  rewriteWebSocket: boolean;
  
  // Subdomain Mode
  enableSubdomain: boolean;
  subdomain?: string;
  
  // Port Mode
  enablePort: boolean;
  proxyPort?: number;
  
  // Iframe Mode
  enableIframe: boolean;
  stripXFrameOptions: boolean;
  
  // Security
  requireAuth: boolean;
  allowedRoles?: string[];
  
  // Advanced
  timeoutSeconds: number;
  preserveHostHeader: boolean;
  customHeaders?: Record<string, string>;
}

export interface ProxySettings {
  baseDomainType: 'nip.io' | 'sslip.io' | 'custom';
  customBaseDomain?: string;
  portRangeStart: number;
  portRangeEnd: number;
  defaultRequireAuth: boolean;
  serverIp?: string;
  detectedServerIp?: string;
  usedPorts: number[];
}

export interface UpdateProxySettingsDto {
  baseDomainType: 'nip.io' | 'sslip.io' | 'custom';
  customBaseDomain?: string;
  portRangeStart: number;
  portRangeEnd: number;
  defaultRequireAuth: boolean;
  serverIp?: string;
}

export interface ProxyHealthCheck {
  isHealthy: boolean;
  statusCode?: number;
  responseTimeMs: number;
  message?: string;
  error?: string;
}
