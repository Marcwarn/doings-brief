'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient, type QuestionSet } from '@/lib/supabase'

export default function QuestionSetsPage() {
  const sb = createClient()
  const [sets, setSets]       = useState<QuestionSet[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    sb.from('question_sets').select('*').order('updated_at', { ascending: false })
      .then(({ data }) => { setSets(data || []); setLoading(false) })
  }, [])

  async function deleteSet(id: string) {
    if (!confirm('Radera det här frågebatteriet och alla dess frågor?')) return
    await sb.from('question_sets').delete().eq('id', id)
    setSets(prev => prev.filter(s => s.id !== id))
  }

  if (loading) return <PageLoader />

  return (
    <div style={{ padding: '36px 40px', maxWidth: 800, fontFamily: 'DM Sans, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: '#111', margin: 0 }}>Frågebatterier</h1>
          <p style={{ fontSize: 13.5, color: '#9ca3af', margin: '4px 0 0' }}>Skapa och hantera dina frågeuppsättningar</p>
        </div>
        <Link href="/dashboard/question-sets/new" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '9px 16px', borderRadius: 8,
          background: '#C62368', color: '#fff',
          fontSize: 13.5, fontWeight: 500, textDecoration: 'none',
          boxShadow: '0 2px 8px rgba(198,35,104,0.22)',
        }}>
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Nytt batteri
        </Link>
      </div>

      {sets.length === 0 ? (
        <div style={{
          background: '#fff', borderRadius: 12, padding: '60px 24px', textAlign: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)',
        }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
          <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 16px' }}>Inga frågebatterier ännu.</p>
          <Link href="/dashboard/question-sets/new" style={{
            fontSize: 13.5, fontWeight: 500, color: '#C62368', textDecoration: 'none',
          }}>
            Skapa ditt första →
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sets.map(s => (
            <div key={s.id} style={{
              background: '#fff', borderRadius: 12,
              padding: '16px 20px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)',
            }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>{s.name}</div>
                {s.description && <div style={{ fontSize: 12.5, color: '#9ca3af', marginTop: 2 }}>{s.description}</div>}
                <div style={{ fontSize: 11.5, color: '#d1d5db', marginTop: 4 }}>
                  Uppdaterat {new Date(s.updated_at).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Link href={`/dashboard/send?set=${s.id}`} style={{
                  padding: '6px 14px', borderRadius: 7,
                  background: '#C62368', color: '#fff',
                  fontSize: 12.5, fontWeight: 500, textDecoration: 'none',
                }}>
                  Skicka
                </Link>
                <Link href={`/dashboard/question-sets/${s.id}`} style={{
                  padding: '6px 14px', borderRadius: 7,
                  background: '#f5f4f6', color: '#374151',
                  fontSize: 12.5, fontWeight: 500, textDecoration: 'none',
                  border: '1px solid #ececec',
                }}>
                  Redigera
                </Link>
                <button onClick={() => deleteSet(s.id)} style={{
                  padding: '6px 10px', borderRadius: 7,
                  background: 'none', border: 'none',
                  fontSize: 12.5, color: '#dc2626', cursor: 'pointer',
                }}>
                  Radera
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PageLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ display: 'flex', gap: 6 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{
            width: 8, height: 8, borderRadius: '50%', background: '#C62368',
            animation: 'bounce 0.9s ease-in-out infinite', animationDelay: `${i * 0.18}s`,
          }} />
        ))}
      </div>
    </div>
  )
}
