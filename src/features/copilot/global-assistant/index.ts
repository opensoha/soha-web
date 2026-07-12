export type {
  AIGlobalAssistantAction,
  AIGlobalAssistantLaunchRequest,
  AIPageContext,
  AISelectedTextKind,
  AISelectionContext,
  AIWorkbenchSource,
} from './ai-context'
export {
  contextIdentityKey,
  encodeAIContextForElement,
  inferSelectionKind,
  sanitizeSelectionText,
  workbenchScopeFromAIContext,
} from './ai-context'
export { useAIGlobalAssistant, useAIPageContext } from './ai-context-provider'
export { GlobalAIAssistantProvider } from './ai-global-assistant-provider'
export {
  clampFloatPosition,
  defaultFloatPosition,
  snapFloatPosition,
  type FloatPosition,
} from './draggable-float-shell'
