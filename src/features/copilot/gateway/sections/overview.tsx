import {
  HistoryOutlined,
  KeyOutlined,
  LinkOutlined,
  SafetyCertificateOutlined,
  StopOutlined,
} from '@ant-design/icons'
import { Button, Descriptions, Space } from 'antd'
import { gatewaySectionPaths } from '../types'

export interface GatewayOverviewSectionProps {
  summary: {
    tools: number
    clients: number
    serviceAccounts: number
    grants: number
    policies: number
    bindings: number
    upstreams: number
    modelRoutes: number
  }
  personalTokenCount: number
  approvalCount: number
  modelCallCount: string
  successRate: string
  canUseRelay: boolean
  canManage: boolean
  onNavigate: (path: string) => void
}

export function GatewayOverviewSection({
  summary,
  personalTokenCount,
  approvalCount,
  modelCallCount,
  successRate,
  canUseRelay,
  canManage,
  onNavigate,
}: GatewayOverviewSectionProps) {
  return (
    <Space orientation="vertical" size={12} style={{ width: '100%' }}>
      <div className="grid gap-3 lg:grid-cols-3">
        <Descriptions
          size="small"
          column={2}
          bordered
          items={[
            { key: 'tools', label: 'Visible tools', children: summary.tools },
            { key: 'clients', label: 'AI clients', children: summary.clients },
            { key: 'tokens', label: 'Login keys', children: personalTokenCount },
            {
              key: 'serviceAccounts',
              label: 'Service accounts',
              children: summary.serviceAccounts,
            },
          ]}
        />
        <Descriptions
          size="small"
          column={2}
          bordered
          items={[
            { key: 'policies', label: 'Policies', children: summary.policies },
            { key: 'grants', label: 'Tool grants', children: summary.grants },
            { key: 'bindings', label: 'Skill bindings', children: summary.bindings },
            { key: 'approvals', label: 'Approvals', children: approvalCount },
          ]}
        />
        <Descriptions
          size="small"
          column={2}
          bordered
          items={[
            { key: 'upstreams', label: 'LLM upstreams', children: summary.upstreams },
            { key: 'modelRoutes', label: 'Model routes', children: summary.modelRoutes },
            { key: 'modelCalls', label: 'Model calls', children: modelCallCount },
            { key: 'successRate', label: 'Success', children: successRate },
          ]}
        />
      </div>
      <Space wrap>
        <Button
          icon={<LinkOutlined />}
          disabled={!canUseRelay}
          onClick={() => onNavigate(gatewaySectionPaths.relay)}
        >
          模型中转
        </Button>
        <Button
          icon={<SafetyCertificateOutlined />}
          onClick={() => onNavigate(gatewaySectionPaths.manifest)}
        >
          能力清单
        </Button>
        <Button
          icon={<LinkOutlined />}
          disabled={!canManage}
          onClick={() => onNavigate(gatewaySectionPaths.clients)}
        >
          AI Clients
        </Button>
        <Button icon={<KeyOutlined />} onClick={() => onNavigate(gatewaySectionPaths.tokens)}>
          Tokens
        </Button>
        <Button
          icon={<StopOutlined />}
          disabled={!canManage}
          onClick={() => onNavigate(gatewaySectionPaths.governance)}
        >
          Governance
        </Button>
        <Button
          icon={<HistoryOutlined />}
          disabled={!canManage}
          onClick={() => onNavigate(gatewaySectionPaths['call-logs'])}
        >
          调用日志
        </Button>
      </Space>
    </Space>
  )
}
