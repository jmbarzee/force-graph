import React from 'react'
import { createRoot } from 'react-dom/client'
import { themeChoiceOf } from '@jmbarzee/force-graph'
import { App } from './App'

// `?theme=dark` pins the pane's theme; anything else is "system".
const params = new URLSearchParams(location.search)
const initialTheme = themeChoiceOf(params.get('theme'))

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App initialTheme={initialTheme} initialFocus={params.get('focus')} />
  </React.StrictMode>,
)
