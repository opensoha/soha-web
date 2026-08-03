import type { SelectProps } from 'antd'
import { Select } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { buildSecretReference, isSecretReferenceId } from '../api'
import { secretQueries } from '../queries'

export function SecretRefSelect({
  disabled,
  enabled = true,
  value,
  ...props
}: SelectProps<string> & { enabled?: boolean }) {
  const secretsQuery = useQuery(secretQueries.list({}, enabled && !disabled))
  const options = (secretsQuery.data ?? [])
    .filter((secret) => secret.status === 'active' && isSecretReferenceId(secret.id))
    .map((secret) => ({
      label: `${secret.name} · ${secret.scopeType}/${secret.scopeId}`,
      value: buildSecretReference(secret.id),
    }))

  if (value && !options.some((option) => option.value === value)) {
    options.unshift({ label: value, value })
  }

  return (
    <Select
      {...props}
      allowClear
      disabled={disabled}
      loading={secretsQuery.isFetching}
      options={options}
      placeholder={props.placeholder ?? '选择 Secret'}
      showSearch={{ optionFilterProp: 'label' }}
      value={value}
    />
  )
}
