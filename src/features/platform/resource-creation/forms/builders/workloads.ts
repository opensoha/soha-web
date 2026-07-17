import type { JobFormValues, KubernetesManifest, WorkloadFormValues } from '../types'
import { appLabels, buildMetadata, buildPodSpec, compactObject, manifest } from './shared'

type ControllerKind = 'Deployment' | 'StatefulSet' | 'DaemonSet'

export function buildControllerManifest(
  kind: ControllerKind,
  values: WorkloadFormValues,
): KubernetesManifest {
  const labels = appLabels(values)
  const podTemplate = {
    metadata: { labels },
    spec: buildPodSpec(values),
  }
  const baseSpec = {
    selector: { matchLabels: { 'app.kubernetes.io/name': labels['app.kubernetes.io/name'] } },
    template: podTemplate,
  }

  if (kind === 'DaemonSet') {
    return manifest('apps/v1', kind, buildMetadata(values), { spec: baseSpec })
  }

  return manifest('apps/v1', kind, buildMetadata(values), {
    spec: compactObject({
      ...baseSpec,
      replicas: values.replicas ?? 1,
      serviceName:
        kind === 'StatefulSet' ? values.serviceName?.trim() || values.name.trim() : undefined,
    }),
  })
}

export function buildJobManifest(
  kind: 'Job' | 'CronJob',
  values: JobFormValues,
): KubernetesManifest {
  const labels = appLabels(values)
  const jobSpec = compactObject({
    parallelism: values.parallelism,
    completions: values.completions,
    backoffLimit: values.backoffLimit ?? 6,
    activeDeadlineSeconds: values.activeDeadlineSeconds,
    template: {
      metadata: { labels },
      spec: { ...buildPodSpec(values), restartPolicy: values.restartPolicy },
    },
  })

  if (kind === 'CronJob') {
    return manifest('batch/v1', kind, buildMetadata(values), {
      spec: {
        schedule: values.schedule?.trim() || '0 * * * *',
        suspend: values.suspend ?? false,
        jobTemplate: { spec: jobSpec },
      },
    })
  }

  return manifest('batch/v1', kind, buildMetadata(values), { spec: jobSpec })
}
