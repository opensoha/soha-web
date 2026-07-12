import {
  getConfigurationDetail,
  listConfigurationResources,
  updateConfigurationData,
} from '../shared/api'
import type { ConfigurationTarget } from '../shared/types'
import type { ConfigMapDetail, ConfigMapResource, UpdateConfigMapDataPayload } from './types'

export const configMapKind = 'configmaps' as const

export function listConfigMaps(scope: ConfigurationTarget['scope']) {
  return listConfigurationResources<ConfigMapResource>(configMapKind, scope)
}

export function getConfigMapDetail(target: ConfigurationTarget) {
  return getConfigurationDetail<ConfigMapDetail>(configMapKind, target)
}

export function updateConfigMapData(
  target: ConfigurationTarget,
  payload: UpdateConfigMapDataPayload,
) {
  return updateConfigurationData<ConfigMapDetail, UpdateConfigMapDataPayload>(
    configMapKind,
    target,
    payload,
  )
}
