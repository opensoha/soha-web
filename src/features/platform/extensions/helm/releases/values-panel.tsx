import { Alert } from 'antd'
import { YamlDraftDiffEditor } from '@/components/yaml-draft-diff-editor'
import { useI18n } from '@/i18n'

interface HelmReleaseValuesPanelProps {
  applyDisabled: boolean
  applying: boolean
  canEdit: boolean
  draft: string
  error?: Error | null
  onApply: () => void
  onChange: (value: string) => void
  onReset: () => void
  original: string
}

export function HelmReleaseValuesPanel({
  applyDisabled,
  applying,
  canEdit,
  draft,
  error,
  onApply,
  onChange,
  onReset,
  original,
}: HelmReleaseValuesPanelProps) {
  const { t, localeCode } = useI18n()
  if (error) {
    return (
      <Alert
        type="error"
        showIcon
        title={localeCode === 'zh_CN' ? 'values.yaml 加载失败' : 'Failed to load values.yaml'}
        description={error.message}
      />
    )
  }
  return (
    <YamlDraftDiffEditor
      title="values.yaml"
      description={t(
        'page.extensions.helm.valuesDesc',
        'Edit the values.yaml draft on the left; compare it against the Helm runtime values on the right before applying changes.',
      )}
      original={original}
      modified={draft}
      onChange={onChange}
      onReset={onReset}
      onApply={canEdit ? onApply : undefined}
      applying={applying}
      applyDisabled={applyDisabled}
      leftLabel={t('yamlDiffEditor.draftLabel', 'Values draft')}
      rightLabel={t('yamlDiffEditor.runtimeLabel', 'Helm runtime values')}
      editable={canEdit}
      saveDisabled
    />
  )
}
