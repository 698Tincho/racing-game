import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { Garage } from './garage/Garage'
// Exo 2: heavy italic for headings, medium for text.
import '@fontsource-variable/exo-2/wght.css'
import '@fontsource-variable/exo-2/wght-italic.css'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>{new URLSearchParams(window.location.search).has('garage') ? <Garage /> : <App />}</StrictMode>,
)
