import { lazy, Suspense, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { App, Card, Spin, Tabs } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PlatformResourceOverview } from '@/features/platform/shared/resource-overview'
import { ResourceGitOpsStatus } from '@/features/platform/shared/resource-gitops-status'
import { useAIPageContext } from '@/features/copilot'
import type { AIPageContext } from '@/features/copilot'
import { useI18n } from '@/i18n'
import type { TabsProps } from 'antd'
import { networkMutations } from './mutations'
import { networkQueries } from './queries'
import type { NetworkKind, NetworkResourceRecord, NetworkTarget } from './types'
import '../styles.css'

const K8sYamlEditor = lazy(async () => {
  const module = await import('@/components/k8s-yaml-editor')
  return { default: module.K8sYamlEditor }
})

const ResourceGraphPanel = lazy(async () => {
  const module = await import('@/features/platform/shared/resource-insights/resource-graph-panel')
  return { default: module.ResourceGraphPanel }
})

const RESOURCE_GRAPH_KINDS: Partial<Record<NetworkKind, string>> = {
  ingresses: 'Ingress',
  services: 'Service',
}

const NETWORK_ENTITY_KINDS: Record<NetworkKind, string> = {
  services: 'kubernetes.service',
  ingresses: 'kubernetes.ingress',
  gatewayclasses: 'kubernetes.gatewayclass',
  gateways: 'kubernetes.gateway',
  httproutes: 'kubernetes.httproute',
  backendtlspolicies: 'kubernetes.backendtlspolicy',
  grpcroutes: 'kubernetes.grpcroute',
  referencegrants: 'kubernetes.referencegrant',
  endpointslices: 'kubernetes.endpointslice',
  ingressclasses: 'kubernetes.ingressclass',
  networkpolicies: 'kubernetes.networkpolicy',
}

export function NetworkResourceOverview({
  ageLabel,
  detail,
  extra,
}: {
  ageLabel?: ReactNode
  detail: NetworkResourceRecord
  extra?: Array<{ key: string; value: ReactNode }>
}) {
  return (
    <PlatformResourceOverview
      ageSeconds={detail.ageSeconds}
      annotations={detail.annotations}
      createdAtLabel={ageLabel}
      facts={(extra ?? []).map((item) => ({ ...item, label: item.key }))}
      labels={detail.labels}
      name={detail.name}
      namespace={detail.namespace || '-'}
    />
  )
}

function NetworkYAMLTab({
  clusterScoped,
  kind,
  target,
}: {
  clusterScoped: boolean
  kind: NetworkKind
  target: NetworkTarget
}) {
  const { localeCode } = useI18n()
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const yamlQuery = useQuery(networkQueries.yaml(kind, target.scope, target.name, clusterScoped))
  const updateMutation = useMutation(networkMutations.updateYAML(kind, queryClient))
  const serverValue = yamlQuery.data?.content ?? ''
  const [draft, setDraft] = useState('')

  useEffect(() => {
    setDraft(serverValue)
  }, [serverValue])

  if (yamlQuery.isLoading) {
    return (
      <Card className="soha-detail-card">
        <Spin size="large" />
      </Card>
    )
  }

  return (
    <Suspense
      fallback={
        <Card className="soha-detail-card">
          <Spin size="large" />
        </Card>
      }
    >
      <div style={{ height: 620 }}>
        <K8sYamlEditor
          value={draft}
          onChange={setDraft}
          onReset={() => setDraft(serverValue)}
          onSave={() =>
            void message.info(
              localeCode === 'zh_CN' ? '暂不支持本地草稿' : 'Local draft save disabled here',
            )
          }
          onApply={() =>
            updateMutation.mutate(
              { ...target, content: draft },
              {
                onSuccess: (yaml) => {
                  setDraft(yaml.content ?? draft)
                  void message.success(localeCode === 'zh_CN' ? 'YAML 已应用' : 'YAML applied')
                },
                onError: (error) => void message.error(error.message),
              },
            )
          }
          saveDisabled
          applyDisabled={!draft.trim() || updateMutation.isPending}
          applying={updateMutation.isPending}
        />
      </div>
    </Suspense>
  )
}

export function NetworkDetailShell({
  activeTabKey,
  ageLabel,
  aiContext,
  clusterScoped = false,
  detail,
  extraTabs = [],
  kind,
  label,
  onTabChange,
  overviewExtra,
  overviewContent,
  target,
}: {
  activeTabKey: string
  ageLabel?: ReactNode
  aiContext?: Partial<AIPageContext>
  clusterScoped?: boolean
  detail: NetworkResourceRecord
  extraTabs?: NonNullable<TabsProps['items']>
  kind: NetworkKind
  label: string
  onTabChange: (key: string) => void
  overviewExtra?: Array<{ key: string; value: ReactNode }>
  overviewContent?: ReactNode
  target: NetworkTarget
}) {
  const { t } = useI18n()
  const graphKind = RESOURCE_GRAPH_KINDS[kind]
  useAIPageContext({
    sourceWorkbench: 'platform',
    sourceTitle: `${label} ${detail.name}`,
    entityKind: NETWORK_ENTITY_KINDS[kind],
    entityName: detail.name,
    clusterId: target.scope.clusterId || undefined,
    namespace: detail.namespace || undefined,
    service: kind === 'services' ? detail.name : undefined,
    ...aiContext,
  })
  const items: NonNullable<TabsProps['items']> = [
    {
      key: 'overview',
      label: t('common.overview', 'Overview'),
      children: (
        <div className="soha-detail-stack">
          <NetworkResourceOverview ageLabel={ageLabel} detail={detail} extra={overviewExtra} />
          <ResourceGitOpsStatus
            clusterId={target.scope.clusterId}
            kind={label}
            name={detail.name}
            namespace={detail.namespace}
          />
          {overviewContent}
        </div>
      ),
    },
    ...(graphKind
      ? [
          {
            key: 'relationships',
            label: t('common.relationships', 'Relationships'),
            children: (
              <Suspense fallback={<Spin size="large" />}>
                <ResourceGraphPanel kind={graphKind} name={detail.name} scope={target.scope} />
              </Suspense>
            ),
          },
        ]
      : []),
    ...extraTabs,
    {
      key: 'yaml',
      label: t('common.yaml', 'YAML'),
      children:
        activeTabKey === 'yaml' ? (
          <NetworkYAMLTab clusterScoped={clusterScoped} kind={kind} target={target} />
        ) : null,
    },
  ]

  return (
    <div className="soha-page soha-workload-detail-page">
      <Tabs
        activeKey={activeTabKey}
        className="soha-resource-tabs soha-workload-detail-tabs"
        indicator={{ size: (origin) => Math.max(16, origin - 16), align: 'center' }}
        items={items}
        onChange={onTabChange}
        size="small"
        tabBarGutter={32}
      />
    </div>
  )
}
