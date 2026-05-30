'use client';
import * as React from 'react';
import type { ToastProps } from '@/components/ui/toast';

const TOAST_LIMIT = 4;
const TOAST_REMOVE_DELAY = 5000;

type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
};

let count = 0;
function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}

const listeners: Array<(toasts: ToasterToast[]) => void> = [];
let memoryState: ToasterToast[] = [];

function dispatch(next: ToasterToast[]) {
  memoryState = next;
  listeners.forEach((l) => l(memoryState));
}

export function toast(props: Omit<ToasterToast, 'id'>) {
  const id = genId();
  const t: ToasterToast = { ...props, id };
  dispatch([t, ...memoryState].slice(0, TOAST_LIMIT));
  setTimeout(() => dispatch(memoryState.filter((x) => x.id !== id)), TOAST_REMOVE_DELAY);
  return id;
}

export function useToast() {
  const [state, setState] = React.useState<ToasterToast[]>(memoryState);
  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const i = listeners.indexOf(setState);
      if (i > -1) listeners.splice(i, 1);
    };
  }, []);
  return { toasts: state, toast };
}
