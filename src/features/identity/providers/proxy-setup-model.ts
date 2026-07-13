import type { IdentityProvider } from './types'

export type ProxySetupTarget =
  | 'nginx-ingress'
  | 'nginx-proxy-manager'
  | 'nginx-standalone'
  | 'traefik-ingress'
  | 'traefik-compose'
  | 'traefik-standalone'
  | 'caddy-standalone'

export const proxySetupTargets: ProxySetupTarget[] = [
  'nginx-ingress',
  'nginx-proxy-manager',
  'nginx-standalone',
  'traefik-ingress',
  'traefik-compose',
  'traefik-standalone',
  'caddy-standalone',
]

function configString(provider: IdentityProvider, key: string) {
  const value = provider.config?.[key]
  return typeof value === 'string' ? value.trim() : ''
}

function externalHost(provider: IdentityProvider) {
  const value = provider.config?.externalHosts
  if (Array.isArray(value)) {
    const first = value.find((item) => typeof item === 'string' && item.trim())
    if (typeof first === 'string') return first.trim()
  }
  return 'app.example.com'
}

export interface ProxySetupContext {
  authURL: string
  host: string
  providerID: string
  reverseProxyURL: string
  upstreamURL: string
}

export function proxySetupContext(
  provider: IdentityProvider,
  apiOrigin: string,
): ProxySetupContext {
  const origin = apiOrigin.replace(/\/$/, '')
  return {
    authURL: `${origin}/api/v1/provider/proxy/auth?provider_id=${encodeURIComponent(provider.id)}`,
    host: externalHost(provider),
    providerID: provider.id,
    reverseProxyURL: `${origin}/api/v1/provider/proxy/reverse/${encodeURIComponent(provider.id)}`,
    upstreamURL: configString(provider, 'upstreamUrl') || 'http://upstream:8080',
  }
}

export function proxySetupSnippet(target: ProxySetupTarget, context: ProxySetupContext) {
  const { authURL, host, upstreamURL } = context
  const redirectAuthURL = `${authURL}&redirect=true`
  switch (target) {
    case 'nginx-ingress':
      return `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: protected-application
  annotations:
    nginx.ingress.kubernetes.io/auth-url: "${authURL}"
    nginx.ingress.kubernetes.io/auth-signin: "${authURL.replace('/auth?', '/start?')}&return_to=$scheme://$host$escaped_request_uri"
    nginx.ingress.kubernetes.io/auth-response-headers: "X-Soha-User,X-Soha-User-ID,X-Soha-Email,X-Soha-Roles,X-Soha-Teams,X-Soha-Groups"
spec:
  rules:
    - host: ${host}
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: protected-application
                port:
                  number: 80`
    case 'nginx-proxy-manager':
      return `# Proxy Host > Advanced
auth_request ${authURL};
error_page 401 = @soha_signin;

auth_request_set $soha_user $upstream_http_x_soha_user;
auth_request_set $soha_email $upstream_http_x_soha_email;
proxy_set_header X-Soha-User $soha_user;
proxy_set_header X-Soha-Email $soha_email;

location @soha_signin {
  return 302 ${authURL.replace('/auth?', '/start?')}&return_to=$scheme://$http_host$request_uri;
}`
    case 'nginx-standalone':
      return `server {
  server_name ${host};

  location / {
    auth_request ${authURL};
    error_page 401 = @soha_signin;
    auth_request_set $soha_user $upstream_http_x_soha_user;
    auth_request_set $soha_email $upstream_http_x_soha_email;
    proxy_set_header X-Soha-User $soha_user;
    proxy_set_header X-Soha-Email $soha_email;
    proxy_pass ${upstreamURL};
  }

  location @soha_signin {
    return 302 ${authURL.replace('/auth?', '/start?')}&return_to=$scheme://$http_host$request_uri;
  }
}`
    case 'traefik-ingress':
      return `apiVersion: traefik.io/v1alpha1
kind: Middleware
metadata:
  name: soha-forward-auth
spec:
  forwardAuth:
    address: "${redirectAuthURL}"
    trustForwardHeader: true
    authResponseHeaders:
      - X-Soha-User
      - X-Soha-User-ID
      - X-Soha-Email
      - X-Soha-Roles
      - X-Soha-Teams
      - X-Soha-Groups
---
# Add to the protected Ingress:
# metadata.annotations.traefik.ingress.kubernetes.io/router.middlewares: default-soha-forward-auth@kubernetescrd`
    case 'traefik-compose':
      return `services:
  protected-application:
    labels:
      - traefik.enable=true
      - traefik.http.routers.protected.rule=Host(\`${host}\`)
      - traefik.http.routers.protected.middlewares=soha-auth
      - traefik.http.middlewares.soha-auth.forwardauth.address=${redirectAuthURL}
      - traefik.http.middlewares.soha-auth.forwardauth.trustForwardHeader=true
      - traefik.http.middlewares.soha-auth.forwardauth.authResponseHeaders=X-Soha-User,X-Soha-User-ID,X-Soha-Email,X-Soha-Roles,X-Soha-Teams,X-Soha-Groups`
    case 'traefik-standalone':
      return `http:
  middlewares:
    soha-auth:
      forwardAuth:
        address: "${redirectAuthURL}"
        trustForwardHeader: true
        authResponseHeaders:
          - X-Soha-User
          - X-Soha-User-ID
          - X-Soha-Email
          - X-Soha-Roles
          - X-Soha-Teams
          - X-Soha-Groups
  routers:
    protected:
      rule: "Host(\`${host}\`)"
      middlewares:
        - soha-auth
      service: protected
  services:
    protected:
      loadBalancer:
        servers:
          - url: "${upstreamURL}"`
    case 'caddy-standalone':
      return `${host} {
  forward_auth ${new URL(authURL).origin} {
    uri /api/v1/provider/proxy/auth?provider_id=${encodeURIComponent(context.providerID)}&redirect=true
    copy_headers X-Soha-User X-Soha-User-ID X-Soha-Email X-Soha-Roles X-Soha-Teams X-Soha-Groups
  }
  reverse_proxy ${upstreamURL}
}`
  }
}
