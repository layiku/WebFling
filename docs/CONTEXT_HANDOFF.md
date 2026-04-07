# 下一阶段 Context 交接（Fling Web）

本文浓缩当前开发中已确认的事实、约定与坑点，供新会话或他人接续。**细则仍以** `docs/PROJECT_RULES.md` **与代码为准**。

---

## 1. 项目是什么

- **目标**：在浏览器里复刻 iOS 类 **Fling** 谜题（网格、四向发射、**HOG2 链式**碰撞、球打出界直至剩 1 球）。
- **技术栈**：Vite + TypeScript；逻辑可单测（Vitest）；关卡 **预生成 JSON**，运行时**不随机生成关卡**。
- **仓库根**：`c:\coding\FlingInC`（或你的克隆路径）。

---

## 2. 规则权威来源

- **移动语义**：与 HOG2 `FlingBoard::Move` / `CanMove` 对齐；实现见 [`src/game/flingBoard.ts`](src/game/flingBoard.ts)。
- **要点**：不能「邻格直撞」；不能无碰撞把球打出界；链式：撞球后母球停前一格，被撞球继承方向继续滑，出界移除。
- **胜负**：恰好 1 球为胜；**0 球为错误终局**（正常不应出现）。
- **完整产品约定**：[`docs/PROJECT_RULES.md`](PROJECT_RULES.md)。

---

## 3. 关卡与数据

- **规模**：球数 **N = 2 … 16** → **15 个大关**；每大关 **5** 小关 → **75** 个固定槽位（`TOTAL_LEVEL_SLOTS`）。
- **棋盘**：当前生成器固定 **7×8** 格（`scripts/generate-levels.ts` 中 `BOARD_W` / `BOARD_H`），详见 [`LEVEL_SPEC.md`](LEVEL_SPEC.md)。
- **id**：`w{N}-s{S}`（例 `w7-s3`）；线性下标 **0…74** 与工具见 [`src/levels/levelIndex.ts`](src/levels/levelIndex.ts)。
- **难度序**：同一 N 下 **步数 S 越小越简单**；S 相同则 **N 越小越简单**；同 world 内 5 关建议 **S 非降**。
- **运行时加载**：默认 [`public/levels.json`](public/levels.json)（由脚本生成）。
- **JSON 类型**：[`src/levels/schema.ts`](src/levels/schema.ts)；版本字段 **`rulesVersion`**，规则变更需递增并重算关卡包。
- **界面语言**：`src/app/i18n.ts`，`localStorage` 键 **`fling-ui-locale`**。

---

## 4. 已实现模块（阶段 A / B 相关）

| 区域 | 路径 | 说明 |
|------|------|------|
| 棋盘内核 | `src/game/flingBoard.ts` | `canMove` / `move` / `createBoard`；`computeMovePlan`（动画预计算，与 `move` 一致） |
| 移动动画 | `src/app/runMoveAnimation.ts` | WAAPI：`roll` / `impact` / `flyOff`；幽灵格；滚动中分层球，停驻时 `swapToPlush` 换 `.ball-plush` 与静止球像素一致；由 `gameUi` 在应用 `move` 前调用 |
| 反向生成 | `src/game/reverseGen.ts` | `tryReverseAddBall`、`generateLevel`、回放与校验 |
| 关卡索引 | `src/levels/levelIndex.ts` | 15×5=75、key、线性下标 0…74 |
| 界面 i18n | `src/app/i18n.ts` | 中英文文案与 `document.documentElement.lang` |
| 离线生成 | `scripts/generate-levels.ts` | `buildPack`、`collectLevelsForWorld`；**勿在 Vitest 里直接 import 后无 guard 执行 main** |
| 校验 | `scripts/validate-level-pack.ts` | `validateLevelPack`；读 `public/levels.json` |
| 测试 | `*.test.ts` | 含 `flingBoard`、`reverseGen`、`levelIndex`、`generate-levels`、`validate-level-pack` |

---

## 5. 关卡生成逻辑（重要）

- **思路**：从 **1 球终局**出发，反复做 **反向一步**（`tryReverseAddBall`）得到多球初局；正向解法为反向记录的逆序。
- **反向一步的两种来源**：  
  1. **快速路径**：在目标局面的**每个空格**上尝试多放一球，再枚举发球（很多前驱是「终局 + 一球」）。  
  2. **随机路径**：随机 `(k+1)` 个不同格摆球，再枚举发球（覆盖链式才出现的前驱）。
