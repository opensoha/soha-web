import { ArrowRightOutlined } from '@ant-design/icons'
import { MetadataTag } from '@/components/status-tag'
import type { MetadataTagTone } from '@/components/status-tag'
import type { ServicePortMapping } from './types'
import './styles.css'

function serviceTypeTone(type: string): MetadataTagTone {
  switch (type) {
    case 'NodePort':
      return 'gold'
    case 'LoadBalancer':
      return 'cyan'
    case 'ExternalName':
      return 'purple'
    case 'ClusterIP':
      return 'blue'
    default:
      return 'default'
  }
}

export function ServiceTypeTag({ type }: { type: string }) {
  return <MetadataTag label={type || '-'} tone={serviceTypeTone(type)} />
}

function PortArrow() {
  return <ArrowRightOutlined aria-hidden className="soha-service-port-arrow" />
}

export function ServicePortDisplay({
  portMappings,
  ports,
}: {
  portMappings?: ServicePortMapping[]
  ports?: string[]
}) {
  if (!portMappings?.length) return ports?.join(', ') || '-'

  return (
    <span className="soha-service-port-list">
      {portMappings.map((mapping, index) => (
        <span
          className="soha-service-port-chain"
          key={`${mapping.name ?? ''}-${mapping.port}-${mapping.protocol}-${index}`}
        >
          {mapping.nodePort ? (
            <>
              <MetadataTag label={`NodePort: ${mapping.nodePort}`} tone="gold" />
              <PortArrow />
            </>
          ) : null}
          <MetadataTag
            label={`Port: ${mapping.name ? `${mapping.name} · ` : ''}${mapping.port}/${mapping.protocol}`}
            tone="blue"
          />
          <PortArrow />
          <MetadataTag label={`TargetPort: ${mapping.targetPort}`} tone="cyan" />
        </span>
      ))}
    </span>
  )
}
