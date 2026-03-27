import Link from 'next/link'

export function EvaluationSubnav({ active }: { active: 'overview' | 'new' }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
      {[
        { href: '/dashboard/evaluations', label: 'Översikt', key: 'overview' },
        { href: '/dashboard/evaluations/new', label: 'Skapa utvärdering', key: 'new' },
      ].map(item => (
        <Link
          key={item.href}
          href={item.href}
          style={{
            padding: '7px 12px',
            borderRadius: 999,
            border: '1px solid var(--border)',
            textDecoration: 'none',
            fontSize: 12.5,
            fontWeight: item.key === active ? 700 : 500,
            color: item.key === active ? 'var(--accent)' : 'var(--text-2)',
            background: item.key === active ? 'var(--accent-dim)' : 'var(--surface)',
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
    <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '40px 28px', border: '1px solid var(--border)' }}>
      <h2 style={{ margin: '0 0 8px', fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--text)' }}>{title}</h2>
      <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text-3)', maxWidth: 620 }}>{text}</p>
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
