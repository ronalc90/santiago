import { redirect } from 'next/navigation';

// «Oportunidades» se unificó dentro de «Descubrir» como la pestaña de oportunidades.
export default function OpportunitiesPage() {
  redirect('/descubrir?vista=oportunidades');
}
