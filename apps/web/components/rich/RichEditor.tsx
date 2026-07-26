'use client'

import { useEffect } from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import CharacterCount from '@tiptap/extension-character-count'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableCell } from '@tiptap/extension-table-cell'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { createLowlight, common } from 'lowlight'
import { Markdown } from 'tiptap-markdown'
import { useDialog } from '@/components/ui/DialogProvider'
import { EmojiPicker } from './EmojiPicker'
import { GifPicker } from './GifPicker'

/**
 * 共用富文本輸入（tiptap v3）。輸出 HTML（value 進 / onChange 出）。
 *
 * 功能對齊 AI 島的富文本：標題、粗/斜/底線/刪除線/行內碼、螢光筆、文字顏色、對齊、
 * 項目/編號/待辦清單、引言、程式碼區塊（語法高亮）、連結、圖片、表格、Markdown 貼上、字數。
 * 加上本專案的表情與 GIF。存 HTML，顯示端 sanitize（見 lib/rich-html.ts）。
 */

const lowlight = createLowlight(common)

const MAX_CHARS = 20000

export function RichEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (html: string) => void
  placeholder?: string
}) {
  const { prompt } = useDialog()

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ codeBlock: false }), // codeBlock 由 lowlight 版取代
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      Image,
      Placeholder.configure({ placeholder: placeholder ?? '寫點什麼…' }),
      Highlight,
      TextStyle,
      Color,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      CodeBlockLowlight.configure({ lowlight }),
      CharacterCount.configure({ limit: MAX_CHARS }),
      Markdown.configure({ html: true, transformPastedText: true }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  })

  useEffect(() => {
    if (editor && value !== editor.getHTML()) editor.commands.setContent(value || '')
  }, [value, editor])

  if (!editor) return <div className="sr-rich sr-rich-loading" aria-busy="true" />

  const chars = editor.storage.characterCount?.characters?.() ?? 0

  return (
    <div className="sr-rich">
      <div className="sr-rich-toolbar">
        {/* 標題 / 段落 */}
        <B ed={editor} on={() => editor.chain().focus().setParagraph().run()} active={editor.isActive('paragraph')} t="內文">
          ¶
        </B>
        <B ed={editor} on={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} t="標題 1">
          H1
        </B>
        <B ed={editor} on={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} t="標題 2">
          H2
        </B>
        <B ed={editor} on={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} t="標題 3">
          H3
        </B>
        <span className="sr-rich-sep" />
        {/* 行內樣式 */}
        <B ed={editor} on={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} t="粗體">
          B
        </B>
        <B ed={editor} on={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} t="斜體">
          <i>I</i>
        </B>
        <B ed={editor} on={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} t="底線">
          <u>U</u>
        </B>
        <B ed={editor} on={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} t="刪除線">
          <s>S</s>
        </B>
        <B ed={editor} on={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} t="行內碼">
          {'</>'}
        </B>
        <B ed={editor} on={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive('highlight')} t="螢光筆">
          🖍
        </B>
        <label className="sr-rich-btn" title="文字顏色" style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
          🎨
          <input
            type="color"
            style={{ width: 0, height: 0, opacity: 0, position: 'absolute' }}
            onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
          />
        </label>
        <span className="sr-rich-sep" />
        {/* 對齊 */}
        <B ed={editor} on={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} t="靠左">
          ⯇
        </B>
        <B ed={editor} on={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} t="置中">
          ≡
        </B>
        <B ed={editor} on={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} t="靠右">
          ⯈
        </B>
        <span className="sr-rich-sep" />
        {/* 清單 / 區塊 */}
        <B ed={editor} on={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} t="項目清單">
          •
        </B>
        <B ed={editor} on={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} t="編號清單">
          1.
        </B>
        <B ed={editor} on={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive('taskList')} t="待辦清單">
          ☑
        </B>
        <B ed={editor} on={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} t="引言">
          ❝
        </B>
        <B ed={editor} on={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} t="程式碼區塊">
          {'{ }'}
        </B>
        <B ed={editor} on={() => editor.chain().focus().setHorizontalRule().run()} active={false} t="分隔線">
          —
        </B>
        <span className="sr-rich-sep" />
        {/* 連結 / 圖片 / 表格 */}
        <B
          ed={editor}
          active={editor.isActive('link')}
          t="連結"
          on={async () => {
            if (editor.isActive('link')) {
              editor.chain().focus().unsetLink().run()
              return
            }
            const url = await prompt({ title: '插入連結', message: '網址', placeholder: 'https://…' })
            if (url && url.trim()) editor.chain().focus().setLink({ href: url.trim() }).run()
          }}
        >
          🔗
        </B>
        <B
          ed={editor}
          active={false}
          t="圖片網址"
          on={async () => {
            const url = await prompt({ title: '插入圖片', message: '圖片網址', placeholder: 'https://…' })
            if (url && url.trim()) editor.chain().focus().setImage({ src: url.trim() }).run()
          }}
        >
          🖼
        </B>
        <B ed={editor} active={false} t="插入表格" on={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
          ▦
        </B>
        <EmojiPicker onSelect={(e) => editor.chain().focus().insertContent(e).run()} />
        <GifPicker onSelect={(url) => editor.chain().focus().setImage({ src: url }).run()} />
      </div>
      <EditorContent editor={editor} className="sr-rich-content" />
      <div className="sr-rich-foot">
        <span className={`sr-muted${chars >= MAX_CHARS ? ' sr-rich-over' : ''}`}>{chars} / {MAX_CHARS} 字</span>
      </div>
    </div>
  )
}

/** 工具列按鈕：mousedown+preventDefault 不奪走選取焦點。 */
function B({
  ed: _ed,
  on,
  active,
  t,
  children,
}: {
  ed: Editor
  on: () => unknown
  active: boolean
  t: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      className={`sr-rich-btn${active ? ' is-active' : ''}`}
      title={t}
      aria-label={t}
      aria-pressed={active}
      onMouseDown={(e) => {
        e.preventDefault()
        void on()
      }}
    >
      {children}
    </button>
  )
}
