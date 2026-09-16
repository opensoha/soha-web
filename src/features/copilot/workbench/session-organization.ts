import type { WorkbenchSession } from './types'

export const PINNED_SESSION_TAG = 'soha:pinned'
const projectPrefix = 'soha:project:'
export const sessionProject = (session: WorkbenchSession) =>
  session.metadata?.tags
    ?.find((tag) => tag.startsWith(projectPrefix))
    ?.slice(projectPrefix.length) ?? ''
export function organizationTags(tags: string[] = [], project: string, pinned: boolean) {
  return [
    ...tags.filter((tag) => tag !== PINNED_SESSION_TAG && !tag.startsWith(projectPrefix)),
    ...(pinned ? [PINNED_SESSION_TAG] : []),
    ...(project.trim() ? [projectPrefix + project.trim().slice(0, 64)] : []),
  ]
}
