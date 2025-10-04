import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'SharePaste by Gan',
  description: 'One-time shared paste and files with expiring session',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <div className="min-h-screen flex flex-col">
          <header className="sticky top-0 z-10">
            <div className="mx-auto w-[75vw] py-4">
              <div className="card px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 bg-black text-white rounded-md grid place-content-center font-bold">S</div>
                  <span className="font-semibold text-slate-800">SharePaste by Gan</span>
                </div>
                <a href="https://" className="text-xs text-slate-500 hover:text-slate-700" target="_blank" rel="noreferrer">v0.1</a>
              </div>
            </div>
          </header>
          <main className="flex-1">
            {children}
          </main>
          <footer className="py-8 text-center text-xs text-slate-500">
            Built with Next.js & TailwindCSS
          </footer>
        </div>
      </body>
    </html>
  )
}
