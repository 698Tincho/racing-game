import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { Garage } from './garage/Garage'
import '@fontsource/lilita-one'
import '@fontsource-variable/nunito'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>{new URLSearchParams(window.location.search).has('garage') ? <Garage /> : <App />}</StrictMode>,
)
