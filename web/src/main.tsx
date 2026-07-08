import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/global.css'
import { applyStoredTheme } from './hooks/useTheme'
import { applyStoredAccent } from './hooks/useAccentTheme'

// Apply persisted theme/accent before first render so the app launches in the
// saved appearance (and never "reverts" when the settings modal later mounts).
applyStoredTheme()
applyStoredAccent()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
