import './style.css'
import { loadLevelPack } from './app/loadLevels.js'
import { renderLoadFailure } from './app/renderLoadFailure.js'
import { mountGame } from './app/gameUi.js'

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('#app missing')

app.innerHTML = `<main class="shell"><p class="muted">加载关卡…</p></main>`

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
