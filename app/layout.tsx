import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css'

const interSans = localFont({
  src: [
    { path: './fonts/InterVariable.woff2', weight: '100 900', style: 'normal' },
    { path: './fonts/InterVariable-Italic.woff2', weight: '100 900', style: 'italic' },
  ],
  variable: '--font-sans',
  display: 'swap',
})

const interDisplay = localFont({
  src: [
    { path: './fonts/InterVariable.woff2', weight: '100 900', style: 'normal' },
    { path: './fonts/InterVariable-Italic.woff2', weight: '100 900', style: 'italic' },
  ],
  variable: '--font-display',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Doings Brief',
  description: 'Berätta om ert uppdrag – svara med rösten',
  icons: { icon: '/favicon.ico' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sv" className={`${interSans.variable} ${interDisplay.variable}`}>
      <body>{children}</body>
    </html>
  )
}
