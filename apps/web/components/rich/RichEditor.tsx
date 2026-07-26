'use client'

import { useEffect } from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import { useDialog } from '@/components/ui/DialogProvider'
import { EmojiPicker } from './EmojiPicker'
import { GifPicker } from './GifPicker'

/**
 * 共用富文本輸入（tiptap v3）。輸出 HTML 字串（value 進 / onChange 出）。
 * 相容純文字欄位：純文字放進來沒有標籤，照樣渲染；新內容存 HTML。
 * emoji 直接插字元；GIF 以 <img> 節點插入（顯示端 sanitize 後 dangerouslySetInnerHTML）。
 */
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
    immediatelyRender: false, // Next SSR：避免 hydration 不一致
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      Image,
      Placeholder.configure({ placeholder: placeholder ?? '寫點什麼…' }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  })

  // 外部 value 變了（例如送出後清空）就同步進來
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || '')
    }
  }, [value, editor])

  if (!editor) return <div className="sr-rich sr-rich-loading" aria-busy="true" />

  return (
    <div className="sr-rich">
      <div className="sr-rich-toolbar">
        <ToolBtn editor={editor} active={editor.isActive('bold')} label="B" title="粗體" onClick={() => editor.chain().focus().toggleBold().run()} />
        <ToolBtn editor={editor} active={editor.isActive('italic')} label="I" title="斜體" onClick={() => editor.chain().focus().toggleItalic().run()} />
        <ToolBtn editor={editor} active={editor.isActive('underline')} label="U" title="底線" onClick={() => editor.chain().focus().toggleUnderline().run()} />
        <ToolBtn editor={editor} active={editor.isActive('bulletList')} label="•" title="項目符號" onClick={() => editor.chain().focus().toggleBulletList().run()} />
        <ToolBtn
          editor={editor}
          active={editor.isActive('link')}
          label="🔗"
          title="連結"
          onClick={async () => {
            if (editor.isActive('link')) {
              editor.chain().focus().unsetLink().run()
              return
            }
            const url = await prompt({ title: '插入連結', message: '網址', placeholder: 'https://…' })
            if (url && url.trim()) editor.chain().focus().setLink({ href: url.trim() }).run()
          }}
        />
        <EmojiPicker onSelect={(e) => editor.chain().focus().insertContent(e).run()} />
        <GifPicker onSelect={(url) => editor.chain().focus().setImage({ src: url }).run()} />
      </div>
      <EditorContent editor={editor} className="sr-rich-content" />
    </div>
  )
}

function ToolBtn({
  editor,
  active,
  label,
  title,
  onClick,
}: {
  editor: Editor
  active: boolean
  label: string
  title: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={`sr-rich-btn${active ? ' is-active' : ''}`}
      title={title}
      aria-label={title}
      aria-pressed={active}
      // mousedown + preventDefault：不讓工具列奪走編輯器選取焦點
      onMouseDown={(e) => {
        e.preventDefault()
        onClick()
      }}
    >
      {label}
    </button>
  )
}
