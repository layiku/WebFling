import './style.css'
import { applyDocumentLocale, documentTitle, getUiLocale, loadingMessage } from './app/i18n.js'
import { loadLevelPack } from './app/loadLevels.js'
import { renderLoadFailure } from './app/renderLoadFailure.js'
import { mountGame } from './app/gameUi.js'

applyDocumentLocale(getUiLocale())
document.title = documentTitle(getUiLocale())

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('#app missing')

app.innerHTML = `<main class="shell"><p class="muted">${loadingMessage(getUiLocale())}</p></main>`

loadLevelPack('/levels.json')
  .then((pack) => {
    app.innerHTML = ''
    const main = document.createElement('main')
    main.className = 'shell'
    app.appendChild(main)
    mountGame(main, pack)
  })
  .catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err)
    renderLoadFailure(app, msg)
  })
