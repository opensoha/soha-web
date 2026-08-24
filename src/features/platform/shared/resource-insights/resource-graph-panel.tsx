import { useEffect } from 'react'
import type { KubernetesResourceGraph } from '@opensoha/contracts/gen/ts/sohaapi'
import { Alert, Empty, Space, Spin, Typography } from 'antd'
import { useQuery } from '@tanstack/react-query'
import {
  Background,
  Controls,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
} from '@xyflow/react'
import dagre from 'dagre'
import { useNavigate } from 'react-router-dom'
import { StatusTag } from '@/components/status-tag'
import { buildKubernetesResourcePath } from '@/features/platform/shared/resource-ref'
import { useI18n } from '@/i18n'
import type { ScopeKey } from '@/types'
import { resourceInsightQueries } from './queries'
import '@xyflow/react/dist/style.css'

const NODE_WIDTH = 210
const NODE_HEIGHT = 76

type ResourceGraphNode = Node<{
  label: string
  resource: KubernetesResourceGraph['nodes'][number]['resource']
}>

export function buildResourceGraphFlow(graph: KubernetesResourceGraph): {
  nodes: ResourceGraphNode[]
  edges: Edge[]
} {
  const layout = new dagre.graphlib.Graph()
  layout.setDefaultEdgeLabel(() => ({}))
  layout.setGraph({ rankdir: 'LR', ranksep: 100, nodesep: 34 })

  graph.nodes.forEach((node) => layout.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT }))
  graph.edges.forEach((edge) => layout.setEdge(edge.sourceId, edge.targetId))
  dagre.layout(layout)

  const nodes = graph.nodes.map<ResourceGraphNode>((node) => {
    const position = layout.node(node.id) ?? { x: NODE_WIDTH / 2, y: NODE_HEIGHT / 2 }
    const namespace = node.resource.namespace ? `${node.resource.namespace}/` : ''
    const state = node.health || node.status
    const root = node.id === graph.rootId
    return {
      id: node.id,
      className: `soha-resource-graph-node${root ? ' is-root' : ''}`,
      data: {
        label: `${node.resource.kind}\n${namespace}${node.resource.name}${state ? `\n${state}` : ''}`,
        resource: node.resource,
      },
      position: { x: position.x - NODE_WIDTH / 2, y: position.y - NODE_HEIGHT / 2 },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      style: {
        background: root ? 'var(--ant-color-primary-bg)' : 'var(--ant-color-bg-container)',
        border: `1px solid ${root ? 'var(--ant-color-primary)' : 'var(--ant-color-border)'}`,
        borderRadius: 6,
        color: 'var(--ant-color-text)',
        fontSize: 12,
        lineHeight: 1.45,
        whiteSpace: 'pre-line',
        width: NODE_WIDTH,
      },
    }
  })

  const edges = graph.edges.map<Edge>((edge) => ({
    id: edge.id,
    source: edge.sourceId,
    target: edge.targetId,
    label: edge.relation,
    markerEnd: { type: MarkerType.ArrowClosed },
    style: { stroke: 'var(--ant-color-text-tertiary)' },
    labelStyle: { fill: 'var(--ant-color-text-secondary)', fontSize: 11 },
  }))

  return { nodes, edges }
}

function ResourceGraphCanvas({ graph }: { graph: KubernetesResourceGraph }) {
  const navigate = useNavigate()
  const { fitView } = useReactFlow()
  const flow = buildResourceGraphFlow(graph)

  useEffect(() => {
    const frame = requestAnimationFrame(() => fitView({ padding: 0.18, duration: 180 }))
    return () => cancelAnimationFrame(frame)
  }, [fitView, graph.generatedAt])

  return (
    <div style={{ height: 460, minHeight: 360, width: '100%' }}>
      <ReactFlow<ResourceGraphNode, Edge>
        aria-label="Kubernetes resource relationships"
        edges={flow.edges}
        nodes={flow.nodes}
        edgesFocusable={false}
        nodesConnectable={false}
        nodesDraggable={false}
        proOptions={{ hideAttribution: true }}
        onNodeClick={(_, node) => {
          const path = buildKubernetesResourcePath(node.data.resource)
          if (path) navigate(path)
        }}
      >
        <Background gap={20} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  )
}

export function ResourceGraphPanel({
  kind,
  name,
  scope,
}: {
  kind: string
  name: string
  scope: ScopeKey
}) {
  const { localeCode } = useI18n()
  const graphQuery = useQuery(resourceInsightQueries.graph(scope, kind, name))
  const graph = graphQuery.data

  if (graphQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spin size="large" />
      </div>
    )
  }
  if (graphQuery.error || !graph) {
    return (
      <Alert
        showIcon
        type="warning"
        title={localeCode === 'zh_CN' ? '资源关系暂不可用' : 'Resource relationships unavailable'}
        description={graphQuery.error?.message}
      />
    )
  }
  if (graph.nodes.length === 0) {
    return (
      <Empty description={localeCode === 'zh_CN' ? '未发现关联资源' : 'No related resources'} />
    )
  }

  return (
    <div className="soha-detail-stack">
      <Space wrap>
        <Typography.Text strong>
          {localeCode === 'zh_CN' ? '资源关系与影响范围' : 'Resource relationships and impact'}
        </Typography.Text>
        <Typography.Text type="secondary">
          {new Date(graph.generatedAt).toLocaleString()}
        </Typography.Text>
      </Space>
      {graph.warnings.length ? (
        <Alert showIcon type="warning" title={graph.warnings.join(' ')} />
      ) : null}
      <ReactFlowProvider>
        <ResourceGraphCanvas graph={graph} />
      </ReactFlowProvider>
      {graph.evidence.length ? (
        <section aria-labelledby="resource-evidence-title">
          <Typography.Text id="resource-evidence-title" strong>
            {localeCode === 'zh_CN' ? '最近证据' : 'Recent evidence'}
          </Typography.Text>
          <ul className="m-0 mt-2 list-none p-0">
            {graph.evidence.slice(0, 20).map((item, index) => (
              <li
                className="flex flex-wrap items-center justify-between gap-2 border-0 border-b border-solid border-[var(--ant-color-split)] py-2 last:border-b-0"
                key={`${item.observedAt}-${item.summary}-${index}`}
              >
                <Space>
                  <StatusTag value={item.severity} />
                  <Typography.Text>{item.summary}</Typography.Text>
                </Space>
                <Typography.Text type="secondary">
                  <time dateTime={item.observedAt}>
                    {new Date(item.observedAt).toLocaleString()}
                  </time>
                </Typography.Text>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
