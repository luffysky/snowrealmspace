'use client'

import type { ThemeDefinition, SurfaceStyle, ShadowPreset, MotionPreset } from '@snowrealm/theme-engine'

/**
 * 卡片材質、圓角、模糊、陰影、動畫。
 * v1.0 §11.4 的「毛玻璃 / 實色卡片 / 陰影 / 圓角 / 動畫強度」。
 */

const SURFACE_STYLES: { value: SurfaceStyle; label: string; description: string }[] = [
  { value: 'glass', label: '毛玻璃', description: '半透明，背景會透出來' },
  { value: 'solid', label: '實色', description: '不透明，效能最好' },
  { value: 'soft', label: '柔和', description: '無邊框，靠陰影浮起' },
  { value: 'outline', label: '線框', description: '透明底，只有邊框' },
]

const SHADOWS: { value: ShadowPreset; label: string }[] = [
  { value: 'none', label: '無' },
  { value: 'soft', label: '輕' },
  { value: 'medium', label: '中' },
  { value: 'dramatic', label: '強' },
]

const MOTIONS: { value: MotionPreset; label: string }[] = [
  { value: 'none', label: '無動畫' },
  { value: 'soft', label: '柔和' },
  { value: 'float', label: '漂浮' },
  { value: 'playful', label: '活潑' },
  { value: 'cinematic', label: '電影感' },
]

export function SurfaceControls({
  draft,
  onChange,
}: {
  draft: ThemeDefinition
  onChange: (patch: (prev: ThemeDefinition) => ThemeDefinition) => void
}) {
  return (
    <section className="sr-card">
      <h2 className="sr-section-title">卡片與質感</h2>

      <fieldset className="sr-fieldset">
        <legend className="sr-label">材質</legend>
        <div className="sr-choice-grid">
          {SURFACE_STYLES.map((s) => (
            <label key={s.value} className="sr-choice">
              <input
                type="radio"
                name="surface-style"
                value={s.value}
                checked={draft.surfaces.style === s.value}
                onChange={() =>
                  onChange((d) => {
                    d.surfaces.style = s.value
                    return d
                  })
                }
              />
              <span>
                <strong>{s.label}</strong>
                <br />
                <span className="sr-muted">{s.description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <SliderField
        id="radius"
        label="圓角"
        min={0}
        max={48}
        step={1}
        unit="px"
        value={draft.surfaces.radius}
        onChange={(v) =>
          onChange((d) => {
            d.surfaces.radius = v
            return d
          })
        }
      />

      <SliderField
        id="blur"
        label="模糊"
        min={0}
        max={40}
        step={1}
        unit="px"
        value={draft.surfaces.blur}
        disabled={draft.surfaces.style !== 'glass'}
        hint={draft.surfaces.style !== 'glass' ? '只有毛玻璃材質會用到' : undefined}
        onChange={(v) =>
          onChange((d) => {
            d.surfaces.blur = v
            return d
          })
        }
      />

      <SliderField
        id="opacity"
        label="卡片不透明度"
        min={0}
        max={1}
        step={0.02}
        value={draft.surfaces.opacity}
        disabled={draft.surfaces.style !== 'glass'}
        onChange={(v) =>
          onChange((d) => {
            d.surfaces.opacity = v
            d.colors.surface = `rgba(255, 255, 255, ${v.toFixed(2)})`
            return d
          })
        }
      />

      <SliderField
        id="border-width"
        label="邊框粗細"
        min={0}
        max={4}
        step={1}
        unit="px"
        value={draft.surfaces.borderWidth}
        onChange={(v) =>
          onChange((d) => {
            d.surfaces.borderWidth = v
            return d
          })
        }
      />

      <fieldset className="sr-fieldset">
        <legend className="sr-label">陰影</legend>
        <div className="sr-row">
          {SHADOWS.map((s) => (
            <label key={s.value} className="sr-choice sr-choice-inline">
              <input
                type="radio"
                name="shadow"
                value={s.value}
                checked={draft.effects.shadow === s.value}
                onChange={() =>
                  onChange((d) => {
                    d.effects.shadow = s.value
                    return d
                  })
                }
              />
              <span>{s.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="sr-fieldset">
        <legend className="sr-label">動畫</legend>
        <div className="sr-choice-grid">
          {MOTIONS.map((m) => (
            <label key={m.value} className="sr-choice sr-choice-inline">
              <input
                type="radio"
                name="motion"
                value={m.value}
                checked={draft.motion.preset === m.value}
                onChange={() =>
                  onChange((d) => {
                    d.motion.preset = m.value
                    return d
                  })
                }
              />
              <span>{m.label}</span>
            </label>
          ))}
        </div>
        <p className="sr-muted">
          不論選哪個，系統偵測到「減少動態效果」偏好時都會自動停用動畫。
        </p>
      </fieldset>

      <SliderField
        id="motion-intensity"
        label="動畫強度"
        min={0}
        max={1}
        step={0.05}
        value={draft.motion.intensity}
        disabled={draft.motion.preset === 'none'}
        onChange={(v) =>
          onChange((d) => {
            d.motion.intensity = v
            return d
          })
        }
      />
    </section>
  )
}

function SliderField({
  id,
  label,
  min,
  max,
  step,
  unit,
  value,
  disabled,
  hint,
  onChange,
}: {
  id: string
  label: string
  min: number
  max: number
  step: number
  unit?: string
  value: number
  disabled?: boolean
  hint?: string | undefined
  onChange: (value: number) => void
}) {
  const display = step < 1 ? value.toFixed(2) : String(value)
  return (
    <div className="sr-field">
      <label className="sr-label" htmlFor={id}>
        {label}
        <span className="sr-muted" style={{ fontWeight: 400 }}>
          {' '}
          {display}
          {unit ?? ''}
        </span>
      </label>
      <input
        type="range"
        id={id}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled ?? false}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-describedby={hint ? `${id}-hint` : undefined}
      />
      {hint && (
        <p className="sr-muted" id={`${id}-hint`}>
          {hint}
        </p>
      )}
    </div>
  )
}
