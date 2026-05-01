# 关卡数据规格

玩法、大关结构、难度序等**总则**见 [`PROJECT_RULES.md`](./PROJECT_RULES.md)。

## 规则版本

- **rulesVersion**：正整数；与 `src/game/flingBoard.ts` 中的移动语义同步。若碰撞/链式规则变更，递增并重算关卡包。
- **参考实现**：HOG2 `FlingBoard::Move` / `CanMove`（无障碍、无洞子集）。

## 关卡拓扑（与当前 `levelIndex.ts` 一致）

- **大关（World）**：球数 **N = 2 … 16**，共 **15** 个大关（`WORLD_COUNT`）。
- **小关（Stage）**：每个大关 **5** 个小关，编号 **1 … 5**（`STAGES_PER_WORLD`）。
- **总槽位**：15 × 5 = **75** 关；每槽位对应唯一固定局面（预生成，运行时不再随机）。
- **棋盘格数（当前生成器）**：离线脚本 **`scripts/generate-levels.ts`** 将棋盘固定为 **7 列 × 8 行**（`BOARD_W` × `BOARD_H`）；`levels.json` 中每关的 `width` / `height` 与此一致。算法与命令见 [`LEVEL_GENERATION.md`](./LEVEL_GENERATION.md)。

## 标识符

- **字符串 id**：`w{N}-s{S}`，例如 `w7-s3` 表示 N=7、第 3 小关。
- **线性下标**：**0 … 74**，行优先：先 `w2-s1…s5`，再 `w3-s1…`，直至 `w16-s5`。见 `src/levels/levelIndex.ts`。

## 难度序（排序用）

对每关记录：

- **ballCount** = N（该关初始球数；与所属 world 一致）。
- **stepCount** = S（参考解法步数；一步 = 一次合法 `move`，与 UI 一致）。

**比较规则**（与产品约定一致）：

1. N 相同：S **越小越简单**。
2. S 相同：N **越小越简单**。

同一 world 内 5 个小关的 S 值在当前规则下恒为 N−1（每步消一球），不存在递增空间；难度差异仅体现在布局复杂度上。

## JSON 形状

见 `src/levels/schema.ts` 中 `LevelPack` / `LevelRecord`。

`public/levels.json` 为运行时加载的默认包（可由 CI/后台产出后复制至此）。

### LevelRecord 字段说明

| 字段 | 说明 |
|------|------|
| `id` | `w{N}-s{S}` |
| `ballCount` | 初始球数 N |
| `stepCount` | 参考解法长度 |
| `width`, `height` | 棋盘尺寸（当前包均为 7×8） |
| `piecePositions` | 长度 N 的数组：棋子 id `i` 位于线性坐标 `piecePositions[i]`（行优先） |
| `solution` | **必填**；用于提示/校验：`{ startCell, dx, dy }[]` |

## 非法终局

- 正常关卡不应出现场上 **0** 个球。若出现，视为数据或规则实现错误。
