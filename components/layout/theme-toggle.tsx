'use client';
import { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Alterna modo claro/oscuro (clase `dark` en <html> + localStorage). */
export function ThemeToggle() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  function toggle() {
    const next = !dark;
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem('winspy-theme', next ? 'dark' : 'light');
    } catch {
      /* sin localStorage: solo cambia en esta sesión */
    }
    setDark(next);
  }

  return (
    <Button variant="ghost" size="sm" onClick={toggle} className="w-full justify-start gap-3 text-muted-foreground">
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />} {dark ? 'Modo claro' : 'Modo oscuro'}
    </Button>
  );
}
