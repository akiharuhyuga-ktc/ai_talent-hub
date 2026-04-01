import type { Metadata } from 'next'
import './globals.css'
import { NavBar } from '@/components/layout/NavBar'
import { MainContent } from '@/components/layout/MainContent'

export const metadata: Metadata = {
  title: 'KTC TalentHub — モバイルアプリ開発部',
  description: 'TalentHub: AIタレントマネジメント 2026年上期',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-gray-50 antialiased" style={{
        fontFamily: '"Hiragino Kaku Gothic ProN", "Hiragino Sans", Meiryo, sans-serif'
      }}>
        <NavBar />
        <MainContent>{children}</MainContent>
      </body>
    </html>
  )
}
