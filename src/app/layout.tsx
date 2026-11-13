import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SNT Ticket Platform',
  description: 'Ticket reservation for SNT Entertainment events',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
