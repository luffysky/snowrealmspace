'use client'

import { useCallback } from 'react'
import { RichEditor as SdkRichEditor } from '@snowrealm/rich-editor'
import { useDialog } from '@/components/ui/DialogProvider'

/**
 * Web 端薄包裝：注入本站的對話框（useDialog）作為 SDK 的 `promptLink`，
 * 並固定 Giphy 代理端點。實作在 `@snowrealm/rich-editor`。
 */
export function RichEditor(props: {
  value: string
  onChange: (html: string) => void
  placeholder?: string
}) {
  const { prompt } = useDialog()
  const promptLink = useCallback(
    (message: string) => prompt({ title: '插入', message, placeholder: 'https://…' }),
    [prompt],
  )
  return <SdkRichEditor {...props} promptLink={promptLink} giphyEndpoint="/api/giphy" />
}
