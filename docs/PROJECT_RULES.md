# 项目规则（跨 Context 单一事实来源）

本文档供新会话、协作与自动化代理阅读：**若与对话或旧记忆冲突，以本文与 `src/` 中当前实现为准**；实现变更时须同步修订本文及相关 `docs/`。

---

## 1. 项目目标

在浏览器中复刻 iOS **Fling** 类谜题：**网格、四向发射、链式碰撞、球被击出棋盘直至剩一球**。  
技术栈：**Vite + TypeScript**；核心逻辑须可测（Vitest），关卡数据**预生成**，运行时**不依赖随机生成关卡**。

---

## 2. 棋盘规则（权威实现）

### 2.1 参考来源

- **语义来源**：HOG2（Nathan Sturtevant）中 `FlingBoard::Move` / `CanMove` 的**链式**行为。  
- **代码权威**：`src/game/flingBoard.ts`（当前为**无障碍、无洞**子集，与 HOG2 一致部分）。

### 2.2 移动合法性 `canMove`

- 仅 **上下左右** 四向。
- 沿方向逐格扫描：若**第一个**有子的格子与起点**相邻**（中间无空档），则该方向 **不合法**（「至少空一格再撞」）。
- 若沿该方向在**出界前**始终无子，则 **不合法**（不允许无碰撞直接把球打出界；单独一球时通常无可行方向）。

### 2.3 执行一步 `move`

- 发射球沿方向滑动；**空档**上表现为「当前运动球」逐格前进。
- **撞到另一球**：发射球停在**撞击前**所占的**前一格**；**被撞球**继承运动方向继续滑（链式）。
- **出界**：当前正在运动的那颗球离开棋盘边界则从盘面**移除**。
- UI 必须在调用 `move` 前用 `canMove` 判定；否则可能出现非法局面（例如独球被移出界导致 **0 球**）。

### 2.4 胜负与错误终局

| 状态 | 条件 |
|------|------|
| **胜利** | 场上**恰好 1** 个球。 |
| **错误** | 场上 **0** 个球（正常关卡与正确实现不应出现；出现则视为 Bug 或非法操作）。 |
| **进行中** | 球数 ≥ 2。 |

---

## 3. 关卡与产品规则

### 3.1 规模与结构

- 球数 **N** 取值 **2 … 16** → **15 个大关**（World），见 `src/levels/levelIndex.ts`（`MIN_WORLD_BALLS`…`MAX_WORLD_BALLS`）。
- 每个大关含 **5** 个小关（Stage **1 … 5**，`STAGES_PER_WORLD`）。
- 总固定槽位：**15 × 5 = 75** 关；每槽对应**唯一预生成**初始局面。
- **大关编号 = N**（该大关内所有小关的初始球数均为 **N**）。
- **棋盘格数（当前生成器）**：`scripts/generate-levels.ts` 固定 **7×8**；每关 JSON 的 `width` / `height` 与此一致。

### 3.2 标识与索引

- 关卡字符串 id：`w{N}-s{S}`（例：`w7-s3`）。
- 线性下标 **0 … 74**：行优先，先 `w2-s1…s5`，再 `w3-s1…`，直至 `w16-s5`。详见 `src/levels/levelIndex.ts`。

### 3.3 难度（用于排序与选关）

每关记录 **ballCount = N**、**stepCount = S**（参考解法步数；一步 = 一次合法发射/链式结束前的完整 `move` 语义与项目约定一致）。

- **N 相同**：**S 越小越简单**。
- **S 相同**：**N 越小越简单**。

同一 world 内 5 小关建议 **S 非降**（通常严格递增）；若无法满足须在数据或文档中说明。

### 3.4 关卡数据

- 运行时加载 **`public/levels.json`**（或由 CI/后台产出后部署的等价 URL）。
- JSON 形状见 `src/levels/schema.ts`；版本字段 **`rulesVersion`**：只要 **§2** 的移动语义变更，须递增并重算或废弃旧包。
- 详细字段、拓扑与非法终局约定见 `docs/LEVEL_SPEC.md`。

