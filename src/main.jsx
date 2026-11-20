import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import './styles.css'
import './announcements.css'
import './auth.css'
import './day10.css'
import './day11.css'
import './day12.css'
import './cinematic.css'

document.documentElement.classList.remove('no-js')
document.documentElement.classList.add('js')

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
)
