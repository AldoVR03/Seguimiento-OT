import './globals.css'

export const metadata = {
  title: 'Lavandería El Cobre - Sistema OT',
  description: 'Sistema de seguimiento de órdenes de trabajo',
}

import { AuthProvider } from '../context/AuthContext';

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}