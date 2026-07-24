'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Uploader } from './Uploader'
import { AssetGrid, type AssetRow, type AssetActions } from './AssetGrid'
import { ThemeFromImage } from './ThemeFromImage'

type KindFilter = 'all' | 'image' | 'video' | 'pdf'
type ArchivedFilter = 'exclude' | 'only'
type Folder = { id: string; name: string; count: number }
/** 'all' 全部、'none' 未分類、或某個 folder id。 */
type FolderFilter = 'all' | 'none' | string

const KIND_LABEL: Record<KindFilter, string> = {
  all: '全部',
  image: '圖片',
  video: '影片',
  pdf: 'PDF',
}

export function LibraryClient({
  spaceId,
  initialAssets,
}: {
  spaceId: string
  initialAssets: AssetRow[]
}) {
  const router = useRouter()
  const [assets, setAssets] = useState<AssetRow[]>(initialAssets)
  const [selected, setSelected] = useState<AssetRow | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // 篩選狀態
  const [kind, setKind] = useState<KindFilter>('all')
  const [q, setQ] = useState('')
  const [tag, setTag] = useState('')
  const [favorite, setFavorite] = useState(false)
  const [archived, setArchived] = useState<ArchivedFilter>('exclude')
  const [folderFilter, setFolderFilter] = useState<FolderFilter>('all')
  const [folders, setFolders] = useState<Folder[]>([])

  const headers = { 'x-space-id': spaceId }
  const patchHeaders = { ...headers, 'content-type': 'application/json' }

  const loadFolders = useCallback(async () => {
    const res = await fetch('/api/folders', { headers })
    if (!res.ok) return
    const body = (await res.json()) as { data: Folder[] }
    setFolders(body.data)
  }, [spaceId])

  useEffect(() => {
    void loadFolders()
  }, [loadFolders])

  const buildQuery = useCallback(() => {
    const p = new URLSearchParams({ limit: '60', archived })
    if (kind !== 'all') p.set('kind', kind)
    if (q.trim()) p.set('q', q.trim())
    if (tag.trim()) p.set('tag', tag.trim())
    if (favorite) p.set('favorite', 'true')
    if (folderFilter !== 'all') p.set('folder', folderFilter)
    return p.toString()
  }, [kind, q, tag, favorite, archived, folderFilter])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/assets?${buildQuery()}`, { headers })
      if (!res.ok) return
      const body = (await res.json()) as { data: AssetRow[] }
      setAssets(body.data)
    } finally {
      setLoading(false)
    }
  }, [buildQuery])

  // 篩選改變 → 重新查詢（搜尋框做 300ms debounce）
  const firstRun = useRef(true)
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false
      return
    }
    const t = setTimeout(() => void refresh(), 300)
    return () => clearTimeout(t)
  }, [refresh])

  // 上傳完成、縮圖仍在處理時定期刷新
  useEffect(() => {
    const waiting = assets.some((a) => a.width === null && a.kind === 'image')
    if (!waiting) return
    const timer = setInterval(() => void refresh(), 3000)
    return () => clearInterval(timer)
  }, [assets, refresh])

  async function patchAsset(asset: AssetRow, patch: Record<string, unknown>): Promise<AssetRow | null> {
    const res = await fetch(`/api/assets/${asset.id}`, {
      method: 'PATCH',
      headers: patchHeaders,
      body: JSON.stringify(patch),
    })
    if (!res.ok) {
      setNotice('✕ 更新失敗。')
      return null
    }
    const body = (await res.json()) as { data: Partial<AssetRow> }
    return { ...asset, ...body.data }
  }

  function applyLocal(updated: AssetRow) {
    setAssets((prev) => {
      // 變更後若與目前篩選不符就從清單移除（封存、收藏、資料夾）
      const stillMatches =
        archived === 'only' ? updated.archived_at !== null : updated.archived_at === null
      const favMatches = !favorite || updated.is_favorite
      const folderMatches =
        folderFilter === 'all'
          ? true
          : folderFilter === 'none'
            ? updated.folder_id === null
            : updated.folder_id === folderFilter
      if (!stillMatches || !favMatches || !folderMatches) return prev.filter((a) => a.id !== updated.id)
      return prev.map((a) => (a.id === updated.id ? updated : a))
    })
  }

  async function createFolder(name: string): Promise<Folder | null> {
    const res = await fetch('/api/folders', {
      method: 'POST',
      headers: patchHeaders,
      body: JSON.stringify({ name }),
    })
    if (!res.ok) {
      setNotice('✕ 建立資料夾失敗。')
      return null
    }
    const body = (await res.json()) as { data: Folder }
    setFolders((prev) => [...prev, body.data].sort((a, b) => a.name.localeCompare(b.name)))
    return body.data
  }

  async function newFolderPrompt() {
    const name = window.prompt('新資料夾名稱', '')
    if (name === null || !name.trim()) return
    const created = await createFolder(name.trim())
    if (created) setNotice(`已建立資料夾「${created.name}」。`)
  }

  async function renameFolder(f: Folder) {
    const name = window.prompt('資料夾新名稱', f.name)
    if (name === null || !name.trim()) return
    const res = await fetch(`/api/folders/${f.id}`, {
      method: 'PATCH',
      headers: patchHeaders,
      body: JSON.stringify({ name: name.trim() }),
    })
    if (!res.ok) {
      setNotice('✕ 改名失敗。')
      return
    }
    await loadFolders()
  }

  async function deleteFolder(f: Folder) {
    if (!window.confirm(`刪除資料夾「${f.name}」？裡面的檔案會移回未分類，不會被刪除。`)) return
    const res = await fetch(`/api/folders/${f.id}`, { method: 'DELETE', headers })
    if (!res.ok) {
      setNotice('✕ 刪除失敗。')
      return
    }
    if (folderFilter === f.id) setFolderFilter('all')
    await loadFolders()
    void refresh()
  }

  const actions: AssetActions = {
    onSelect: (a) => setSelected(a.kind === 'image' ? a : null),
    onDelete: (a) => void handleDelete(a),
    onToggleFavorite: async (a) => {
      const u = await patchAsset(a, { isFavorite: !a.is_favorite })
      if (u) applyLocal(u)
    },
    onToggleArchive: async (a) => {
      const u = await patchAsset(a, { archived: a.archived_at === null })
      if (u) {
        applyLocal(u)
        setNotice(u.archived_at ? '已封存。' : '已取消封存。')
      }
    },
    onEditTags: async (a) => {
      const raw = window.prompt('標籤（逗號分隔）', a.tags.join(', '))
      if (raw === null) return
      const tags = raw
        .split(/[\s,\uFF0C\u3000]+/)
        .map((t) => t.trim())
        .filter(Boolean)
      const u = await patchAsset(a, { tags })
      if (u) applyLocal(u)
    },
    onRename: async (a) => {
      const name = window.prompt('新檔名', a.original_filename ?? '')
      if (name === null || !name.trim()) return
      const u = await patchAsset(a, { originalFilename: name.trim() })
      if (u) applyLocal(u)
    },
    onCreateWork: async (a) => {
      const title = window.prompt('作品標題', a.original_filename ?? '')
      if (title === null || !title.trim()) return
      const res = await fetch('/api/design/files', {
        method: 'POST',
        headers: patchHeaders,
        body: JSON.stringify({ assetId: a.id, title: title.trim() }),
      })
      if (!res.ok) {
        const body: unknown = await res.json().catch(() => null)
        const msg = (body as { error?: { message?: string } } | null)?.error?.message ?? '建立失敗。'
        setNotice(`✕ ${msg}`)
        return
      }
      setNotice('已建立作品，可到「作品」頁管理版本與比較。')
    },
    onMoveToFolder: async (a) => {
      const lines = [
        '移到哪個資料夾？輸入編號：',
        '0. 未分類（移出）',
        ...folders.map((f, i) => `${i + 1}. ${f.name}`),
        '',
        '或直接輸入新資料夾名稱來建立並移入',
      ]
      const raw = window.prompt(lines.join('\n'), '')
      if (raw === null) return
      const trimmed = raw.trim()
      if (trimmed === '') return

      let folderId: string | null = null
      if (/^\d+$/.test(trimmed)) {
        const num = Number(trimmed)
        if (num === 0) folderId = null
        else {
          const f = folders[num - 1]
          if (!f) {
            setNotice('✕ 沒有這個編號。')
            return
          }
          folderId = f.id
        }
      } else {
        const created = await createFolder(trimmed)
        if (!created) return
        folderId = created.id
      }

      const u = await patchAsset(a, { folderId })
      if (u) {
        applyLocal(u)
        void loadFolders()
        setNotice(folderId ? '已移到資料夾。' : '已移出資料夾。')
      }
    },
    onTagClick: (t) => setTag(t),
  }

  async function handleDelete(asset: AssetRow, cascade = false) {
    const res = await fetch(`/api/assets/${asset.id}${cascade ? '?cascade=true' : ''}`, {
      method: 'DELETE',
      headers,
    })
    const body: unknown = await res.json().catch(() => null)

    if (res.status === 409) {
      const details = (body as { error?: { details?: { references?: { label: string }[] } } })
        ?.error?.details
      const labels = (details?.references ?? []).map((r) => r.label).join('、')
      const confirmed = window.confirm(
        `這個檔案還在使用中：\n${labels}\n\n一併移除這些引用並刪除嗎？`,
      )
      if (confirmed) await handleDelete(asset, true)
      return
    }

    if (!res.ok) {
      const message =
        (body as { error?: { message?: string } } | null)?.error?.message ?? '刪除失敗。'
      setNotice(`✕ ${message}`)
      return
    }

    setAssets((prev) => prev.filter((a) => a.id !== asset.id))
    if (selected?.id === asset.id) setSelected(null)
    setNotice('已刪除。30 天內都還可以復原。')
  }

  // 目前檢視中用到的標籤（去重、排序），供「點一下就篩選」的分類 chips
  const tagsInView = Array.from(new Set(assets.flatMap((a) => a.tags))).sort().slice(0, 30)

  return (
    <div className="sr-stack">
      {notice && (
        <p className="sr-message sr-message-info" role="status">
          {notice}
        </p>
      )}

      <div data-tour="uploader">
        <Uploader spaceId={spaceId} onUploaded={() => void refresh()} />
      </div>

      {/* ── 篩選列 ─────────────────────────────────── */}
      <div className="sr-card sr-stack" style={{ gap: 'var(--sr-space-3)' }}>
        {/* 資料夾 */}
        <div className="sr-stack" style={{ gap: 'var(--sr-space-2)' }} data-tour="folders">
          <div className="sr-chip-row" role="group" aria-label="依資料夾篩選">
            <button
              type="button"
              className={`sr-chip${folderFilter === 'all' ? ' sr-chip-active' : ''}`}
              onClick={() => setFolderFilter('all')}
            >
              全部
            </button>
            <button
              type="button"
              className={`sr-chip${folderFilter === 'none' ? ' sr-chip-active' : ''}`}
              onClick={() => setFolderFilter('none')}
            >
              未分類
            </button>
            {folders.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`sr-chip${folderFilter === f.id ? ' sr-chip-active' : ''}`}
                onClick={() => setFolderFilter(f.id)}
              >
                📁 {f.name} {f.count > 0 && <span className="sr-muted">({f.count})</span>}
              </button>
            ))}
            <button type="button" className="sr-chip" onClick={() => void newFolderPrompt()}>
              ＋ 新增資料夾
            </button>
          </div>
          {/* 選了某個資料夾時，提供改名/刪除 */}
          {folderFilter !== 'all' &&
            folderFilter !== 'none' &&
            (() => {
              const f = folders.find((x) => x.id === folderFilter)
              if (!f) return null
              return (
                <div className="sr-chip-row">
                  <button type="button" className="sr-chip" onClick={() => void renameFolder(f)}>
                    改名「{f.name}」
                  </button>
                  <button type="button" className="sr-chip" onClick={() => void deleteFolder(f)}>
                    刪除資料夾
                  </button>
                </div>
              )
            })()}
        </div>

        <div className="sr-chip-row" role="group" aria-label="依類型篩選">
          {(Object.keys(KIND_LABEL) as KindFilter[]).map((k) => (
            <button
              key={k}
              type="button"
              className={`sr-chip${kind === k ? ' sr-chip-active' : ''}`}
              onClick={() => setKind(k)}
            >
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>

        <div className="sr-form-cols">
          <label className="sr-field">
            <span>搜尋檔名</span>
            <input
              className="sr-input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="輸入關鍵字…"
            />
          </label>
          <label className="sr-field">
            <span>標籤</span>
            <input
              className="sr-input"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="單一標籤"
            />
          </label>
        </div>

        {/* 標籤分類：目前檔案用到的標籤，點一下就篩選 */}
        {tagsInView.length > 0 && (
          <div className="sr-chip-row" role="group" aria-label="依標籤篩選" data-tour="tag-filter">
            {tag.trim() && (
              <button type="button" className="sr-chip sr-chip-active" onClick={() => setTag('')}>
                #{tag} ✕
              </button>
            )}
            {tagsInView
              .filter((t) => t !== tag.trim())
              .map((t) => (
                <button key={t} type="button" className="sr-chip sr-chip-tag" onClick={() => setTag(t)}>
                  #{t}
                </button>
              ))}
          </div>
        )}

        <div className="sr-chip-row">
          <button
            type="button"
            className={`sr-chip${favorite ? ' sr-chip-active' : ''}`}
            onClick={() => setFavorite((v) => !v)}
            aria-pressed={favorite}
          >
            ★ 只看收藏
          </button>
          <button
            type="button"
            className={`sr-chip${archived === 'only' ? ' sr-chip-active' : ''}`}
            onClick={() => setArchived((v) => (v === 'only' ? 'exclude' : 'only'))}
            aria-pressed={archived === 'only'}
          >
            封存區
          </button>
        </div>
      </div>

      {selected && (
        <ThemeFromImage
          spaceId={spaceId}
          asset={selected}
          onClose={() => setSelected(null)}
          onCreated={() => {
            setSelected(null)
            router.refresh()
          }}
        />
      )}

      <AssetGrid
        spaceId={spaceId}
        assets={assets}
        actions={actions}
        selectedId={selected?.id ?? null}
        loading={loading}
      />
    </div>
  )
}