### 3.5 开源许可证

- 本项目以 **MIT License** 发布；全文见仓库根目录 **`LICENSE`**，与 **`package.json`** 的 `license` 字段一致。

---

## 4. 工程与质量规则

### 4.1 测试

- 新功能须有对应 **Vitest** 用例；需求与测试对应关系维护在 `docs/TEST_TRACEABILITY.md`。
- 合并前建议执行：`npm run verify`（`test` + `coverage` + `build` + `levels:validate`）；发布前可再跑 `npm run verify:all`（含 Playwright E2E）。

### 4.2 文档联动

- 修改规则或关卡结构时：**至少**更新本文、`LEVEL_SPEC.md`（若涉数据）、`TEST_TRACEABILITY.md`（若涉需求行）。

### 4.3 代码边界

- 避免无关重构；新逻辑优先落在独立模块；与 Fling 规则相关的变更必须落在 `src/game/` 并保持可单测。

### 4.4 移动动画（与规则的关系）

- **规则权威仍在** `src/game/flingBoard.ts`：`canMove` / `move` 不变。
- **动画**仅负责展示：一步内链式片段由 `computeMovePlan` 预计算（与 `move` 语义一致），`src/app/runMoveAnimation.ts` 用 WAAPI 播放后再由会话层调用 `move` 提交局面。滚动中用分层 DOM 表现旋转；球停下或撞击后占位时替换为 `.ball-plush`，与真实格一致、避免色差。详见 `README.md`「移动动画」。

### 4.5 棋盘输入（指针 / 触摸）

- **选球与滑动**由同一套 Pointer Events 在 `pointerup` 分支判定（位移不足为选球，足够为发射），不再依赖独立的 `click`，避免与动画状态竞态。
- **样式**：`.board .cell` 使用 `touch-action: none`，减少浏览器把触摸当成滚动而 `pointercancel`。
- **健壮性**：新 `pointerdown` 清理上一组 `window` 上的 `pointerup`/`pointercancel`；`pointerId` 过滤多指。详见 `README.md`「指针与触摸」与 `docs/CONTEXT_HANDOFF.md` §7。

### 4.6 界面语言（i18n）

- **中文 / 英文**文案在 `src/app/i18n.ts`；偏好键 **`fling-ui-locale`**（`zh` | `en`），存 `localStorage`。
- 与规则无关：仅影响 UI 与读屏 `aria-label`；`README.md` / `README.en.md` 互链。

---

## 5. 相关文件索引

| 文件 | 内容 |
|------|------|
| `docs/LEVEL_SPEC.md` | JSON 字段、75 关拓扑与 7×8 棋盘约定 |
| `docs/IMPLEMENTATION_PLAN.md` | 分阶段任务 |
| `docs/TEST_TRACEABILITY.md` | 需求 ↔ 测试表 |
| `src/game/flingBoard.ts` | 可执行规则；`computeMovePlan` 供动画预计算 |
| `src/app/runMoveAnimation.ts` | 一步移动的 WAAPI 动画编排 |
| `src/levels/levelIndex.ts` | 关卡 id 与下标（75 槽） |
| `src/app/i18n.ts` | 界面文案与中英文切换 |

---

## 6. 修订记录

| 日期 | 说明 |
|------|------|
| 2026-04-06 | 初版：HOG2 链式规则、19×10 固定关、难度序、工程约定 |
| 2026-04-06 | `verify` / `verify:all`、覆盖率阈值与 E2E 说明 |
| 2026-04-07 | §4.4 移动动画与规则边界；文件索引补充 `computeMovePlan` / `runMoveAnimation` |
| 2026-04-08 | §4.4 `swapToPlush`；§4.5 指针/触摸（README「指针与触摸」） |
| 2026-04-09 | §3 与 `LEVEL_SPEC` 对齐：15×5=75 关、N 2…16、棋盘 7×8；§4.6 i18n |
| 2026-04-10 | §3.5 MIT 许可证；README 文档节与 `LEVEL_SPEC` 交叉引用 |
