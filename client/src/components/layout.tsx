import { Link, useLocation } from "wouter"
import { LayoutDashboard, CreditCard, Settings, LogOut, PlusCircle, Wallet } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation()

  const navItems = [
    { icon: LayoutDashboard, label: "Дашборд", href: "/" },
    { icon: CreditCard, label: "Подписки", href: "/subscriptions" },
    { icon: Wallet, label: "Бюджет", href: "/budget" },
  ]

  return (
    <div className="flex min-h-screen bg-background text-foreground font-sans">
  
      <aside className="w-64 border-r border-border bg-card/50 backdrop-blur-xl fixed inset-y-0 z-50 hidden md:flex flex-col">
        <div className="p-6">
          <div className="flex items-center gap-2 font-bold text-xl text-primary tracking-tight">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
              S
            </div>
            SubManager
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-2 py-4">
          {navItems.map((item) => {
            const isActive = location === item.href
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </div>
              </Link>
            )
          })}
        </nav>
      </aside>

      <main className="flex-1 md:ml-64 relative">
        <header className="h-16 border-b border-border bg-background/80 backdrop-blur sticky top-0 z-40 px-6 flex items-center justify-between">
          <h1 className="font-semibold text-lg">
            {navItems.find(i => i.href === location)?.label || "Обзор"}
          </h1>
        </header>
        <div className="p-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
          {children}
        </div>
      </main>
    </div>
  )
}
