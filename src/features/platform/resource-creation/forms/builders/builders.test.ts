import { describe, expect, it } from 'vitest'
import { buildNamespaceManifest, buildServiceAccountManifest } from './access-control'
import { buildConfigMapManifest, buildSecretManifest } from './configuration'
import { buildIngressManifest, buildServiceManifest } from './network'
import { buildPersistentVolumeClaimManifest } from './storage'
import { buildControllerManifest, buildJobManifest } from './workloads'

const metadata = {
  name: 'demo',
  namespace: 'minio',
  labels: [{ key: 'team', value: 'platform' }],
}

const pod = {
  containerName: 'app',
  image: 'nginx:1.27',
  containerPort: 8080,
  env: [{ key: 'MODE', value: 'prod' }],
}

describe('workload manifest builders', () => {
  it.each(['Deployment', 'StatefulSet', 'DaemonSet'] as const)(
    'keeps %s selector and pod labels consistent',
    (kind) => {
      const result = buildControllerManifest(kind, {
        ...metadata,
        ...pod,
        replicas: 2,
        serviceName: 'demo-headless',
      })

      expect(result).toMatchObject({
        apiVersion: 'apps/v1',
        kind,
        metadata: { name: 'demo', namespace: 'minio', labels: { team: 'platform' } },
        spec: {
          selector: { matchLabels: { 'app.kubernetes.io/name': 'demo' } },
          template: {
            metadata: {
              labels: { 'app.kubernetes.io/name': 'demo', team: 'platform' },
            },
            spec: { containers: [{ name: 'app', image: 'nginx:1.27' }] },
          },
        },
      })
      if (kind === 'DaemonSet') expect(result.spec).not.toHaveProperty('replicas')
      if (kind === 'StatefulSet') expect(result.spec).toHaveProperty('serviceName', 'demo-headless')
    },
  )

  it('builds the CronJob jobTemplate nesting and restart policy', () => {
    const result = buildJobManifest('CronJob', {
      ...metadata,
      ...pod,
      restartPolicy: 'OnFailure',
      schedule: '*/5 * * * *',
      suspend: true,
      backoffLimit: 3,
    })

    expect(result).toMatchObject({
      apiVersion: 'batch/v1',
      kind: 'CronJob',
      spec: {
        schedule: '*/5 * * * *',
        suspend: true,
        jobTemplate: {
          spec: {
            backoffLimit: 3,
            template: { spec: { restartPolicy: 'OnFailure' } },
          },
        },
      },
    })
  })

  it('builds an ordinary Job without CronJob fields', () => {
    const result = buildJobManifest('Job', { ...metadata, ...pod, restartPolicy: 'Never' })
    expect(result).toMatchObject({
      kind: 'Job',
      spec: { template: { spec: { restartPolicy: 'Never' } } },
    })
    expect(result.spec).not.toHaveProperty('schedule')
  })
})

describe('network manifest builders', () => {
  it('preserves Service port mapping and selector', () => {
    expect(
      buildServiceManifest({
        ...metadata,
        type: 'ClusterIP',
        selector: [{ key: 'app', value: 'demo' }],
        ports: [{ name: 'http', port: 80, targetPort: 8080, protocol: 'TCP' }],
      }),
    ).toMatchObject({
      apiVersion: 'v1',
      kind: 'Service',
      spec: {
        type: 'ClusterIP',
        selector: { app: 'demo' },
        ports: [{ name: 'http', port: 80, targetPort: 8080, protocol: 'TCP' }],
      },
    })
  })

  it('uses externalName instead of a selector for ExternalName services', () => {
    const result = buildServiceManifest({
      ...metadata,
      type: 'ExternalName',
      externalName: 'database.example.com',
      selector: [{ key: 'app', value: 'ignored' }],
      ports: [{ port: 5432, targetPort: 5432, protocol: 'TCP' }],
    })
    expect(result).toMatchObject({
      spec: { type: 'ExternalName', externalName: 'database.example.com' },
    })
    expect(result.spec).not.toHaveProperty('selector')
  })

  it('builds Ingress v1 service backends and TLS', () => {
    expect(
      buildIngressManifest({
        ...metadata,
        host: 'demo.example.com',
        tlsSecretName: 'demo-tls',
        paths: [{ path: '/api', serviceName: 'api', servicePort: 8080 }],
      }),
    ).toMatchObject({
      apiVersion: 'networking.k8s.io/v1',
      kind: 'Ingress',
      spec: {
        rules: [
          {
            host: 'demo.example.com',
            http: {
              paths: [
                { path: '/api', backend: { service: { name: 'api', port: { number: 8080 } } } },
              ],
            },
          },
        ],
        tls: [{ hosts: ['demo.example.com'], secretName: 'demo-tls' }],
      },
    })
  })
})

describe('configuration, storage, and access control builders', () => {
  it('builds ConfigMap data and UTF-8 base64 Secret data', () => {
    const data = [{ key: 'message', value: '你好 Soha' }]
    expect(buildConfigMapManifest({ ...metadata, data })).toMatchObject({
      data: { message: '你好 Soha' },
    })
    const secret = buildSecretManifest({ ...metadata, type: 'Opaque', data })
    const encoded = (secret.data as Record<string, string>).message
    expect(
      new TextDecoder().decode(Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0))),
    ).toBe('你好 Soha')
  })

  it('preserves PVC access modes, volume mode, class, and request', () => {
    expect(
      buildPersistentVolumeClaimManifest({
        ...metadata,
        accessModes: ['ReadWriteOnce', 'ReadOnlyMany'],
        storage: '20Gi',
        storageClassName: 'fast',
        volumeMode: 'Filesystem',
      }),
    ).toMatchObject({
      kind: 'PersistentVolumeClaim',
      spec: {
        accessModes: ['ReadWriteOnce', 'ReadOnlyMany'],
        volumeMode: 'Filesystem',
        storageClassName: 'fast',
        resources: { requests: { storage: '20Gi' } },
      },
    })
  })

  it('keeps Namespace cluster-scoped and maps ServiceAccount pull secrets', () => {
    expect(buildNamespaceManifest({ name: 'team-a' })).toEqual({
      apiVersion: 'v1',
      kind: 'Namespace',
      metadata: { name: 'team-a' },
    })
    expect(
      buildServiceAccountManifest({
        ...metadata,
        automountServiceAccountToken: false,
        imagePullSecrets: ['registry-a', ' registry-b '],
      }),
    ).toMatchObject({
      kind: 'ServiceAccount',
      automountServiceAccountToken: false,
      imagePullSecrets: [{ name: 'registry-a' }, { name: 'registry-b' }],
    })
  })
})
