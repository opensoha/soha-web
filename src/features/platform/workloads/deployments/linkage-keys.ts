const linkageRoot = ['platform', 'workloads', 'deployments', 'linkage'] as const

export const deploymentLinkageKeys = {
  all: linkageRoot,
  applicationEnvironments: () => [...linkageRoot, 'application-environments'] as const,
  applications: () => [...linkageRoot, 'applications'] as const,
  builds: () => [...linkageRoot, 'builds'] as const,
  workflows: () => [...linkageRoot, 'workflows'] as const,
  releases: () => [...linkageRoot, 'releases'] as const,
}
