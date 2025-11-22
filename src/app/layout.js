import './globals.css'

export const metadata = {
  title: 'Lavandería El Cobre - Sistema OT',
  description: 'Sistema de seguimiento de órdenes de trabajo',
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}