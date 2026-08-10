import { AppShellRoute } from '@/components/app/app-shell-server'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShellRoute>{children}</AppShellRoute>
}
