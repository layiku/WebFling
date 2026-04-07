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

- **规模**：球数 **N = 2 … 20** → **19 个大关**；每大关 **10** 小关 → **190** 个固定槽位。
- **id**：`w{N}-s{S}`（例 `w7-s3`）；线性下标与工具见 [`src/levels/levelIndex.ts`](src/levels/levelIndex.ts)。
- **难度序**：同一 N 下 **步数 S 越小越简单**；S 相同则 **N 越小越简单**；同 world 内 10 关建议 **S 非降**。
- **运行时加载**：默认 [`public/levels.json`](public/levels.json)（由脚本生成）。
- **JSON 类型**：[`src/levels/schema.ts`](src/levels/schema.ts)；版本字段 **`rulesVersion`**，规则变更需递增并重算关卡包。

---

## 4. 已实现模块（阶段 A / B 相关）

| 区域 | 路径 | 说明 |
|------|------|------|
| 棋盘内核 | `src/game/flingBoard.ts` | `canMove` / `move` / `createBoard` 等 |
| 反向生成 | `src/game/reverseGen.ts` | `tryReverseAddBall`、`generateLevel`、回放与校验 |
| 关卡索引 | `src/levels/levelIndex.ts` | 19×10、key、下标 |
| 离线生成 | `scripts/generate-levels.ts` | `buildPack`、`collectLevelsForWorld`；**勿在 Vitest 里直接 import 后无 guard 执行 main** |
| 校验 | `scripts/validate-level-pack.ts` | `validateLevelPack`；读 `public/levels.json` |
| 测试 | `*.test.ts` | 含 `flingBoard`、`reverseGen`、`levelIndex`、`generate-levels`、`validate-level-pack` |

---

## 5. 关卡生成逻辑（重要）

- **思路**：从 **1 球终局**出发，反复做 **反向一步**（`tryReverseAddBall`）得到多球初局；正向解法为反向记录的逆序。
- **反向一步的两种来源**：  
  1. **快速路径**：在目标局面的**每个空格**上尝试多放一球，再枚举发球（很多前驱是「终局 + 一球」）。  
  2. **随机路径**：随机 `(k+1)` 个不同格摆球，再枚举发球（覆盖链式才出现的前驱）。
- **性能**：曾极慢的主因是纯随机 `(k+1)`-子集命中率随 `k` 暴跌；快速路径 + 稀疏抽样（`randomDistinctPositions`）已缓解。全量 **190 关**生成仍可能需**数分钟**，属预期；可再考虑按 world 并行或缓存。

---

## 6. 工具与命令

```bash
npm run dev              # 开发
npm run test             # 单元测试（Vitest，environment: node）
npm run build
npm run levels:generate  # 写 public/levels.json（可用环境变量见下）
npm run levels:validate  # 校验 JSON
npm run verify           # test + build + levels:validate
```

**生成相关环境变量**（可选）：

- `LEVELGEN_MAX_WORLD`：只生成到某 world（例如调试 `4` 表示 world 2–4）。
- `LEVELGEN_SEED`：主种子（默认见 `scripts/generate-levels.ts` 内 `DEFAULT_MASTER_SEED`）。

---

## 7. 已踩过的坑

1. **`scripts/generate-levels.ts` 底部 `main()`**  
   若在测试里 **import** 该文件且无条件执行 `main()`，会触发**全量 190 关生成**，Vitest 会卡死很久。当前用 **`if (!process.env['VITEST']) { main() }`** 避免；`validate-level-pack.ts` 同理。

2. **Vitest 与 `happy-dom`**  
   纯逻辑测试已改为 **`environment: 'node'`**（见 `vite.config.ts`），避免 Windows 上偶发卡顿。

3. **后台进程**  
   长时间 `levels:generate` / 卡住的 `vitest` 可能残留 Node 进程，必要时手动结束 PID。

4. **关卡条数与校验**  
   `validateLevelPack(pack, expectedCount)` 第二个参数默认 **190**；若只生成部分 world，需传 **实际条数**（如 30），否则会报数量不符。

---

## 8. 文档索引

| 文件 | 用途 |
|------|------|
| [`PROJECT_RULES.md`](PROJECT_RULES.md) | 单一事实来源（规则 + 产品 + 工程约定） |
| [`LEVEL_SPEC.md`](LEVEL_SPEC.md) | JSON / 190 关结构 |
| [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) | 分阶段计划（A 完成；B 生成/校验；C 前端…） |
| [`TEST_TRACEABILITY.md`](TEST_TRACEABILITY.md) | 需求 ↔ 测试表 |
| [`README.md`](../README.md) | 命令与目录入口 |

---

## 9. 下一阶段建议（未做或未完成）

- **前端**：加载 `levels.json`、棋盘渲染、选球、滑动/四向、`canMove` 门禁、撤销、胜利/错误提示（见 `IMPLEMENTATION_PLAN.md` 阶段 C）。
- **全量生成**：在无 `LEVELGEN_MAX_WORLD` 下跑通 `levels:generate`，再 `levels:validate` 确认 **190** 条。
- **可选**：生成耗时统计、按 world 并行、覆盖率阈值、`levels.json` 体积优化。

---

## 10. 修订

| 日期 | 说明 |
|------|------|
| 2026-04-06 | 初稿：规则、生成逻辑、坑点、命令、下一阶段 |
