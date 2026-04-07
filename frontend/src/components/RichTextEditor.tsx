import { useEffect, useMemo, useRef, useState } from 'react'

function exec(cmd: string, value?: string) {
  try {
    document.execCommand(cmd, false, value)
  } catch {
    // ignore
  }
}

export function RichTextEditor({
  html,
  onChange,
  placeholder,
}: {
  html: string
  onChange: (nextHtml: string) => void
  placeholder?: string
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const placeholderText = useMemo(() => placeholder || '', [placeholder])
  const [state, setState] = useState({
    bold: false,
    italic: false,
    underline: false,
    ul: false,
    ol: false,
  })
  const [isEmpty, setIsEmpty] = useState(true)

  const computeEmpty = () => {
    const el = ref.current
    if (!el) return true
    const text = (el.textContent || '').replace(/\u00a0/g, ' ').trim()
    if (text) return false
    const html = (el.innerHTML || '').replace(/\s+/g, '')
    return html === '' || html === '<br>' || html === '<div><br></div>'
  }

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // Only sync when editor is not focused (avoid cursor jumps)
    const active = document.activeElement === el
    if (!active && el.innerHTML !== html) el.innerHTML = html || ''
    setIsEmpty(computeEmpty())
  }, [html])

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const update = () => {
      if (document.activeElement !== el) return
      setState({
        bold: !!document.queryCommandState('bold'),
        italic: !!document.queryCommandState('italic'),
        underline: !!document.queryCommandState('underline'),
        ul: !!document.queryCommandState('insertUnorderedList'),
        ol: !!document.queryCommandState('insertOrderedList'),
      })
    }

    document.addEventListener('selectionchange', update)
    el.addEventListener('keyup', update)
    el.addEventListener('mouseup', update)
    el.addEventListener('focus', update)
    return () => {
      document.removeEventListener('selectionchange', update)
      el.removeEventListener('keyup', update)
      el.removeEventListener('mouseup', update)
      el.removeEventListener('focus', update)
    }
  }, [])

  const btn = (active: boolean) => `rteBtn ${active ? 'rteBtnActive' : ''}`

  return (
    <div className="rte">
      <div className="rteToolbar row" style={{ gap: 8 }}>
        <button className={btn(state.bold)} type="button" title="Bold" onClick={() => exec('bold')}>
          B
        </button>
        <button className={btn(state.italic)} type="button" title="Italic" onClick={() => exec('italic')}>
          I
        </button>
        <button className={btn(state.underline)} type="button" title="Underline" onClick={() => exec('underline')}>
          U
        </button>
        <div className="rteSep" />
        <button className={btn(state.ul)} type="button" title="Bullets" onClick={() => exec('insertUnorderedList')}>
          •
        </button>
        <button className={btn(state.ol)} type="button" title="Numbered list" onClick={() => exec('insertOrderedList')}>
          1.
        </button>
        <div className="rteSep" />
        <button
          className={btn(false)}
          type="button"
          title="Insert link"
          onClick={() => {
            const url = window.prompt('Lien / رابط')
            if (!url) return
            exec('createLink', url)
          }}
        >
          Link
        </button>
        <button className={btn(false)} type="button" title="Clear formatting" onClick={() => exec('removeFormat')}>
          Clear
        </button>
      </div>

      <div
        ref={ref}
        className="rteEditor"
        contentEditable
        role="textbox"
        aria-multiline="true"
        data-placeholder={placeholderText}
        data-empty={isEmpty ? '1' : '0'}
        onInput={() => {
          const el = ref.current
          onChange(el ? el.innerHTML : '')
          setIsEmpty(computeEmpty())
        }}
        onBlur={() => {
          const el = ref.current
          onChange(el ? el.innerHTML : '')
          setIsEmpty(computeEmpty())
        }}
        suppressContentEditableWarning
      />
    </div>
  )
}

