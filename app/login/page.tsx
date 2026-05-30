import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { LoginForm } from './login-form';

// La página de login usa la sesión (cookies) y un componente de cliente con
// hooks; forzamos render dinámico para no prerenderizarla estáticamente en build.
export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect('/');
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <LoginForm />
    </main>
  );
}
