import type { Metadata } from 'next'
import { ClientThemeProvider } from '../components/ClientThemeProvider'
import { ConnectionStateBanner } from '@/components/v2v-dashboard/ConnectionStateBanner'
import './globals.css'

export const metadata: Metadata = {
  title: 'Akhyana : V2V Communication Dashboard',
  description: 'Advanced Vehicle-to-Vehicle communication control center',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
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
