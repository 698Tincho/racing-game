import { readFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { gantryMarkup } from './src/ui/gantry'

/**
 * The loading screen from the very first frame: its styles go straight into
 * the page's <head> and the start gantry into its body, before the rest of the
 * styles and the game's code have even arrived.
 */
const loadingScreen = (): Plugin => ({
  name: 'loading-screen',
  transformIndexHtml: (html) => {
    const css = readFileSync(new URL('./src/ui/loading.css', import.meta.url), 'utf8')
    return html.replace('</head>', `<style>${css}</style>\n  </head>`).replace('<!-- gantry -->', gantryMarkup())
  },
})

export default defineConfig({
  plugins: [react(), loadingScreen()],
})
