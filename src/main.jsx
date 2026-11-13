import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import './announcements.css'

document.documentElement.classList.remove('no-js')
document.documentElement.classList.add('js')

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
