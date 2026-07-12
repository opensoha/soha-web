import { api } from '@/services/api-client'
import type { ApiResponse, ResourceYAMLView } from '@/types'
import {
  buildCRDCatalogPath,
  buildCustomResourceCollectionPath,
  buildCustomResourceItemPath,
} from './paths'
import type {
  ApplyCustomResourceVariables,
  CRD,
  CRDResourceInstance,
  CustomResourceTarget,
} from './types'

export async function listCRDs(clusterId: string): Promise<CRD[]> {
  const response = await api.get<ApiResponse<CRD[]>>(buildCRDCatalogPath(clusterId))
  return response.data ?? []
}

export async function listCustomResources(
  clusterId: string,
  crd: CRD,
  namespace?: string | null,
): Promise<CRDResourceInstance[]> {
  const response = await api.get<ApiResponse<CRDResourceInstance[]>>(
    buildCustomResourceCollectionPath(clusterId, crd, namespace),
  )
  return response.data ?? []
}

export async function getCustomResourceYAML(
  target: CustomResourceTarget,
): Promise<ResourceYAMLView> {
  const response = await api.get<ApiResponse<ResourceYAMLView>>(
    buildCustomResourceItemPath(
      target.clusterId,
      target.crd,
      target.resourceName,
      target.namespace,
      'yaml',
    ),
  )
  return response.data
}

export async function applyCustomResource(
  variables: ApplyCustomResourceVariables,
): Promise<ResourceYAMLView> {
  const body = {
    content: variables.content,
    ...(variables.namespace ? { namespace: variables.namespace } : {}),
  }
  const response =
    variables.mode === 'create'
      ? await api.post<ApiResponse<ResourceYAMLView>>(
          buildCustomResourceCollectionPath(
            variables.clusterId,
            variables.crd,
            variables.namespace,
          ),
          body,
        )
      : await api.put<ApiResponse<ResourceYAMLView>>(
          buildCustomResourceItemPath(
            variables.clusterId,
            variables.crd,
            variables.resourceName ?? '',
            variables.namespace,
            'yaml',
          ),
          body,
        )
  return response.data
}

export async function deleteCustomResource(target: CustomResourceTarget): Promise<void> {
  await api.delete(
    buildCustomResourceItemPath(
      target.clusterId,
      target.crd,
      target.resourceName,
      target.namespace,
    ),
  )
}
