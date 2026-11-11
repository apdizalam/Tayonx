import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// Base stylesheets are loaded here, in order, before the theme layers. The dashboards are
// lazy-loaded and import these too; loading them up front keeps that later import from
// re-ordering the cascade (which would let older rules override theme.css and polish.css).
import './App.css'
import './dashboard-sizing.css'
import './account-forms.css'
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
