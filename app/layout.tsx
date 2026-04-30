import type { Metadata } from 'next'
import { Suspense } from 'react'
import './globals.css'
import SplashGate from './components/SplashGate'

export const metadata: Metadata = {
  title: 'CyberCard / CyberFlipper',
  description: 'Consent-based NFC, QR, RF, and telemetry lab for CyberCard and CyberFlipper.'
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Suspense fallback={null}>
          <SplashGate>{children}</SplashGate>
        </Suspense>
      </body>
    </html>
  )
}