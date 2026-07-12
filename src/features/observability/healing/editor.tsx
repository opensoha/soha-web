import { useEffect, useState } from 'react'
import { ReleaseFlowDagEditor } from '@/components/release-flow-dag-editor'
import {
  createDefaultReleaseDagDefinition,
  normalizeReleaseDagDefinition,
  type ReleaseDagDefinition,
} from '@/components/release-flow-dag-definition'

export default function HealingDagEditor({
  initialDefinition,
  onChange,
}: {
  initialDefinition?: ReleaseDagDefinition
  onChange: (definition: ReleaseDagDefinition) => void
}) {
  const [definition, setDefinition] = useState(() =>
    normalizeReleaseDagDefinition(initialDefinition ?? createDefaultReleaseDagDefinition()),
  )

  useEffect(() => onChange(definition), [definition, onChange])

  return (
    <ReleaseFlowDagEditor initialDefinition={definition} onChange={(next) => setDefinition(next)} />
  )
}
