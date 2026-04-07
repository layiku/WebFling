# 关卡题目生成说明

本文说明离线脚本如何生成 `public/levels.json`：**算法思路**、**端到端流程**、以及**命令与环境变量**。移动规则与棋盘语义以 `docs/PROJECT_RULES.md` 与 `src/game/flingBoard.ts` 为准。

---

## 1. 产物与规模

| 项目 | 说明 |
|------|------|
| 输出文件 | `public/levels.json`（由 `npm run levels:generate` 写入） |
| 关卡数 | **75**：球数 world **N = 2 … 16** 共 15 个大关 × 每大关 **5** 小关（`src/levels/levelIndex.ts`） |
| 棋盘 | 固定 **7 列 × 8 行**（`scripts/generate-levels.ts` 中 `BOARD_W` / `BOARD_H`） |
| 每关字段 | `id`、`ballCount`、`stepCount`、`width`、`height`、`piecePositions`、`solution` 等，见 `src/levels/schema.ts` |

运行时游戏**只读取**该 JSON，不在浏览器里随机生成关卡。

---

## 2. 核心算法（单关：`generateLevel`）

实现位置：`src/game/reverseGen.ts` 中的 `generateLevel`。

### 2.1 思路：随机摆球 + 有界深度优先搜索（DFS）求证可解

当前主路径是 **正向「生成—求解」**，而非从终局反向拼初局：

1. 在 `width × height` 个格子上 **随机选取 N 个互不相同的格子** 放置 N 个球（`randomKSortedIndices`：球少时稀疏拒绝抽样，球多时 Fisher–Yates）。
2. **可选预筛**（默认开启，见下）：剔除明显不合理的初始布局，减少进入 DFS 的次数。
3. 对该局面调用 **`solveDFS`**：在 HOG2 规则下搜索一条能把球数从 N **消到 1** 的步序列。合法一步恰好消去一球，故解的长度恒为 **N − 1**（N = 1 时解为空数组）。
4. 若在单次尝试的步数上限内找不到解，则换一批随机位置重试；超过 `roundTries` 等派生上限仍无解则返回 `null`。

### 2.2 随机数

使用 **Mulberry32**（`mulberry32`），输出 `[0, 1)` 均匀浮点，供摆球与脚本层种子派生使用。

### 2.3 预筛条件（`skipPreFilters === false` 时）

- **`hasIsolatedBall`**：若某球所在行、列都只有它自己，则该球永远无法参与任何发射（行/列上无同伴），整局不可解 → 丢弃。
- **`isConnected`**：将「同行或同列」视为连边，若多球不连通则永远无法相互作用 → 丢弃。

**注意**：在「初始看似孤立、但经过若干步后另一球滚入同行/列」才可解的情形下，上述静态预筛会**误杀**部分可解布局。因此当脚本需要更多 **非共线**（non-collinear）布局时，会对特定 world 调用 `generateLevel(..., { skipPreFilters: true })`，让 DFS 单独判定可解性（见第 3 节）。

### 2.4 DFS 求解器（`solveDFS`）

- **状态**：当前棋盘占用情况；每步枚举每个有球格子的四向 `canMove`，`cloneBoard` + `move` 进入下一层。
- **剪枝**  
  - **死局记忆**：用占用键（`fastKey`）记入 `Set`，已证无解的状态不再展开。  
  - **孤立球剪枝**：仅在**剩余恰好 2 球**时启用 `hasIsolation` 检查。若剩余 ≥ 3 球，则不能对「当前孤立」过早剪枝——因为后续可能有球滚入同一行/列使该球可动。  
- **上限**：`maxSolverStates`（默认 20 万）内未找到解则视为本局尝试失败（返回 `null`）。

### 2.5 与「反向一步」代码的关系

`tryReverseAddBall`（在终局上尝试「多放一球再发一球」以得到上一局面）仍保留在 `reverseGen.ts` 中，可用于单测或实验；**`scripts/generate-levels.ts` 打包时不走这条链**。交接摘要见 **`docs/CONTEXT_HANDOFF.md`** §5，已与本文对齐。

### 2.6 为何不用「倒推法」作为主生成方式

这里的**倒推法**指：从 **1 球终局**出发，反复调用「反向一步」把局面扩成 **N 球初局**，再把记录的正向步序**逆序**作为关卡解法。理论上这样得到的关卡**一定可解**（因为每一步反向操作在真实规则下都有对应正向步）。本项目仍把 **`generateLevel` 的正向随机摆球 + DFS** 作为离线主路径，原因包括：

1. **与运行时同一套判定，结论直观**  
   正向流程是：先有一个初局，再用与游戏一致的 `canMove` / `move` 做 DFS，**找到解才收关**。解法即关卡数据里的 `solution`，无需再证明「倒推链」与「玩家可走步」在边界情况（链式碰撞、停球格等）上完全一致——逻辑全在 `flingBoard` + `solveDFS` 一条路上。

2. **倒推的采样效率与实现成本**  
   从 k 球目标局面扩到 k+1 球前驱时，需要在大量候选布局上尝试「加一球再枚举发球」；随机摆放 (k+1) 个子集时，**命中率随 k 增大而明显下降**（历史上这是全量生成变慢的主要原因之一）。正向策略则是：**预筛掉明显无解的初局**后，对单次布局做**有界 DFS**；无解则换一批随机位置，成本模型更简单，也便于调 `maxSolverStates`、重试次数等参数。

