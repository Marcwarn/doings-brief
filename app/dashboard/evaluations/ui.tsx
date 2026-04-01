import Link from 'next/link'

export function EvaluationSubnav({ active }: { active: 'overview' | 'new' }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
      {[
        { href: '/dashboard/evaluations/new', label: 'Skapa utvärdering', key: 'new' },
        { href: '/dashboard/evaluations', label: 'Översikt', key: 'overview' },
      ].map(item => (
        <Link
          key={item.href}
          href={item.href}
          style={{
            padding: '9px 14px',
            borderRadius: 999,
            border: '1px solid var(--border)',
            textDecoration: 'none',
            fontSize: 12.5,
            fontWeight: item.key === active ? 700 : 500,
            color: item.key === active ? 'var(--accent)' : 'var(--text-2)',
            background: item.key === active ? 'rgba(198,35,104,0.08)' : 'rgba(14,14,12,0.03)',
          }}
        >
          {item.label}
        </Link>
      ))}
    </div>
  )
}

export function InlineError({ text }: { text: string }) {
  return (
    <div style={{
      marginBottom: 16,
      padding: '12px 14px',
      borderRadius: 10,
      border: '1px solid rgba(185, 28, 28, 0.18)',
      background: '#fef2f2',
      color: '#b91c1c',
      fontSize: 13,
    }}>
      {text}
    </div>
  )
}

export function EmptyCard({ title, text }: { title: string; text: string }) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 18, padding: '40px 28px', border: '1px solid var(--border)', boxShadow: '0 12px 32px rgba(16,24,40,0.04)' }}>
      <h2 style={{ margin: '0 0 8px', fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--text)', letterSpacing: '-0.02em' }}>{title}</h2>
      <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text-3)', maxWidth: 620, lineHeight: 1.65 }}>{text}</p>
    </div>
  )
}

export function PageLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '70vh' }}>
      <div style={{ display: 'flex', gap: 5 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', animation: 'bounce 1s ease-in-out infinite', animationDelay: `${i * 0.2}s` }} />
        ))}
      </div>
    </div>
  )
}
