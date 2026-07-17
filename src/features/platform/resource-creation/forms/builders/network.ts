import type { IngressFormValues, KubernetesManifest, ServiceFormValues } from '../types'
import { buildMetadata, compactObject, entriesToRecord, manifest } from './shared'

export function buildServiceManifest(values: ServiceFormValues): KubernetesManifest {
  return manifest('v1', 'Service', buildMetadata(values), {
    spec: compactObject({
      type: values.type,
      externalName: values.type === 'ExternalName' ? values.externalName?.trim() : undefined,
      selector: values.type === 'ExternalName' ? undefined : entriesToRecord(values.selector),
      ports: values.ports.map((port) =>
        compactObject({
          name: port.name?.trim(),
          port: port.port,
          targetPort: port.targetPort,
          protocol: port.protocol,
        }),
      ),
    }),
  })
}

export function buildIngressManifest(values: IngressFormValues): KubernetesManifest {
  const paths = values.paths.map((path) => ({
    path: path.path.trim() || '/',
    pathType: 'Prefix',
    backend: {
      service: { name: path.serviceName.trim(), port: { number: path.servicePort } },
    },
  }))
  const host = values.host?.trim()
  const tlsSecretName = values.tlsSecretName?.trim()

  return manifest('networking.k8s.io/v1', 'Ingress', buildMetadata(values), {
    spec: compactObject({
      ingressClassName: values.ingressClassName?.trim(),
      rules: [{ ...(host ? { host } : {}), http: { paths } }],
      tls: tlsSecretName
        ? [{ ...(host ? { hosts: [host] } : {}), secretName: tlsSecretName }]
        : undefined,
    }),
  })
}
