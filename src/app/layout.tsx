import type { Metadata, Viewport } from 'next'
import { Instrument_Sans, DM_Mono } from 'next/font/google'
import './globals.css'

const instrument = Instrument_Sans({
  subsets: ['latin'],
  axes: ['wdth'],
  variable: '--font-instrument',
  display: 'swap',
})

const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-dm-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'SNT Ticket Platform',
  description: 'Ticket reservation for SNT Entertainment events',
}

export const viewport: Viewport = {
  themeColor: '#0f0f0f',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${instrument.variable} ${dmMono.variable}`}>
      <body>{children}</body>
    </html>
  )
}
