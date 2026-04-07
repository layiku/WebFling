# 关卡数据规格（固定 190 关）

玩法、大关结构、难度序等**总则**见 [`PROJECT_RULES.md`](./PROJECT_RULES.md)。

## 规则版本

- **rulesVersion**：正整数；与 `src/game/flingBoard.ts` 中的移动语义同步。若碰撞/链式规则变更，递增并重算关卡包。
- **参考实现**：HOG2 `FlingBoard::Move` / `CanMove`（无障碍、无洞子集）。

## 关卡拓扑

- **大关（World）**：球数 **N = 2 … 20**，共 **19** 个大关。
- **小关（Stage）**：每个大关 **10** 个小关，编号 **1 … 10**。
- **总槽位**：19 × 10 = **190** 关；每槽位对应唯一固定局面（预生成，运行时不再随机）。

## 标识符

- **字符串 id**：`w{N}-s{S}`，例如 `w7-s3` 表示 N=7、第 3 小关。
- **线性下标**：0 … 189，行优先：先排世界 2 的 10 关，再世界 3，… 直到世界 20。见 `src/levels/levelIndex.ts`。

## 难度序（排序用）

对每关记录：

- **ballCount** = N（该关初始球数；与所属 world 一致）。
- **stepCount** = S（参考解法步数；一步 = 一次合法 `move`，与 UI 一致）。

**比较规则**（与产品约定一致）：

1. N 相同：S **越小越简单**。
2. S 相同：N **越小越简单**。

同一 world 内 10 个小关应按 **S 非降** 排列（通常严格递增）；若生成器无法做到，在 `notes` 或数据审查中标注例外。

## JSON 形状

见 `src/levels/schema.ts` 中 `LevelPack` / `LevelRecord`。

`public/levels.json` 为运行时加载的默认包（可由 CI/后台产出后复制至此）。

### LevelRecord 字段说明

| 字段 | 说明 |
|------|------|
| `id` | `w{N}-s{S}` |
| `ballCount` | 初始球数 N |
| `stepCount` | 参考解法长度 |
| `width`, `height` | 棋盘尺寸 |
| `piecePositions` | 长度 N 的数组：棋子 id `i` 位于线性坐标 `piecePositions[i]`（行优先） |
| `solution` | 可选；用于提示/校验：`{ startCell, dx, dy }[]` |

## 非法终局

- 正常关卡不应出现场上 **0** 个球。若出现，视为数据或规则实现错误。
