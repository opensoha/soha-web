import type {
  CompanionInteractionReceipt,
  CompanionPackManifest,
  CompanionProfile,
  InstalledPlugin,
} from '@opensoha/contracts/gen/ts/sohaapi'

export type CompanionVisualState =
  | 'disabled'
  | 'error'
  | 'dragging'
  | 'thinking'
  | 'speaking'
  | 'listening'
  | 'hover'
  | 'idle'

export interface CompanionPackSelection {
  manifest: CompanionPackManifest
  pluginId: string
  version: string
  installed?: InstalledPlugin
}

export type { CompanionInteractionReceipt, CompanionPackManifest, CompanionProfile }
