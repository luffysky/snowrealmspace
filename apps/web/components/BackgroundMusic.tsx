'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * 背景音樂播放器（Luffy 追加）。
 *
 * 瀏覽器 autoplay 政策：有聲音的音訊不能自動播放，必須由使用者手勢觸發。
 * 所以這裡提供一個 nav 上的播放/暫停按鈕 —— 使用者自己決定要不要放，
 * 點下去（手勢）才開始。這也符合「不做情緒操控／不強加」的原則。
 */
export function BackgroundMusic({
  spaceId,
  assetId,
  enabled,
  volume,
}: {
  spaceId: string
  assetId: string | null
  enabled: boolean
  volume: number
}) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    if (!enabled || !assetId) return
    let cancelled = false
    void fetch(`/api/assets/${assetId}/url`, {
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
  }, [spaceId, assetId, enabled])

  useEffect(() => {
    const audio = audioRef.current
    if (audio) audio.volume = Math.min(1, Math.max(0, volume))
  }, [volume, url])

  if (!enabled || !assetId) return null

  function toggle() {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
      setPlaying(false)
    } else {
      void audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
    }
  }

  return (
    <>
      <button
        type="button"
        className="sr-icon-button"
        onClick={toggle}
        aria-pressed={playing}
        aria-label={playing ? '暫停背景音樂' : '播放背景音樂'}
        title={playing ? '暫停背景音樂' : '播放背景音樂'}
      >
        {playing ? '♪⏸' : '♪'}
      </button>
      {url && (
        <audio
          ref={audioRef}
          src={url}
          loop
          onEnded={() => setPlaying(false)}
          onPause={() => setPlaying(false)}
        />
      )}
    </>
  )
}
