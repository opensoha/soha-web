import {
  getConfigurationDetail,
  listConfigurationResources,
  updateConfigurationData,
} from '../shared/api'
import type { ConfigurationTarget } from '../shared/types'
import type { SecretDetail, SecretResource, UpdateSecretDataPayload } from './types'

export const secretKind = 'secrets' as const

export function listSecrets(scope: ConfigurationTarget['scope']) {
  return listConfigurationResources<SecretResource>(secretKind, scope)
}

export function getSecretDetail(target: ConfigurationTarget) {
  return getConfigurationDetail<SecretDetail>(secretKind, target)
}

export function updateSecretData(target: ConfigurationTarget, payload: UpdateSecretDataPayload) {
  return updateConfigurationData<SecretDetail, UpdateSecretDataPayload>(secretKind, target, payload)
}
