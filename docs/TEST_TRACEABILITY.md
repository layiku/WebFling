# 需求 ↔ 测试追溯表

项目总则见 [`PROJECT_RULES.md`](./PROJECT_RULES.md)。  
更新实现时 **同步更新本表**。最后一列填测试文件中的 `describe` 名或用例标题。

| 需求 / 功能 | 状态 | 测试位置 |
|-------------|------|----------|
| HOG2 `canMove`：首格不能有子；须隔至少一空撞到第一子 | 已实现 | `flingBoard.test.ts` → `canMove (adjacent gap rule)` |
| HOG2 `move`：链式传递、出界移除 | 已实现 | `flingBoard.test.ts` → `move (chain + exit)` |
| 独球不能直接击出界（`canMove` 为 false） | 已实现 | `flingBoard.test.ts` → `does not allow a lone ball...` |
| 胜负：恰好 1 球为胜；0 球为错误态 | 已实现 | `flingBoard.test.ts` → `win / error counts` |
| 15 世界 × 5 阶段 = 75 槽位 | 已实现 | `levelIndex.test.ts` |
| `wN-sS` key 与线性下标互转 | 已实现 | `levelIndex.test.ts` |
| 空关卡包生成脚本可运行 | 已实现 | `generate-levels.test.ts` + 手动 `npm run levels:generate` |
| 前向生成 + DFS 可解关卡（`reverseGen`） | 已实现 | `reverseGen.test.ts` |
| 75 关填满 + `levels:validate` | 已实现 | `validate-level-pack.test.ts` + 手动 `npm run levels:validate` |
| 加载 `levels.json` | 已实现 | `loadLevels.test.ts` |
| 手势解析（滑向四向） | 已实现 | `swipe.test.ts` |
| 撤销 | 已实现 | `gameSession.test.ts` → `undo restores` |
| 提示（下一步，执行 `solution`） | 已实现 | `hint.test.ts` + `gameSession.test.ts` → `packaged hint` |
| `localStorage` 进度（线性解锁） | 已实现 | `progress.test.ts` |
| 胜利后「下一关」解锁（须先 merge `cleared` 再判断） | 已实现 | `progress.test.ts` → `胜利后「下一关」导航` |
| 覆盖率阈值（Vitest v8） | 已实现 | `npm run coverage` + `vite.config.ts` → `thresholds` |
| E2E（第一关通关） | 已实现 | `e2e/first-level.spec.ts`（Playwright） |
| E2E（撤销） | 已实现 | `e2e/interactions.spec.ts` |
| E2E（重开） | 已实现 | `e2e/interactions.spec.ts` |
| E2E（语言切换） | 已实现 | `e2e/interactions.spec.ts` |
| E2E（多关导航） | 已实现 | `e2e/interactions.spec.ts` |
| E2E（键盘方向键） | 已实现 | `e2e/interactions.spec.ts` |
| 中英文 UI（`i18n`） | 已实现 | `i18n.test.ts` |
| 生产关卡固定 7×8：运行时加载器拒绝非 7×8 维度 | 已实现 | `loadLevels.test.ts` → `rejects non-7x8 dimensions` |
| 生产关卡固定 7×8：离线校验器拒绝非 7×8 维度 | 已实现 | `validate-level-pack.test.ts` → `rejects non-7x8 dimensions` |

## 如何检查「每个功能都有测试」

1. 打开本表，确认「待实现」行在交付前全部变为「已实现」并填测试位置。
2. 运行 `npm run coverage`，对新增模块在 `vite.config.ts` 中设置 `coverage.thresholds`。
3. 代码评审时对照 **IMPLEMENTATION_PLAN.md** 各阶段勾选项。
4. 注意：`npm run verify` 不含 E2E，完整验证请用 `npm run verify:all`。
