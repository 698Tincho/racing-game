import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { Garage } from './garage/Garage'
// Archivo, the game's one face, with its width axis: condensed for names and buttons, regular for text,
// three-quarter width for times, expanded for the menu's race number.
import '@fontsource-variable/archivo/wdth.css'
import '@fontsource-variable/archivo/wdth-italic.css'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>{new URLSearchParams(window.location.search).has('garage') ? <Garage /> : <App />}</StrictMode>,
)