3. **多样性与打包策略更好对齐**  
   离线脚本要对 **75 关**做 **相似度去重**、**共线数量上限**、按**步数**排序等。这些规则直接作用在「最终初局 + 求出的解」上即可。若主路径是倒推，往往还要额外设计随机性（从哪种终局出发、反向分支如何分叉），否则容易集中在某一类「易反向到达」的形状上；正向随机初局 + 拒绝/重试与现有 `isTooSimilar` 等钩子配合更直接。

4. **链式局面不必单独建模**  
   倒推时每步要找到「发一球后占用与当前目标一致」的前驱，链式碰撞下前驱搜索空间复杂。正向 DFS 从初局出发枚举合法步，**自然覆盖链式**，与玩家实际解题方式一致。

**小结**：倒推法在谜题生成里是经典思路，本仓库仍保留 `tryReverseAddBall` 供需要时使用；当前选用正向生成，主要是为了 **实现简单、与校验同源、参数与去重好调、以及工程上可接受的生成耗时**。若将来要专门生成「极短解」「特定终局形状」等，可以再评估以倒推为辅助或混合策略。

---

## 3. 整包流程（`buildPack` / `collectLevelsForWorld`）

实现位置：`scripts/generate-levels.ts`。

### 3.1 按 world 收集 5 关

对每个 **world = N**（球数，2…16，或受 `LEVELGEN_MAX_WORLD` 截断）：

1. 用 **主种子**派生每轮尝试的 RNG：  
   `mulberry32(masterSeed + world * 1_000_003 + seedSlot * 1_315_423_911)`，保证可复现。
2. 多批循环（最多 12 批），每批尝试若干次 `generateLevel(BOARD_W, BOARD_H, world, rng, { … })`：  
   - `roundTries`、`maxSolverStates` 随 world 调整；  
   - 若已收满「全共线」关卡配额，则对 **world ≤ 5** 时设 `skipPreFilters: true`，以便搜到需要链式才能解开的布局。
3. **共线配额**：world ≥ 3 时，同一 world 内 **全球共线（同一行或同一列）** 的关卡最多 **1** 个，以增加形状多样性。world = 2 时两球可解布局本质上常共线，脚本对 world 2 **跳过去重**（`skipDedup`）。
4. **相似度去重**（world ≠ 2）：新候选与已接受关卡比较，过则丢弃：  
   - 矩形 **8 对称**（旋转 + 反射）下的 **规范型**相同；或  
   - **Jaccard** 相对坐标重叠高于随球数变化的动态阈值；或  
   - **两两曼哈顿距离多重集**相同且 Jaccard 超过阈值的 0.6 倍等组合条件（见 `isTooSimilar`）。
5. 收满 5 关后，按 **解法长度升序** 排序，使同 world 内 **步数少 → 多**（通常 easier → harder）。

### 3.2 打包与元数据

- `buildPack` 组装 `LevelPack`：`rulesVersion`、`generatedAt`、各关 `LevelRecord`。
- 默认主种子：`DEFAULT_MASTER_SEED`（可用 `LEVELGEN_SEED` 覆盖）。

---

## 4. 操作指令

### 4.1 生成关卡包

```bash
npm install
npm run levels:generate
```

成功后会重写 **`public/levels.json`**，并在标准输出打印路径与关卡条数、种子。

### 4.2 校验

```bash
npm run levels:validate
```

生成逻辑或种子修改后，建议与单元测试、校验一并跑通（见根目录 `README.md` 中 `verify` / `verify:all`）。

### 4.3 环境变量（可选）

| 变量 | 作用 |
|------|------|
| `LEVELGEN_SEED` | 主种子（`>>> 0` 无符号化）；缺省为脚本内 `DEFAULT_MASTER_SEED` |
| `LEVELGEN_MAX_WORLD` | 只生成到指定 **world（球数 N）**，用于调试；实际 world 范围为 `MIN_WORLD_BALLS`…`min(MAX_WORLD_BALLS, 该值)` |

若只生成部分 world，`levels:validate` 的期望条数可能需与 `validate-level-pack` 的调用参数一致（见 `README.md` 与 `scripts/validate-level-pack.ts`）。

### 4.4 测试注意

`generate-levels.ts` 末尾在 **`VITEST` 未设置**时才执行 `main()`，避免在 Vitest 中 import 时意外触发全量写盘与长时间生成。

---

## 5. 相关文件索引

| 路径 | 内容 |
|------|------|
| `scripts/generate-levels.ts` | 打包、去重、共线配额、写 `levels.json` |
| `src/game/reverseGen.ts` | `generateLevel`、`solveDFS`、Mulberry32、校验与回放 |
| `src/game/flingBoard.ts` | 规则内核 `canMove` / `move` |
| `src/levels/schema.ts` | JSON 类型 |
| `src/levels/levelIndex.ts` | 75 槽、id、线性下标 |
| `docs/LEVEL_SPEC.md` | 关卡数据与拓扑约定 |
| `docs/PROJECT_RULES.md` | 玩法与工程约定 |

---

## 6. 修订

| 日期 | 说明 |
|------|------|
| 2026-04-07 | 初稿（含为何不用倒推）；与 `CONTEXT_HANDOFF`、`LEVEL_SPEC`、`PROJECT_RULES`、`IMPLEMENTATION_PLAN`、`README.en` 交叉引用同步 |
