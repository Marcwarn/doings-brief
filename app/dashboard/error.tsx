'use client'

type DashboardErrorProps = {
  error: Error & { digest?: string }
  reset: () => void
}

export default function DashboardError({ error, reset }: DashboardErrorProps) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        background:
          'radial-gradient(circle at top, rgba(198, 35, 104, 0.08), transparent 32%), var(--bg)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 620,
          borderRadius: 28,
          border: '1px solid var(--border)',
          background: 'rgba(255, 255, 255, 0.92)',
          boxShadow: '0 24px 80px rgba(14, 14, 12, 0.08)',
          padding: '40px 34px 32px',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            borderRadius: 999,
            padding: '8px 12px',
            background: 'var(--accent-dim)',
            color: 'var(--accent)',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          Fel i workspace
        </div>

        <div style={{ marginTop: 20 }}>
          <h1
            style={{
              fontSize: 'clamp(2rem, 4vw, 2.6rem)',
              lineHeight: 1.05,
              letterSpacing: '-0.04em',
              fontWeight: 700,
              color: 'var(--text)',
            }}
          >
            Dashboarden tappade fotfästet.
          </h1>
          <p
            style={{
              marginTop: 14,
              fontSize: 16,
              lineHeight: 1.7,
              color: 'var(--text-2)',
              maxWidth: 520,
            }}
          >
            Något gick fel i den här delen av Debrief. Prova att ladda om segmentet först. Om felet
            återkommer kan du gå tillbaka till översikten och försöka igen därifrån.
          </p>
        </div>

        <div
          style={{
            marginTop: 28,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <button
            type="button"
            onClick={() => reset()}
            style={{
              border: 'none',
              borderRadius: 14,
              padding: '14px 18px',
              background: 'var(--text)',
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Försök igen
          </button>
          <a
            href="/dashboard"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 14,
              padding: '14px 18px',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: 600,
              background: 'var(--surface)',
            }}
          >
            Till startsidan
          </a>
        </div>

        {error.digest ? (
          <p
            style={{
              marginTop: 20,
              fontSize: 12,
              color: 'var(--text-3)',
            }}
          >
            Fel-ID: {error.digest}
          </p>
        ) : null}
      </div>
    </div>
  )
}
