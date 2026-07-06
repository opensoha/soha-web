import { createContext, useContext, useEffect, useRef } from 'react'
import type { AIGlobalAssistantLaunchRequest, AIPageContext } from './ai-context'
import { contextIdentityKey } from './ai-context'

export interface AIPageContextRegistryValue {
  currentContext: AIPageContext
  launchAssistant: (request: AIGlobalAssistantLaunchRequest) => Promise<void>
  openAssistant: () => void
  openWorkbench: () => void
  registerPageContext: (id: string, context: AIPageContext, key: string) => () => void
}

export const AIPageContextRegistry = createContext<AIPageContextRegistryValue | null>(null)

function nextContextId() {
  return `ai-context-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function useAIPageContext(context: AIPageContext) {
  const registry = useContext(AIPageContextRegistry)
  const idRef = useRef(nextContextId())
  const contextRef = useRef(context)
  const key = contextIdentityKey(context)
  contextRef.current = context

  useEffect(() => {
    if (!registry) return undefined
    return registry.registerPageContext(idRef.current, contextRef.current, key)
  }, [key, registry])
}

export function useAIGlobalAssistant() {
  return useContext(AIPageContextRegistry)
}
