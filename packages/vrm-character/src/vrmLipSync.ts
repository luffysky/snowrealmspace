/**
 * VRM 口型同步（Lip Sync）
 *
 * 使用瀏覽器內建 Web Speech API 的邊界事件（boundary）
 * 在 TTS 朗讀時驅動 VRM 的嘴部表情（aa / ih / ou / ee / oh）
 *
 * 技術路線：
 *   - SpeechSynthesisUtterance `boundary` 事件回傳當前單詞
 *   - 用首字母（母音/子音）對應嘴形 viseme
 *   - 在 Three.js render loop 裡平滑插值 VRM expressionManager
 *
 * 使用方式：
 *   const lipSync = new VrmLipSync(vrm)
 *   lipSync.speak('你好，我是雪凜！')  // 開始朗讀 + 口型
 *   lipSync.stop()                      // 中止
 */

import type { VRM } from '@pixiv/three-vrm'

// 母音 viseme 對應（中文拼音首字對應英文 ARKit viseme 名稱）
const VOWEL_MAP: Record<string, string> = {
  a: 'aa', o: 'oh', e: 'ee', i: 'ih', u: 'ou',
  // 中文注音 / 拼音粗略對應
  ā: 'aa', á: 'aa', ǎ: 'aa', à: 'aa',
  ō: 'oh', ó: 'oh', ǒ: 'oh', ò: 'oh',
  ē: 'ee', é: 'ee', ě: 'ee', è: 'ee',
  ī: 'ih', í: 'ih', ǐ: 'ih', ì: 'ih',
  ū: 'ou', ú: 'ou', ǔ: 'ou', ù: 'ou',
  n: 'ih', ng: 'ih', m: 'ou',
}

const ALL_VISEMES = ['aa', 'ih', 'ou', 'ee', 'oh']

type LipSyncOptions = {
  /** 語言（預設 zh-TW） */
  lang?: string
  /** 語速 0.1~10（預設 1.0） */
  rate?: number
  /** 音調 0~2（預設 1.0） */
  pitch?: number
  /** 音量 0~1（預設 0.9） */
  volume?: number
  /** 朗讀結束回調 */
  onEnd?: () => void
}

export class VrmLipSync {
  private vrm: VRM
  private currentViseme: string | null = null
  private targetWeight = 0
  private currentWeight = 0
  private utterance: SpeechSynthesisUtterance | null = null
  private isSpeaking = false
  private rafId: number | null = null

  constructor(vrm: VRM) {
    this.vrm = vrm
  }

  /**
   * 讓角色朗讀文字，同步驅動口型
   */
  speak(text: string, options: LipSyncOptions = {}): void {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    this.stop()

    const utt = new SpeechSynthesisUtterance(text)
    utt.lang = options.lang ?? 'zh-TW'
    utt.rate = options.rate ?? 1.0
    utt.pitch = options.pitch ?? 1.0
    utt.volume = options.volume ?? 0.9

    utt.onboundary = (event) => {
      if (event.name === 'word') {
        const word = text.slice(event.charIndex, event.charIndex + event.charLength)
        this.setVisemeFromText(word)
      }
    }

    utt.onstart = () => {
      this.isSpeaking = true
      this.animateLoop()
    }

    utt.onend = () => {
      this.isSpeaking = false
      this.currentViseme = null
      this.targetWeight = 0
      options.onEnd?.()
    }

    utt.onerror = () => {
      this.isSpeaking = false
      this.currentViseme = null
    }

    this.utterance = utt
    window.speechSynthesis.speak(utt)
  }

  /** 中止朗讀並重置口型 */
  stop(): void {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
    this.isSpeaking = false
    this.currentViseme = null
    this.targetWeight = 0
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    this.resetAllVisemes()
  }

  /** 由 render loop 呼叫（每幀）— 平滑插值口型權重 */
  update(deltaTime: number): void {
    if (!this.isSpeaking && this.currentWeight <= 0.01) return

    const lerpSpeed = 12 * deltaTime  // ~12倍速插值（~0.083s 收斂）
    this.currentWeight += (this.targetWeight - this.currentWeight) * Math.min(lerpSpeed, 1)

    const expr = this.vrm.expressionManager
    if (!expr) return

    ALL_VISEMES.forEach((v) => {
      const w = v === this.currentViseme ? this.currentWeight : 0
      try { expr.setValue(v, w) } catch { /* 該 viseme 不存在就略過 */ }
    })

    expr.update()
  }

  /** 是否正在朗讀 */
  get speaking(): boolean {
    return this.isSpeaking
  }

  private setVisemeFromText(word: string): void {
    const char = word[0]?.toLowerCase() ?? ''
    const viseme = VOWEL_MAP[char] ?? (char.match(/[bcdfghjklmnpqrstvwxyz]/) ? 'ih' : null)
    if (viseme) {
      this.currentViseme = viseme
      this.targetWeight = 0.7 + Math.random() * 0.3  // 0.7~1.0 隨機讓口型更自然
    } else {
      this.currentViseme = null
      this.targetWeight = 0
    }
  }

  private animateLoop(): void {
    if (!this.isSpeaking) return
    // 讓嘴巴在說話時有節奏地開合（boundary 事件頻率不足時的補充）
    const now = performance.now()
    const phase = Math.sin(now * 0.008) * 0.5 + 0.5  // 0~1 震盪
    if (this.currentViseme && this.targetWeight < 0.3) {
      this.targetWeight = 0.3 + phase * 0.4
    }
    this.rafId = requestAnimationFrame(() => this.animateLoop())
  }

  private resetAllVisemes(): void {
    const expr = this.vrm.expressionManager
    if (!expr) return
    ALL_VISEMES.forEach((v) => {
      try { expr.setValue(v, 0) } catch { /* 該 viseme 不存在就略過 */ }
    })
    try { expr.update() } catch { /* 該 viseme 不存在就略過 */ }
  }
}

/**
 * 偵測瀏覽器是否支援 Web Speech TTS
 */
export function isTtsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

/**
 * 取得可用的中文語音（TTS 選音色）
 */
export function getChineseVoices(): SpeechSynthesisVoice[] {
  if (!isTtsSupported()) return []
  return window.speechSynthesis.getVoices().filter(
    (v) => v.lang.startsWith('zh') || v.lang.startsWith('cmn'),
  )
}
