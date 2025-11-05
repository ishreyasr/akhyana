import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { ClientThemeProvider } from '../components/ClientThemeProvider'
import { ConnectionStateBanner } from '@/components/v2v-dashboard/ConnectionStateBanner'
import './globals.css'

export const metadata: Metadata = {
  title: 'Akhyana : V2V Communication Dashboard',
  description: 'Advanced Vehicle-to-Vehicle communication control center',
  generator: 'v0.dev',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <style>{`
html {
  font-family: ${GeistSans.style.fontFamily};
  --font-sans: ${GeistSans.variable};
  --font-mono: ${GeistMono.variable};
}
        `}</style>
      </head>
      <body>
        <ClientThemeProvider>
          {/** Global connection state banner **/}
          <ConnectionStateBanner />
          {children}
        </ClientThemeProvider>
      </body>
    </html>
  )
}
