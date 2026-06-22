import { requireUser } from '@/lib/auth/guard';
import { Sidebar } from '@/components/layout/sidebar';
import { MobileNav } from '@/components/layout/mobile-nav';
import { Toaster } from '@/components/ui/toaster';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const userName = user.name ?? user.email;
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar userName={userName} theme={user.theme} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <MobileNav userName={userName} theme={user.theme} />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl p-4 sm:p-6">{children}</div>
        </main>
      </div>
      <Toaster />
    </div>
  );
}
