import Link from 'next/link'

type BriefSubnavKey = 'overview' | 'customers' | 'question-sets' | 'send' | 'briefs'
type BriefSubnavDisplayKey = 'overview' | 'question-sets' | 'send'

export function BriefSubnav({ active }: { active: BriefSubnavKey | BriefSubnavDisplayKey }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
      {[
        { href: '/dashboard/send', label: 'Nytt utskick', key: 'send' },
        { href: '/dashboard/question-sets', label: 'Frågor', key: 'question-sets' },
        { href: '/dashboard', label: 'Översikt', key: 'overview' },
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

export function BriefEmptyCard({ title, text }: { title: string; text: string }) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '40px 28px', border: '1px solid var(--border)' }}>
      <h2 style={{ margin: '0 0 8px', fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--text)' }}>{title}</h2>
      <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text-3)', maxWidth: 620 }}>{text}</p>
    </div>
  )
}
