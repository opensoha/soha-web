import { message } from 'antd'
import { K8sYamlEditor } from '@/components/k8s-yaml-editor'
import { useI18n } from '@/i18n'

export default function StorageYAMLPanel({
  applying,
  draft,
  onApply,
  onChange,
  onReset,
}: {
  applying: boolean
  draft: string
  onApply: () => void
  onChange: (value: string) => void
  onReset: () => void
}) {
  const { localeCode } = useI18n()
  return (
    <div style={{ height: 620 }}>
      <K8sYamlEditor
        value={draft}
        onChange={onChange}
        onReset={onReset}
        onSave={() =>
          void message.info(
            localeCode === 'zh_CN' ? '暂不支持本地草稿' : 'Local draft save disabled here',
          )
        }
        onApply={onApply}
        saveDisabled
        applyDisabled={!draft.trim()}
        applying={applying}
      />
    </div>
  )
}
