# Ampliwork Brand Transformation

Based on the [Ampliwork Design System](../packages/.antigravity/context/ampliwork-ui.md), here is the transformed, brand-compliant prototype for the "Modern App".

## Key Changes
- **Colors**: Midnight Navy (`#020617`), Cyan (`#00A3FF`), Slate-300 text.
- **Components**: Pill-shaped buttons (`rounded-full`), Glassmorphism cards (`bg-slate-900/50 backdrop-blur-md border-white/5`).
- **Typography**: Sans-serif, high contrast headings.

---

### `app/layout.tsx`

```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Ampliwork Modern App',
  description: 'A premium, brand-compliant React application',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-[#020617] text-slate-300 antialiased selection:bg-[#00A3FF] selection:text-[#020617]`}>
        {children}
      </body>
    </html>
  )
}
```

### `app/globals.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: #020617;
  --foreground: #cbd5e1;
}

body {
  background-color: var(--background);
  color: var(--foreground);
}

/* Custom Scrollbar for premium feel */
::-webkit-scrollbar {
  width: 8px;
}
::-webkit-scrollbar-track {
  background: #020617;
}
::-webkit-scrollbar-thumb {
  background: #1e293b;
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
  background: #00A3FF;
}
```

### `app/page.tsx`

```tsx
import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#020617] relative overflow-hidden flex items-center justify-center">
      {/* Background Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[#00A3FF]/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="container mx-auto px-4 py-16 relative z-10">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-block px-4 py-1.5 rounded-full bg-[#00A3FF]/10 text-[#00A3FF] text-sm font-semibold mb-6 border border-[#00A3FF]/20">
            Ampliwork Design System
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 tracking-tight">
            Premium Interfaces.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00A3FF] to-cyan-200">
              Built for Speed.
            </span>
          </h1>
          
          <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            Experience the next generation of application design with our signature midnight navy palette and electric cyan accents.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              href="/mock"
              className="inline-flex items-center justify-center px-8 py-4 bg-[#00A3FF] text-[#020617] font-bold rounded-full hover:bg-cyan-400 transition-all duration-300 hover:shadow-[0_0_20px_rgba(0,163,255,0.4)]"
            >
              View Prototype
            </Link>
            <button className="inline-flex items-center justify-center px-8 py-4 bg-transparent border border-slate-700 text-white font-semibold rounded-full hover:border-[#00A3FF] hover:text-[#00A3FF] transition-all duration-300">
              Documentation
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

### `app/mock/page.tsx`

```tsx
import { fixtures } from './fixtures'
import { Header } from './components/header'
import { HeroSection } from './components/hero-section'
import { StatsSection } from './components/stats-section'
import { FeaturesSection } from './components/features-section'
import { CTASection } from './components/cta-section'

export default function MockScreen() {
  return (
    <div className="min-h-screen bg-[#020617]">
      <Header />
      <main>
        <HeroSection />
        <StatsSection />
        <FeaturesSection />
        <CTASection />
      </main>
    </div>
  )
}
```

### `app/mock/components/header.tsx`

```tsx
import Link from 'next/link'
import { fixtures } from '../fixtures'

export function Header() {
  return (
    <header className="fixed top-0 w-full z-50 bg-[#020617]/80 backdrop-blur-md border-b border-white/5">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-20">
          <Link href="/" className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#00A3FF] shadow-[0_0_10px_#00A3FF]"></div>
            Ampliwork
          </Link>
          
          <nav className="hidden md:flex items-center space-x-8">
            {fixtures.navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="text-sm font-medium text-slate-400 hover:text-[#00A3FF] transition-colors"
              >
                {item.name}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            <Link 
              href="/login" 
              className="hidden md:inline-flex text-sm font-semibold text-white hover:text-[#00A3FF] transition-colors"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center px-5 py-2.5 bg-[#00A3FF] text-[#020617] text-sm font-bold rounded-full hover:bg-cyan-400 transition-all shadow-[0_0_15px_rgba(0,163,255,0.2)] hover:shadow-[0_0_20px_rgba(0,163,255,0.4)]"
            >
              Get Started
            </Link>

            {/* Mobile Menu Button */}
            <button className="md:hidden p-2 text-slate-400 hover:text-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
```

### `app/mock/components/hero-section.tsx`

```tsx
import { fixtures } from '../fixtures'

