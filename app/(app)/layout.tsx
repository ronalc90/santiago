import { requireUser } from '@/lib/auth/guard';
import { Sidebar } from '@/components/layout/sidebar';
import { Toaster } from '@/components/ui/toaster';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar userName={user.name ?? user.email} />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl p-6">{children}</div>
      </main>
      <Toaster />
    </div>
  );
}
