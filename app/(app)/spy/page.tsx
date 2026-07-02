import { redirect } from 'next/navigation';

// «Spy de anuncios» se unificó dentro de «Descubrir» como la pestaña de anuncios.
export default function SpyPage() {
  redirect('/descubrir?vista=anuncios');
}
