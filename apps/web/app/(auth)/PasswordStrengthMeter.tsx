'use client'

import { passwordStrength } from '@snowrealm/validation'

/** 密碼強度條。空字串時不顯示。 */
export function PasswordStrengthMeter({ password }: { password: string }) {
  if (!password) return null
  const { score, label, hint } = passwordStrength(password)

  // 0–1 紅、2 黃、3 藍綠、4 綠
  const COLORS = ['var(--sr-danger)', 'var(--sr-danger)', 'var(--sr-warning)', 'var(--sr-accent)', 'var(--sr-success)']
  const color = COLORS[score] ?? 'var(--sr-danger)'

  return (
    <div aria-live="polite" style={{ marginTop: 'calc(var(--sr-space-1) * -1)' }}>
      <div style={{ display: 'flex', gap: '4px', marginBottom: 'var(--sr-space-1)' }}>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            style={{
              flex: 1,
              height: '4px',
              borderRadius: '2px',
              background: i < score ? color : 'var(--sr-border)',
              transition: 'background var(--sr-motion-fast, 150ms) ease',
            }}
          />
        ))}
      </div>
      <p className="sr-muted" style={{ margin: 0, fontSize: 'var(--sr-text-sm)' }}>
        強度：<span style={{ color }}>{label}</span>
        {hint ? ` · ${hint}` : ''}
      </p>
    </div>
  )
}