- **性能**：曾极慢的主因是纯随机 `(k+1)`-子集命中率随 `k` 暴跌；快速路径 + 稀疏抽样（`randomDistinctPositions`）已缓解。全量 **75 关**生成通常较快；若扩展关数可再考虑按 world 并行或缓存。

---

## 6. 工具与命令

```bash
npm run dev              # 开发
npm run test             # 单元测试（Vitest，environment: node）
npm run build
npm run levels:generate  # 写 public/levels.json（可用环境变量见下）
npm run levels:validate  # 校验 JSON
npm run verify           # test + coverage + build + levels:validate（见 package.json）
```

**生成相关环境变量**（可选）：

- `LEVELGEN_MAX_WORLD`：只生成到某 world（例如调试 `4` 表示 world 2–4）。
- `LEVELGEN_SEED`：主种子（默认见 `scripts/generate-levels.ts` 内 `DEFAULT_MASTER_SEED`）。

---

## 7. 已踩过的坑

1. **`scripts/generate-levels.ts` 底部 `main()`**  
   若在测试里 **import** 该文件且无条件执行 `main()`，会触发**全量关卡生成**，Vitest 会卡死很久。当前用 **`if (!process.env['VITEST']) { main() }`** 避免；`validate-level-pack.ts` 同理。

2. **Vitest 与 `happy-dom`**  
   纯逻辑测试已改为 **`environment: 'node'`**（见 `vite.config.ts`），避免 Windows 上偶发卡顿。

3. **后台进程**  
   长时间 `levels:generate` / 卡住的 `vitest` 可能残留 Node 进程，必要时手动结束 PID。

4. **关卡条数与校验**  
   `validateLevelPack(pack, expectedCount)` 第二个参数默认 **`TOTAL_LEVEL_SLOTS`（75）**；若只生成部分 world，需传 **实际条数**，否则会报数量不符。

5. **棋盘触摸 / 指针**  
   触摸设备上若未设置 `touch-action: none`，浏览器可能把滑动当成滚动并 `pointercancel`，表现为滑动无反应。`gameUi` 用单次 `pointerdown`→`pointerup` 判定选球或发射，新 `pointerdown` 须清理上一组 window 监听，避免泄漏导致偶发卡死。详见 `README.md`「指针与触摸」。

---

## 8. 文档索引

| 文件 | 用途 |
|------|------|
| [`PROJECT_RULES.md`](PROJECT_RULES.md) | 单一事实来源（规则 + 产品 + 工程约定） |
| [`LEVEL_SPEC.md`](LEVEL_SPEC.md) | JSON、75 关拓扑、7×8 棋盘 |
| [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) | 分阶段计划（A 完成；B 生成/校验；C 前端…） |
| [`TEST_TRACEABILITY.md`](TEST_TRACEABILITY.md) | 需求 ↔ 测试表 |
| [`README.md`](../README.md) | 命令与目录入口 |

---

## 9. 下一阶段建议（未做或未完成）

- **可选调优**：动画时长/缓动曲线、被撞球飞出距离 `FLYOFF_ROLL_PX`、撞击前停顿 `SETTLE_MS_BEFORE_IMPACT`（见 `runMoveAnimation.ts`）。
- **全量生成**：在无 `LEVELGEN_MAX_WORLD` 下跑通 `levels:generate`，再 `levels:validate` 确认 **75** 条（或传入的 `expectedCount`）。
- **可选**：生成耗时统计、按 world 并行、`levels.json` 体积优化。

**已实现（前端）**：`levels.json` 加载、棋盘 DOM、选球、四向/滑动、`canMove`、撤销、提示、进度、**链式移动动画**、**中英文界面**（见 `README.md`、`src/app/i18n.ts`）。

---

## 10. 修订

| 日期 | 说明 |
|------|------|
| 2026-04-06 | 初稿：规则、生成逻辑、坑点、命令、下一阶段 |
| 2026-04-07 | 补充：`computeMovePlan` / `runMoveAnimation`、分层球与样式要点、README「移动动画」 |
| 2026-04-08 | `swapToPlush` 色差；指针：`touch-action`、选球/滑动合并、`pointerId`、监听器清理 |
| 2026-04-09 | 关卡规模 75、棋盘 7×8、校验默认条数；i18n；与 `LEVEL_SPEC` / `PROJECT_RULES` 对齐 |
