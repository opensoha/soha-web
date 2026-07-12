import { Button } from 'antd'
import { ManagementKeywordField, ManagementQueryPanel } from '@/components/management-list'
import { useI18n } from '@/i18n'

interface ResourceQueryPanelProps {
  placeholder: string
  searchKeyword: string
  setSearchKeyword: (value: string) => void
}

export function ResourceQueryPanel({
  placeholder,
  searchKeyword,
  setSearchKeyword,
}: ResourceQueryPanelProps) {
  const { localeCode } = useI18n()

  return (
    <ManagementQueryPanel
      onFinish={() => undefined}
      actions={
        <>
          <Button
            autoInsertSpace={false}
            disabled={!searchKeyword.trim()}
            htmlType="button"
            onClick={() => setSearchKeyword('')}
          >
            {localeCode === 'zh_CN' ? '重置' : 'Reset'}
          </Button>
          <Button autoInsertSpace={false} htmlType="submit" type="primary">
            {localeCode === 'zh_CN' ? '查询' : 'Search'}
          </Button>
        </>
      }
    >
      <ManagementKeywordField
        label={localeCode === 'zh_CN' ? '关键词' : 'Keyword'}
        value={searchKeyword}
        onChange={setSearchKeyword}
        placeholder={placeholder}
        inputProps={{
          className: 'soha-platform-compact-field soha-workload-search-input',
          size: 'small',
        }}
      />
    </ManagementQueryPanel>
  )
}
