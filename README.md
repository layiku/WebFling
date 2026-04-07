# Fling Web（网页复刻）

**语言 / Languages:** [English](README.en.md)

Vite + TypeScript。棋盘规则对齐 **HOG2** 的链式 Fling（`src/game/flingBoard.ts`）。

游戏界面右上角 **EN / 中文** 可切换中英文；偏好保存在浏览器 `localStorage`（键 `fling-ui-locale`）。

## 使用说明

### 本地运行

1. 安装依赖：`npm install`
2. 启动开发服务：`npm run dev`，浏览器打开终端里提示的地址（一般为 `http://localhost:5173`）
3. 生产预览：先 `npm run build`，再 `npm run preview`

游戏从 `public/levels.json` 加载 **190 关**（19 个大关 × 10 小关）。无需再执行生成脚本即可游玩。

### 部署后怎么运行（生产环境）

本项目是纯前端静态站，**没有单独的后端服务**。部署步骤：

1. 在本机或 CI 安装依赖并构建：
   ```bash
   npm install
   npm run build
   ```
2. 构建结果在 **`dist/`** 目录（含 `index.html`、`assets/`、以及从 `public/` 拷过去的 **`levels.json`** 等）。把 **`dist/` 里的全部文件** 上传到你使用的静态托管即可。
3. 用浏览器打开站点根地址即可游玩（例如 `https://你的域名/`）。

**本机先验收再上传**：构建完成后执行 `npm run preview`，默认在 `http://localhost:4173` 提供与线上一致的静态预览；局域网访问可加 `npm run preview -- --host`。

**常见托管**：任意支持「只托管静态文件」的服务均可，例如 Nginx、对象存储 + CDN、Vercel、Netlify、Cloudflare Pages、GitHub Pages 等——上传 **`dist` 内容**（不是上传整个仓库）。

**若站点不在域名根路径**（例如 `https://user.github.io/仓库名/`），需要在 `vite.config.ts` 里配置 `base: '/仓库名/'` 再重新 `npm run build`，否则可能加载不到 `levels.json`。根域名或子域名根路径部署一般不用改 `base`。

### 操作

| 操作 | 说明 |
|------|------|
| 选球 | 在有毛球的格子上 **轻触/轻点**（位移小于滑动阈值）；再点同一格或点**空白格**可取消选中 |
| 发射 | 在持球格上 **滑动**（四向之一，滑动距离需略长）；或选中后按 **方向键**（↑↓←→） |
| 撤销 | 「撤销」一步（胜负后不可撤） |
| 重开 | 恢复本关初始局面 |
| 提示一步 | 按关卡数据中的参考解法执行下一步；若已走偏与参考不一致，会提示需撤销或重开 |
| 换关 | 「上一关」「下一关」；**下一关**需先通关当前关才会解锁（进度记在浏览器 `localStorage`） |

**指针与触摸（实现）**：棋盘格使用 **Pointer Events** 统一处理鼠标与触摸；`pointerup` 时若位移足够则发射，否则视为选球。`pointerdown` 对有球格调用 `preventDefault()`，配合 `src/style.css` 中 `.board .cell { touch-action: none }`，减少浏览器把滑动当成页面滚动而发出 `pointercancel`、或旧 `pointerup` 监听器泄漏导致的偶发无响应。新一次 `pointerdown` 会先清理上一组 `pointerup`/`pointercancel` 监听；多指时用 `pointerId` 匹配。

### 移动动画（实现要点）

一步合法移动会先播放 **Web Animations API** 动画，再更新棋盘数据；动画期间棋盘为 `aria-busy`，不可重复操作。

| 要点 | 说明 |
|------|------|
| 预计算 | `computeMovePlan`（`src/game/flingBoard.ts`）在不改盘面的前提下，生成 `roll` / `impact` / `flyOff` 片段序列，与 `move()` 语义一致。 |
| 播放 | `src/app/runMoveAnimation.ts`：幽灵格子（灰色背景随球平移）、**滚动中**用分层球体（`ball-surface` 按滚动方向旋转，`ball-gloss` 固定左上角高光）。 |
| 静止对齐 | 滚动结束、撞击后停驻占位时，将内层替换为与棋盘完全相同的 **`.ball-plush`**（`swapToPlush`），避免「分层叠加渐变」与「单层渐变」在数学上不等价导致的**停球瞬间色差**。飞出动画仍用分层直至淡出。 |
| 缓动 | 滑向目标为 `ease-out`；被撞飞出为 `ease-out`（避免起步停顿）；透明度在飞出后半段再淡出。 |
| 样式 | `src/style.css`：外圈彩色光晕用 `box-shadow` + `--glow`，避免 `filter: blur` 首帧与静止球不一致的闪烁。 |

### 棋盘坐标

- **列（横）**：从左到右为 `A`、`B`…`Z`，第 27 列起为 `AA`、`AB`…（与 Excel 列名相同）
- **行（纵）**：从上到下为 `1`、`2`、`3`…
- 某一格记作 **列字母 + 行数字**，例如左上角为 **A1**（无障碍时格子上方、左侧有对应标记）

### 深链

在地址后加查询参数可直接打开某一槽位，例如：`?level=0`（第 1 关）到 `?level=189`（最后一关）。若该关未解锁，会跳到当前可进入的关。

### 离线重新生成关卡（可选）

修改生成逻辑或种子后：`npm run levels:generate` 会重写 `public/levels.json`。可用环境变量 `LEVELGEN_MAX_WORLD`、`LEVELGEN_SEED` 做局部调试（见 `docs/CONTEXT_HANDOFF.md`）。生成后建议执行 `npm run levels:validate`。

## 脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 本地开发 |
| `npm run build` | 生产构建 |
| `npm run test` | 单元测试（Vitest） |
| `npm run coverage` | 单元测试 + 覆盖率（含 `vite.config.ts` 阈值） |
| `npm run levels:generate` | 生成 `public/levels.json` |
| `npm run levels:validate` | 校验关卡包 |
| `npm run test:e2e` | Playwright E2E（需已有 `dist/`，或先 `npm run build`） |
| `npm run test:e2e:install` | 安装 Chromium（首次 E2E 前执行一次） |
| `npm run verify:e2e` | `build` + E2E |
| `npm run verify` | test + coverage + build + `levels:validate` |
| `npm run verify:all` | `verify` 后再跑 E2E |

首次运行 E2E：`npm run test:e2e:install` 或 `npx playwright install chromium`。

## 文档

- **`docs/CONTEXT_HANDOFF.md`** — **给下一阶段的上下文摘要（规则、生成、坑点、命令）**  
- **`docs/PROJECT_RULES.md`** — **项目规则（玩法、关卡、工程约定；跨会话以该文档为准）**  
- `docs/LEVEL_SPEC.md` — 关卡数据与 190 关结构  
- `docs/IMPLEMENTATION_PLAN.md` — 分阶段实现与配套测试计划  
- `docs/TEST_TRACEABILITY.md` — 需求与测试对应表  

## 目录

- `src/game/` — 规则内核（含 `computeMovePlan` 供动画预计算）  
- `src/app/` — 界面与对局（含 `runMoveAnimation.ts` 移动动画）  
- `src/levels/` — 关卡索引与 JSON 类型  
- `scripts/` — 离线生成器等  
- `public/levels.json` — 运行时关卡包（由生成脚本产出）  

## 许可证

未指定；按你后续选择的许可证补充 `LICENSE`。
