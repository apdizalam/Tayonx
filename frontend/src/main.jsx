import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
// Design-system theme: imported after App so it loads last and styles every page.
import './theme.css'
// Visual polish layer (tokens, elevation, states, motion) — styling only.
import './polish.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
