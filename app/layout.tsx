import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Doings Brief',
  description: 'Berätta om ert uppdrag – svara med rösten',
  icons: { icon: '/favicon.ico' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sv">
      <body>{children}</body>
    </html>
  )
}
