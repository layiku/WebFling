import './style.css'
import { applyDocumentLocale, documentTitle, getUiLocale, loadingMessage } from './app/i18n.js'
import { loadLevelPack } from './app/loadLevels.js'
import { renderLoadFailure } from './app/renderLoadFailure.js'
import { mountGame } from './app/gameUi.js'

applyDocumentLocale(getUiLocale())
document.title = documentTitle(getUiLocale())

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('#app missing')

const loadingMain = document.createElement('main')
loadingMain.className = 'shell'
const loadingP = document.createElement('p')
loadingP.className = 'muted'
loadingP.textContent = loadingMessage(getUiLocale())
loadingMain.appendChild(loadingP)
app.appendChild(loadingMain)

loadLevelPack('/levels.json')
  .then((pack) => {
    app.replaceChildren()
    const main = document.createElement('main')
    main.className = 'shell'
    app.appendChild(main)
    mountGame(main, pack)
  })
  .catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err)
    renderLoadFailure(app, msg)
  })