export function HeroSection() {
  return (
    <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
      {/* Background Elements */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[#00A3FF]/5 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[#00A3FF] text-sm font-medium mb-8 backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00A3FF] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00A3FF]"></span>
            </span>
            New Version 2.0 Available
          </div>

          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 tracking-tight leading-tight">
            {fixtures.hero.title}
          </h1>
          <p className="text-xl md:text-2xl text-slate-400 mb-8 font-light">
            {fixtures.hero.subtitle}
          </p>
          <p className="text-lg text-slate-500 mb-12 max-w-2xl mx-auto leading-relaxed">
            {fixtures.hero.description}
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="px-8 py-4 bg-[#00A3FF] text-[#020617] font-bold rounded-full hover:bg-cyan-400 transition-all hover:shadow-[0_0_25px_rgba(0,163,255,0.4)] transform hover:-translate-y-1">
              Start Building Free
            </button>
            <button className="px-8 py-4 bg-white/5 border border-white/10 text-white font-semibold rounded-full hover:bg-white/10 hover:border-[#00A3FF]/50 transition-all backdrop-blur-sm">
              View Live Demo
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
```

### `app/mock/components/stats-section.tsx`

```tsx
import { fixtures } from '../fixtures'

export function StatsSection() {
  return (
    <section className="py-20 bg-[#020617] relative border-y border-white/5">
      <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.03] pointer-events-none" />
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 divide-x divide-white/5">
          {fixtures.stats.map((stat, index) => (
            <div key={index} className="text-center px-4">
              <div className="text-4xl md:text-5xl font-bold text-white mb-2 tracking-tight">
                {stat.value}
              </div>
              <div className="text-[#00A3FF] font-medium text-sm uppercase tracking-wider">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

### `app/mock/components/features-section.tsx`

```tsx
import { fixtures } from '../fixtures'

export function FeaturesSection() {
  return (
    <section id="features" className="py-32 bg-[#020617] relative">
      <div className="container mx-auto px-4">
        <div className="text-center mb-20">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
            Engineered for <span className="text-[#00A3FF]">Excellence</span>
          </h2>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Everything you need to build modern, scalable applications with a premium touch.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {fixtures.features.map((feature, index) => (
            <div key={index} className="group relative bg-slate-900/40 p-8 rounded-3xl border border-white/5 hover:border-[#00A3FF]/30 transition-all duration-300 hover:bg-slate-900/60 hover:-translate-y-1">
              <div className="absolute inset-0 bg-gradient-to-br from-[#00A3FF]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl" />
              
              <div className="relative z-10">
                <div className="w-12 h-12 mb-6 rounded-2xl bg-[#00A3FF]/10 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform duration-300 border border-[#00A3FF]/20 text-[#00A3FF]">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold text-white mb-3 group-hover:text-[#00A3FF] transition-colors">
                  {feature.title}
                </h3>
                <p className="text-slate-400 leading-relaxed text-sm">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

### `app/mock/components/cta-section.tsx`

```tsx
export function CTASection() {
  return (
    <section className="py-32 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-t from-[#00A3FF]/10 to-transparent pointer-events-none" />
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="bg-gradient-to-br from-slate-900 via-[#0f172a] to-slate-900 rounded-[2.5rem] p-12 md:p-24 text-center border border-white/10 shadow-2xl relative overflow-hidden">
          
          {/* Decorative glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-[#00A3FF]/20 rounded-full blur-[100px] -translate-y-1/2 pointer-events-none" />

          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6 relative z-10">
            Ready to <span className="text-[#00A3FF]">Amplify</span> Your Workflow?
          </h2>
          <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto relative z-10">
            Join thousands of developers who are already building next-generation applications with our premium platform.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center relative z-10">
            <button className="px-10 py-4 bg-[#00A3FF] text-[#020617] font-bold rounded-full hover:bg-cyan-400 transition-all hover:shadow-[0_0_30px_rgba(0,163,255,0.5)] transform hover:-translate-y-1">
              Start Free Trial
            </button>
            <button className="px-10 py-4 bg-white/5 border border-white/10 text-white font-semibold rounded-full hover:bg-white/10 hover:border-[#00A3FF] transition-all backdrop-blur-sm">
              Read Documentation
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
```
