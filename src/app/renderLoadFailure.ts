/**
 * 加载失败时用 DOM API 写入纯文本，避免 innerHTML 拼接用户/网络消息导致 XSS。
 */
export function renderLoadFailure(root: HTMLElement, message: string): void {
  root.replaceChildren()
  const main = document.createElement('main')
  main.className = 'shell'
  const p = document.createElement('p')
  p.className = 'muted'
  p.textContent = `无法加载关卡：${message}`
  main.appendChild(p)
  root.appendChild(main)
}
