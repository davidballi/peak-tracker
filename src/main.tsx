import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

function showFatalError(msg: string) {
  const el = document.createElement('div')
  el.setAttribute('style', 'position:fixed;inset:0;background:#0d1117;color:#e94560;padding:40px 20px;font-family:monospace;font-size:14px;white-space:pre-wrap;z-index:99999;overflow:auto')
  el.textContent = 'FATAL ERROR\n\n' + msg
  document.body.appendChild(el)
}

window.addEventListener('error', (e) => {
  showFatalError(`Uncaught: ${e.message}\n${e.filename}:${e.lineno}`)
})

window.addEventListener('unhandledrejection', (e) => {
  showFatalError(`Unhandled rejection: ${e.reason}`)
})

try {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
} catch (err) {
  showFatalError(`React mount failed: ${err}`)
}
