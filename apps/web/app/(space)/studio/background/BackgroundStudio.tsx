'use client'

import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { ALPHA_TRANSITIONS } from '@snowrealm/validation'
import { NEUTRAL, type ThemeDefinition } from '@snowrealm/theme-engine'
import { SCENES, SCENE_CATEGORIES, scenesByCategory, getScene, type SceneCategory } from '@/lib/scenes'
import { LOTTIE_SCENES, getLottieScene } from '@/lib/lottie-scenes'
import type { BackgroundItem } from '@/components/BackgroundLayer'
import { gradientCss } from '@/components/BackgroundLayer'
import { ProceduralScene } from '@/components/ProceduralScene'
import { LottieBackground } from '@/components/LottieBackground'
import { BackgroundEditor } from './BackgroundEditor'
import { BackgroundPreview } from './BackgroundPreview'
import { PlaylistPanel, backgroundLabel, type Playlist } from './PlaylistPanel'

export type AssetOption = {
  id: string
  kind: string
  original_filename: string | null
}

type Status = { kind: 'idle' } | { kind: 'ok'; message: string } | { kind: 'error'; message: string }

// 背景商店的分頁：全部 → 各分類 → Lottie（動畫另成一頁，因為它是不同渲染器）。
type GalleryTab = '全部' | SceneCategory | 'Lottie'
const GALLERY_TABS: readonly GalleryTab[] = ['全部', ...SCENE_CATEGORIES, 'Lottie']

// 卡片上的「＋ 加入我的空間」明確招喚——用 --sr-* token，不寫死顏色。
const adoptAffordanceStyle: CSSProperties = {
  padding: '5px 6px',
  fontSize: 'var(--sr-text-sm)',
  fontWeight: 600,
  textAlign: 'center',
  background: 'var(--sr-accent)',
  color: 'var(--sr-on-accent, #fff)',
}
// 角落「預覽中」小標——低調、不攔截點擊。
const previewBadgeStyle: CSSProperties = {
  position: 'absolute',
  top: '4px',
  left: '4px',
  padding: '1px 6px',
  borderRadius: '999px',
  fontSize: '10px',
  lineHeight: 1.5,
  background: 'var(--sr-surface)',
  color: 'var(--sr-text-secondary)',
  opacity: 0.85,
  pointerEvents: 'none',
}

/**
 * 商店卡片：整張可點＝「採用」（建立 background_item），同時顯示明確的
 * 「＋ 加入我的空間」招喚與「預覽中」小標。媒體是即時預覽（children）。
 * label 用 min-width:0 / overflow-wrap 保證窄卡不撐破 grid。
 */
function AdoptTile({
  label,
  hint,
  onAdopt,
  children,
}: {
  label: string
  hint: string
  onAdopt: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      role="listitem"
      className="sr-scene-tile"
      title={hint}
      aria-label={hint}
      onClick={onAdopt}
    >
      <span className="sr-scene-tile-media">
        {children}
        <span aria-hidden="true" style={previewBadgeStyle}>
          預覽中
        </span>
      </span>
      <span className="sr-scene-tile-label" style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
        {label}
      </span>
      <span aria-hidden="true" style={adoptAffordanceStyle}>
        ＋ 加入我的空間
      </span>
    </button>
  )
}

