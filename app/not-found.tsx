/** Página 404 propia (App Router), sin dependencias de cliente para no romper el prerender. */
export default function NotFound() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        textAlign: 'center',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <h1 style={{ fontSize: '2.25rem', fontWeight: 700 }}>404</h1>
      <p>La página que buscas no existe.</p>
      <a href="/" style={{ textDecoration: 'underline' }}>
        Volver al inicio
      </a>
    </div>
  );
}
