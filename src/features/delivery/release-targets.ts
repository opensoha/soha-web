import type { ReleaseTarget } from './domain-types'

export const RELEASE_TARGET_KIND_OPTIONS = [
  { value: 'k8s_workload', label: 'YAML / Kubernetes workload' },
  { value: 'helm_release', label: 'Helm release' },
  { value: 'kustomize_overlay', label: 'Kustomize overlay' },
  { value: 'host_service', label: 'Host service' },
] as const

type ReleaseTargetInput = Omit<ReleaseTarget, 'id'> & { id?: string }

function requiredText(value: unknown, label: string, index: number) {
  const text = String(value ?? '').trim()
  if (!text) throw new Error(`发布目标 ${index + 1} 缺少 ${label}`)
  return text
}

export function parseReleaseTargets(raw: unknown, field = '发布目标'): ReleaseTargetInput[] {
  const text = typeof raw === 'string' ? raw.trim() : ''
  if (!text) return []
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new Error(`${field} 需要是合法 JSON 数组`)
  }
  if (!Array.isArray(value)) throw new Error(`${field} 需要是合法 JSON 数组`)

  return value.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`发布目标 ${index + 1} 需要是 JSON 对象`)
    }
    const target = item as Record<string, unknown>
    const targetKind = String(target.targetKind || 'k8s_workload')
    if (!RELEASE_TARGET_KIND_OPTIONS.some((option) => option.value === targetKind)) {
      throw new Error(`发布目标 ${index + 1} 的 targetKind 不受支持`)
    }
    const metadata =
      target.metadata && typeof target.metadata === 'object' && !Array.isArray(target.metadata)
        ? (target.metadata as Record<string, unknown>)
        : {}
    if (targetKind === 'helm_release') requiredText(metadata.chartRef, 'metadata.chartRef', index)
    if (targetKind === 'kustomize_overlay') {
      requiredText(metadata.overlayPath || target.configRef, 'metadata.overlayPath 或 configRef', index)
    }
    return {
      ...target,
      clusterId: requiredText(target.clusterId, 'clusterId', index),
      namespace: requiredText(target.namespace, 'namespace', index),
      targetKind,
      executorKind: String(target.executorKind || 'k8s_job_runner'),
      workloadKind: requiredText(target.workloadKind, 'workloadKind', index),
      workloadName: requiredText(target.workloadName, 'workloadName', index),
      metadata,
      enabled: target.enabled !== false,
    } as ReleaseTargetInput
  })
}

export function summarizeReleaseTargets(targets: ReleaseTarget[] = []) {
  if (!targets.length) return '-'
  const counts = new Map<string, number>()
  targets.forEach((target) => {
    const kind = target.targetKind || 'k8s_workload'
    counts.set(kind, (counts.get(kind) ?? 0) + 1)
  })
  return Array.from(counts, ([kind, count]) => `${kind} ${count}`).join(' · ')
}
