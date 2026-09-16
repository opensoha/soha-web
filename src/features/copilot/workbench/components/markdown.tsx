import { createContext, useContext, useMemo, type CSSProperties } from 'react'
import { theme } from 'antd'
import { XMarkdown, type ComponentProps, type XMarkdownProps } from '@ant-design/x-markdown'
import type { WorkbenchSource } from '@opensoha/contracts/gen/ts/sohaapi'
import '@ant-design/x-markdown/themes/light.css'

const noSources: WorkbenchSource[] = []
const SourceContext = createContext<{
  sources: WorkbenchSource[]
  onSource?: (source: WorkbenchSource) => void
}>({ sources: noSources })

const citationConfig: XMarkdownProps['config'] = {
  extensions: [
    {
      name: 'sohaCitation',
      level: 'inline',
      start: (source) => source.search(/(?:\[|【)citation:/),
      tokenizer(source) {
        const match = /^(?:\[|【)citation:([a-zA-Z0-9:_-]{1,180})(?:\]|】)/.exec(source)
        if (match) return { type: 'sohaCitation', raw: match[0], citationId: match[1] }
      },
      renderer: (token) =>
        `<a href="#soha-citation:${encodeURIComponent(String(token.citationId))}">[来源]</a>`,
    },
  ],
}

export function safeSourceURL(value: unknown) {
  if (typeof value !== 'string') return undefined
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
      ? url.href
      : undefined
  } catch {
    return undefined
  }
}

function MarkdownLink({ href, children }: ComponentProps<{ href?: string }>) {
  const { sources, onSource } = useContext(SourceContext)
  if (href?.startsWith('#soha-citation:')) {
    const id = href.slice('#soha-citation:'.length)
    const index = sources.findIndex(
      (source) =>
        encodeURIComponent(source.id) === id ||
        encodeURIComponent(source.id) === `citation%3A${id}`,
    )
    const source = sources[index]
    return source && onSource ? (
      <button
        type="button"
        className="soha-ai-citation"
        aria-label={`查看来源：${source.title}`}
        onClick={() => onSource(source)}
      >
        [{index + 1}]
      </button>
    ) : (
      <span title="未找到对应来源">[来源未验证]</span>
    )
  }
  const url = safeSourceURL(href)
  return url ? (
    <a href={url} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ) : (
    <span>{children}</span>
  )
}

function MarkdownImage({ alt }: ComponentProps<{ alt?: string }>) {
  return <span>{alt ? `图片：${alt}` : '图片链接'}</span>
}

const markdownComponents = { a: MarkdownLink, img: MarkdownImage }

export function WorkbenchMarkdown({
  content,
  streaming = false,
  sources = noSources,
  onSource,
}: {
  content: string
  streaming?: boolean
  sources?: WorkbenchSource[]
  onSource?: (source: WorkbenchSource) => void
}) {
  const { token } = theme.useToken()
  const context = useMemo(() => ({ sources, onSource }), [sources, onSource])
  return (
    <SourceContext.Provider value={context}>
      <XMarkdown
        content={content}
        className="x-markdown-light soha-ai-markdown"
        escapeRawHtml
        config={citationConfig}
        components={markdownComponents}
        streaming={{ hasNextChunk: streaming }}
        style={
          {
            '--text-color': token.colorText,
            '--heading-color': token.colorTextHeading,
            '--primary-color': token.colorLink,
            '--primary-color-hover': token.colorLinkHover,
            '--border-color': token.colorBorderSecondary,
            '--line-color': token.colorBorderSecondary,
            '--light-bg': token.colorFillTertiary,
            '--table-head-bg': token.colorFillAlter,
            '--table-body-bg': token.colorBgContainer,
            '--cite-bg': token.colorFillSecondary,
            '--cite-hover-bg': token.colorFill,
          } as CSSProperties
        }
      />
    </SourceContext.Provider>
  )
}