export function BackgroundStudio({
  spaceId,
  initialBackgrounds,
  initialPlaylists,
  imageAssets,
  activeTheme,
  initialBgLightId,
  initialBgDarkId,
}: {
  spaceId: string
  initialBackgrounds: BackgroundItem[]
  initialPlaylists: Playlist[]
  imageAssets: AssetOption[]
  activeTheme: ThemeDefinition
  initialBgLightId: string | null
  initialBgDarkId: string | null
}) {
  const router = useRouter()
  const [backgrounds, setBackgrounds] = useState(initialBackgrounds)
  const [playlists, setPlaylists] = useState(initialPlaylists)
  const [editing, setEditing] = useState<BackgroundItem | null>(null)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  // 深/淺色模式各自指定的背景 id
  const [bgLightId, setBgLightId] = useState(initialBgLightId)
  const [bgDarkId, setBgDarkId] = useState(initialBgDarkId)
  // 背景商店的分頁：'全部' / 各分類 / 'Lottie'
  const [galleryTab, setGalleryTab] = useState<GalleryTab>('全部')

  // 色調分類（淺/深）：新增時系統先猜，這裡讓使用者手動改。分類供你「淺色從淺色選」。
  async function flipTone(bg: BackgroundItem) {
    const next = (bg.tone ?? 'light') === 'light' ? 'dark' : 'light'
    setBackgrounds((prev) => prev.map((b) => (b.id === bg.id ? { ...b, tone: next } : b)))
    try {
      const res = await fetch(`/api/backgrounds/${bg.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-space-id': spaceId },
        body: JSON.stringify({ tone: next }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setBackgrounds((prev) => prev.map((b) => (b.id === bg.id ? { ...b, tone: bg.tone } : b)))
      setStatus({ kind: 'error', message: '改色調失敗。' })
    }
  }

  // 指定某個背景為淺色/深色模式背景（再按一次取消）。切換到該模式時就會用它。
  async function assignBgForMode(mode: 'light' | 'dark', id: string) {
    const cur = mode === 'light' ? bgLightId : bgDarkId
    const nextId = cur === id ? null : id
    // 樂觀更新
    if (mode === 'light') setBgLightId(nextId)
    else setBgDarkId(nextId)
    try {
      const res = await fetch('/api/space', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(mode === 'light' ? { bgLightItemId: nextId } : { bgDarkItemId: nextId }),
      })
      if (!res.ok) throw new Error()
      setStatus({
        kind: 'ok',
        message: nextId
          ? `已設為${mode === 'light' ? '淺色' : '深色'}模式背景。切到該模式就會用它。`
          : `已取消${mode === 'light' ? '淺色' : '深色'}模式背景指定。`,
      })
    } catch {
      // 回滾
      if (mode === 'light') setBgLightId(cur)
      else setBgDarkId(cur)
      setStatus({ kind: 'error', message: '設定失敗。' })
    }
  }

  const api = useCallback(
    async (path: string, init?: RequestInit) => {
      const res = await fetch(path, {
        ...init,
        headers: {
          'content-type': 'application/json',
          'x-space-id': spaceId,
          ...(init?.headers ?? {}),
        },
      })
      const body: unknown = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(
          (body as { error?: { message?: string } } | null)?.error?.message ?? '操作失敗。',
        )
      }
      return (body as { data: unknown }).data
    },
    [spaceId],
  )

  async function addFromAsset(assetId: string) {
    try {
      // 型別依 asset 的 kind 而定：影片檔要建成 video 背景（否則後端會擋「這個檔案不是圖片」）
      const asset = imageAssets.find((a) => a.id === assetId)
      const type = asset?.kind === 'video' ? 'video' : 'image'
      const created = (await api('/api/backgrounds', {
        method: 'POST',
        body: JSON.stringify({ type, assetId, fit: 'cover' }),
      })) as BackgroundItem
      setBackgrounds((prev) => [created, ...prev])
      setEditing(created)
      setStatus({ kind: 'ok', message: type === 'video' ? '已加入影片背景。' : '已加入背景。' })
    } catch (err) {
      setStatus({ kind: 'error', message: err instanceof Error ? err.message : '加入失敗。' })
    }
  }

  async function addScene(sceneId: string) {
    try {
      const scene = getScene(sceneId)
      const created = (await api('/api/backgrounds', {
        method: 'POST',
        body: JSON.stringify({ type: 'procedural', proceduralId: sceneId, name: scene?.label ?? '動態背景' }),
      })) as BackgroundItem
      setBackgrounds((prev) => [created, ...prev])
      setEditing(created)
      setStatus({ kind: 'ok', message: `已加入動態背景「${scene?.label ?? ''}」到你的空間。到下方「你的背景」可指定套用或標深淺色。` })
    } catch (err) {
      setStatus({ kind: 'error', message: err instanceof Error ? err.message : '加入失敗。' })
    }
  }

  async function addLottie(lottieId: string) {
    try {
      const scene = getLottieScene(lottieId)
      const created = (await api('/api/backgrounds', {
        method: 'POST',
        body: JSON.stringify({ type: 'lottie', lottieId, name: scene?.label ?? 'Lottie 背景' }),
      })) as BackgroundItem
      setBackgrounds((prev) => [created, ...prev])
      setEditing(created)
      setStatus({ kind: 'ok', message: `已加入 Lottie 背景「${scene?.label ?? ''}」到你的空間。到下方「你的背景」可指定套用或標深淺色。` })
    } catch (err) {
      setStatus({ kind: 'error', message: err instanceof Error ? err.message : '加入失敗。' })
    }
  }

  async function addGradient() {
    try {
      // 預設漸層取自目前套用的主題，而不是寫死一組顏色 ——
      // 新增的背景一開始就與使用者的空間協調。
      const [from, to] = readThemeGradientSeed()

      const created = (await api('/api/backgrounds', {
        method: 'POST',
        body: JSON.stringify({
          type: 'gradient',
          name: '漸層',
          gradientSpec: {
            kind: 'linear',
            angle: 160,
            stops: [
              { color: from, position: 0 },
              { color: to, position: 100 },
            ],
          },
        }),
      })) as BackgroundItem
      setBackgrounds((prev) => [created, ...prev])
      setEditing(created)
      setStatus({ kind: 'ok', message: '已加入漸層背景。' })
    } catch (err) {
      setStatus({ kind: 'error', message: err instanceof Error ? err.message : '加入失敗。' })
    }
  }

  async function addSolid() {
    try {
      // 單色 = 兩個相同色停的漸層（渲染即為純色），不必新增資料型別。
      const [from] = readThemeGradientSeed()
      const created = (await api('/api/backgrounds', {
        method: 'POST',
        body: JSON.stringify({
          type: 'gradient',
          name: '單色',
          gradientSpec: {
            kind: 'linear',
            angle: 0,
            stops: [
              { color: from, position: 0 },
              { color: from, position: 100 },
            ],
          },
        }),
      })) as BackgroundItem
      setBackgrounds((prev) => [created, ...prev])
      setEditing(created)
      setStatus({ kind: 'ok', message: '已加入單色背景。到調整面板可換顏色。' })
    } catch (err) {
      setStatus({ kind: 'error', message: err instanceof Error ? err.message : '加入失敗。' })
    }
  }

  async function updateBackground(id: string, patch: Record<string, unknown>) {
    try {
      const updated = (await api(`/api/backgrounds/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      })) as BackgroundItem
      setBackgrounds((prev) => prev.map((b) => (b.id === id ? updated : b)))
      setEditing((prev) => (prev?.id === id ? updated : prev))
    } catch (err) {
      // 靜默失敗是 bug：調整沒存到卻讓預覽照舊顯示，重載就消失。
      // 明確告知，並把畫面拉回伺服器的真實值（丟棄這次沒存成功的編輯）。
      setStatus({ kind: 'error', message: err instanceof Error ? err.message : '調整沒有存到。' })
      const server = backgrounds.find((b) => b.id === id)
      if (server) setEditing((prev) => (prev?.id === id ? server : prev))
    }
  }

  async function removeBackground(id: string) {
    try {
      await api(`/api/backgrounds/${id}`, { method: 'DELETE' })
      setBackgrounds((prev) => prev.filter((b) => b.id !== id))
      setEditing((prev) => (prev?.id === id ? null : prev))
      router.refresh() // 刪掉的若正是目前顯示的背景，頁面即時退回其他背景
      setStatus({ kind: 'ok', message: '已移除。' })
    } catch (err) {
      setStatus({ kind: 'error', message: err instanceof Error ? err.message : '移除失敗。' })
    }
  }

  // 目前分頁要顯示哪些場景卡 / 是否顯示 Lottie 卡
  const galleryScenes =
    galleryTab === 'Lottie' ? [] : galleryTab === '全部' ? SCENES : scenesByCategory(galleryTab)
  const showLottie = galleryTab === '全部' || galleryTab === 'Lottie'

  // 分頁上的數量標示
  const tabCount = (tab: GalleryTab): number => {
    if (tab === 'Lottie') return LOTTIE_SCENES.length
    if (tab === '全部') return SCENES.length + LOTTIE_SCENES.length
    return scenesByCategory(tab).length
  }

  return (
    <div className="sr-stack">
      {status.kind === 'error' && (
        <p className="sr-message sr-message-error" role="alert">
          ✕ {status.message}
        </p>
      )}
      {status.kind === 'ok' && (
        <p className="sr-message sr-message-success" role="status">
          ✓ {status.message}
        </p>
      )}

      <BackgroundPreview
        spaceId={spaceId}
        item={editing ?? backgrounds[0] ?? null}
        theme={activeTheme}
      />

      <section className="sr-card" data-tour="bg-add">
        <h2 className="sr-section-title">加入背景</h2>

        {imageAssets.length === 0 ? (
          <p className="sr-muted">
            還沒有可用的圖片或影片。先到 Library 上傳一個，再回來這裡。
          </p>
        ) : (
          <>
            <label className="sr-label" htmlFor="asset-picker">
              從你的圖片或影片選一個
            </label>
            <div className="sr-row">
              <select
                id="asset-picker"
                className="sr-input"
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) {
                    void addFromAsset(e.target.value)
                    e.target.value = ''
                  }
                }}
              >
                <option value="">選擇圖片或影片…</option>
                {imageAssets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.kind === 'video' ? '🎬 ' : ''}
                    {a.original_filename ?? '未命名'}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        <div className="sr-btn-row" style={{ marginTop: 'var(--sr-space-4)' }}>
          <button
            type="button"
            className="sr-button sr-button-secondary"
            onClick={() => void addSolid()}
          >
            加入單色背景
          </button>
          <button
            type="button"
            className="sr-button sr-button-secondary"
            onClick={() => void addGradient()}
          >
            加入漸層背景
          </button>
        </div>

        {/* ── 背景商店：依分類瀏覽內建場景與 Lottie 動畫 ── */}
        <p className="sr-label" style={{ marginTop: 'var(--sr-space-4)' }}>
          背景商店（挑一個分類，點卡片即可加入）
        </p>

        {/* 分類分頁：全部 → 各分類 → Lottie。會換行、不橫向溢位。 */}
        <div className="sr-chip-row" role="tablist" aria-label="背景分類">
          {GALLERY_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={galleryTab === tab}
              className={`sr-chip${galleryTab === tab ? ' sr-chip-active' : ''}`}
              onClick={() => setGalleryTab(tab)}
            >
              {tab}（{tabCount(tab)}）
            </button>
          ))}
        </div>

        <p className="sr-muted" style={{ margin: 'var(--sr-space-2) 0 0', fontSize: 'var(--sr-text-sm)' }}>
          以下每張都是<b>即時預覽</b>（角落標「預覽中」）——套用前先看效果，點「＋ 加入我的空間」就會加到下方「你的背景」。
          場景也能「疊」在你的圖片/漸層上（到調整面板的「疊加場景」選）；Lottie 為本專案自製、可自由使用（CC0）。
        </p>

        {/* 場景卡（含靜態）：ProceduralScene 同時處理 dynamic 與 static */}
        {galleryScenes.length > 0 && (
          <div className="sr-scene-grid" role="list" aria-label={`${galleryTab} 場景`}>
            {galleryScenes.map((sc) => (
              <AdoptTile
                key={sc.id}
                label={sc.label}
                hint={`加入「${sc.label}」到我的空間`}
                onAdopt={() => void addScene(sc.id)}
              >
                <ProceduralScene sceneId={sc.id} />
              </AdoptTile>
            ))}
          </div>
        )}

        {/* Lottie 卡：全部 / Lottie 分頁時顯示 */}
        {showLottie && (
          <div className="sr-scene-grid" role="list" aria-label="Lottie 背景" style={{ marginTop: 'var(--sr-space-2)' }}>
            {LOTTIE_SCENES.map((sc) => (
              <AdoptTile
                key={sc.id}
                label={sc.label}
                hint={`加入「${sc.label}」（${sc.mood}）到我的空間`}
                onAdopt={() => void addLottie(sc.id)}
              >
                <LottieBackground lottieId={sc.id} />
              </AdoptTile>
            ))}
          </div>
        )}
      </section>

      <section className="sr-card">
        <h2 className="sr-section-title">你的背景（{backgrounds.length}）</h2>

        {backgrounds.length === 0 ? (
          <p className="sr-muted">還沒有背景。</p>
        ) : (
          <ul className="sr-bg-grid">
            {backgrounds.map((bg) => (
              <li key={bg.id} className="sr-bg-card">
                <button
                  type="button"
                  className="sr-bg-select"
                  onClick={() => setEditing(bg)}
                  aria-pressed={editing?.id === bg.id}
                  aria-label={`編輯 ${backgroundLabel(bg)}`}
                >
                  <BackgroundThumb spaceId={spaceId} item={bg} />
                  <span className="sr-muted">{backgroundLabel(bg)}</span>
                </button>
                <button
                  type="button"
                  className="sr-asset-delete"
                  onClick={() => void removeBackground(bg.id)}
                  aria-label={`移除 ${backgroundLabel(bg)}`}
                >
                  移除
                </button>
                {/* 深/淺色模式各自指定背景：切到該模式就用它 */}
                <div className="sr-chip-row" style={{ gap: 'var(--sr-space-1)', marginTop: 'var(--sr-space-1)' }}>
                  <button
                    type="button"
                    className={`sr-chip${bgLightId === bg.id ? ' sr-chip-active' : ''}`}
                    onClick={() => void assignBgForMode('light', bg.id)}
                    title="設為淺色模式的背景"
                  >
                    ☀ 淺色{bgLightId === bg.id ? ' ✓' : ''}
                  </button>
                  <button
                    type="button"
                    className={`sr-chip${bgDarkId === bg.id ? ' sr-chip-active' : ''}`}
                    onClick={() => void assignBgForMode('dark', bg.id)}
                    title="設為深色模式的背景"
                  >
                    ☾ 深色{bgDarkId === bg.id ? ' ✓' : ''}
                  </button>
                  <button
                    type="button"
                    className="sr-chip"
                    onClick={() => void flipTone(bg)}
                    title="切換這個背景的色調分類（系統先猜、可手改）"
                  >
                    色調：{(bg.tone ?? 'light') === 'dark' ? '深' : '淺'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="sr-muted" style={{ margin: 'var(--sr-space-2) 0 0', fontSize: 'var(--sr-text-sm)' }}>
          幫每個背景標「淺色／深色」：切換深淺色模式時會自動換成你指定的那個。沒指定就沿用播放清單。
        </p>
      </section>

      {editing && (
        <BackgroundEditor
          spaceId={spaceId}
          item={editing}
          onChange={(patch) => void updateBackground(editing.id, patch)}
          onClose={() => setEditing(null)}
        />
      )}

      <PlaylistPanel
        spaceId={spaceId}
        playlists={playlists}
        backgrounds={backgrounds}
        transitions={ALPHA_TRANSITIONS}
        onChange={setPlaylists}
        onStatus={(message, isError) =>
          setStatus(isError ? { kind: 'error', message } : { kind: 'ok', message })
        }
      />
    </div>
  )
}

function BackgroundThumb({ spaceId, item }: { spaceId: string; item: BackgroundItem }) {
  const [url, setUrl] = useState<string | null>(null)

  // 用 useEffect（不是 useState 初始化器）才不會在 render 期間發副作用、
  // StrictMode 下不會雙跑；asset 換了會重抓，卸載會取消。
  useEffect(() => {
    if (!item.asset_id) {
      setUrl(null)
      return
    }
    let cancelled = false
    void fetch(`/api/assets/${item.asset_id}/url?rendition=thumbnail`, {
      headers: { 'x-space-id': spaceId },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((b: { data?: { url: string } } | null) => {
        if (!cancelled) setUrl(b?.data?.url ?? null)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [spaceId, item.asset_id])

  if (item.type === 'procedural') {
    const scene = getScene(item.procedural_id)
    return <span className="sr-bg-thumb" aria-hidden="true" style={{ background: scene?.base }} />
  }

  if (item.type === 'lottie') {
    const scene = getLottieScene(item.lottie_id)
    return <span className="sr-bg-thumb" aria-hidden="true" style={{ background: scene?.bg }} />
  }

  if (item.type === 'gradient' && item.gradient_spec) {
    return (
      <span className="sr-bg-thumb" aria-hidden="true" style={{ background: gradientCss(item) ?? undefined }} />
    )
  }

  return (
    <span className="sr-bg-thumb" aria-hidden="true">
      {url && <img src={url} alt="" />}
    </span>
  )
}

/**
 * 從目前套用的主題讀出兩個顏色當漸層起訖。
 * API 只接受 #RRGGBB，所以讀不到合法值時退回中性灰白 ——
 * 那是 NEUTRAL 的用途（唯一允許字面色值的地方）。
 */
function readThemeGradientSeed(): [string, string] {
  const style = getComputedStyle(document.documentElement)
  const pick = (name: string, fallback: string) => {
    const value = style.getPropertyValue(name).trim()
    return /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback
  }
  return [
    pick('--sr-secondary', NEUTRAL.white),
    pick('--sr-accent', NEUTRAL.nearBlack),
  ]
}
