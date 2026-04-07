# 实现计划（含测试配套）

总则见 [`PROJECT_RULES.md`](./PROJECT_RULES.md)。

每一项在合并前应具备所列测试；完成大块后执行 **§ 验证清单**。

## 阶段 A — 已完成（本仓库骨架）

| 功能 | 实现位置 | 测试 |
|------|-----------|------|
| HOG2 链式移动 / 相邻间隔判定 | `src/game/flingBoard.ts` | `src/game/flingBoard.test.ts` |
| 19×10 关卡索引与 key | `src/levels/levelIndex.ts` | `src/levels/levelIndex.test.ts` |
| 空关卡包占位生成 | `scripts/generate-levels.ts` | `scripts/generate-levels.test.ts` |

**验证清单（阶段 A）**

```bash
npm run test
npm run coverage
npm run build
npm run levels:generate
```

---

## 阶段 B — 关卡生成（离线）

| 任务 | 说明 | 测试 |
|------|------|------|
| B1 反向生成 | 从 1 球起反向加球，保证可解；记录 `solution` 与 `stepCount` | `src/game/generator.test.ts`（属性/小棋盘用例） |
| B2 按难度填槽 | 对每个 (N, stage 1…10) 选 S 非降；失败时放宽棋盘或重试 | `generator` 集成测试 + 黄金样例 JSON |
| B3 写入 `LevelPack` | 190 条记录、`rulesVersion`、校验无重复 id | `scripts/validate-level-pack.test.ts`（读入 JSON 断言） |

---

## 阶段 C — 前端玩法

| 任务 | 说明 | 测试 |
|------|------|------|
| C1 加载 `levels.json` | fetch + 解析 | `src/app/loadLevels.test.ts`（mock fetch） |
| C2 棋盘渲染 | DOM 或 Canvas；由 `piecePositions` 驱动 | 组件/快照或截图测试（可选 Playwright 后期） |
| C3 选中球 + 四向 / 滑动手势 | 状态机；与 `canMove` 一致 | `src/input/swipe.test.ts`（手势解析纯函数） |
| C4 执行步 | 仅当 `canMove` 为真调用 `move` | `src/app/applyMove.test.ts` |
| C5 撤销 | 栈保存 `FlingBoard` 克隆 | `undo.test.ts` |
| C6 胜利 / 非法 0 球 | UI 文案与流程 | 与 `flingBoard` 复用断言 |
| C7 移动动画 | 链式一步的滚动 / 撞击 / 飞出：WAAPI；`computeMovePlan` 预计算；幽灵格；滚动中分层球（高光固定、球面旋转），停球/停驻时 `swapToPlush` 与 `.ball-plush` 对齐；动画结束后再 `move` | `flingBoard.test.ts`（`computeMovePlan`） |

---

## 阶段 D — 提示与进度（已完成）

| 任务 | 测试 |
|------|------|
| D1 提示：执行 `solution` 下一步（与盘面前缀对齐） | `hint.test.ts`、`gameSession.test.ts` |
| D2 `localStorage` 进度 | `progress.test.ts`（MemoryStorage） |

---

## 阶段 E — 质量闸门（已完成）

| 闸门 | 命令 / 动作 |
|------|----------------|
| 单元 + 生成器 | `npm run test` |
| 覆盖率阈值 | `npm run coverage`（`vite.config.ts` 中 `coverage.thresholds`） |
| 关卡包校验 | `npm run levels:validate` |
| E2E | `npm run test:e2e`（需先 `npm run build` 或 `npm run verify:e2e`）；`e2e/first-level.spec.ts` 通关第一槽 |

**一键**

- `npm run verify`：test + coverage（含阈值）+ build + `levels:validate`
- `npm run verify:e2e`：build + Playwright
- `npm run verify:all`：`verify` 后再跑 Playwright（不再重复 build）

首次 E2E：`npx playwright install chromium`（或 `npm run test:e2e:install`）。

---

## 里程碑顺序建议

1. 阶段 B 完成 → `public/levels.json` 含 190 关且通过校验脚本。  
2. 阶段 C1–C4 → 可玩固定关卡。  
3. C5、D1、D2 → 体验完整。  
4. 阶段 E：覆盖率阈值 + `levels:validate` + 可选 E2E（已接入）。
