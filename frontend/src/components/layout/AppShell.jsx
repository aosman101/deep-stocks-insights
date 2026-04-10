import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Navbar from './Navbar'

export default function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="relative flex h-screen bg-surface overflow-hidden">
      {/* Fixed grain overlay — covers entire viewport */}
      <div className="grain-overlay" />

      {/* Ambient ember gradient — subtle, fixed */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage:
            'radial-gradient(ellipse 50% 40% at 10% 0%, rgba(245,165,36,0.09), transparent 55%), radial-gradient(ellipse 60% 50% at 100% 100%, rgba(234,88,12,0.06), transparent 60%)',
        }}
      />

      {/* Scan lines — very subtle, fixed */}
      <div className="pointer-events-none fixed inset-0 z-0 scanlines" />

      <div className="relative z-10 flex w-full h-full">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <Navbar onMenuToggle={() => setSidebarOpen(true)} />
          <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-8 lg:px-10 lg:py-8">
            <div className="animate-fade-in">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
