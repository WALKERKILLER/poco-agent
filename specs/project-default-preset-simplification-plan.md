# 项目默认 Preset 简化方案

## 元数据

| 字段 | 值 |
|------|-----|
| **创建日期** | 2026-04-02 |
| **预期改动范围** | backend (projects, presets, alembic), frontend (projects, presets, api-client, i18n) |
| **改动类型** | feat / refactor |
| **优先级** | P1 |
| **状态** | in-progress |

## 实施阶段

- [x] Phase 0: 数据模型收敛与迁移 (2026-04-02)
- [x] Phase 1: 后端接口与服务清理 (2026-04-02)
- [x] Phase 2: 前端状态链路切换 (2026-04-02)
- [ ] Phase 3: 项目设置对话框重做
- [ ] Phase 4: 清理与验证

---

## 背景

### 问题陈述

当前项目与 preset 的关系被建模为“一个项目可绑定多个 preset，其中一
个是默认 preset”。这套设计已经带来了三类问题：

1. **产品语义过重**：用户当前真实需要的是“给项目设置一个默认
   preset”，而不是维护一个项目内的 preset 列表。
2. **前后端链路冗余**：后端单独维护 `project_presets` 表、仓储、服务和
   一组专用 API；前端也需要单独拉取 `projectPresets`、推导
   `defaultPresetId`、处理 add/remove/reorder/default 逻辑。
3. **UI 与心智不一致**：项目中的 **Manage presets** 对话框当前强调
   “添加多个并排序”，但用户实际只想从所有 preset 中选一个默认值。会话
   启动时也只消费默认 preset，并不会使用“绑定列表”本身。

### 目标

本次改动将项目 preset 语义直接收敛为：

- `Project` 只有一个可空的 `default_preset_id`
- 项目可以没有默认 preset
- 用户在所有 preset 中直接选择默认 preset
- 不再存在“项目绑定多个 preset”的概念
- 不保留旧的兼容 API、兼容表结构或兼容前端状态链路

### 关键洞察

- 现有代码中，“绑定多个 preset”只有项目设置对话框和对应后端接口在使用；
  项目页真正下发到运行入口的只有 `defaultPresetId`。
- 因为当前处于开发阶段，本次迁移不需要保留双写、兼容 DTO、旧 endpoint
  透传等过渡层；可以在一轮改动中完成 schema 替换和代码清理。
- 允许 `default_preset_id = null` 很重要。它既支持“项目还没选 preset”的
  初始状态，也支持用户显式清空默认 preset。

---

## Phase 0: 数据模型收敛与迁移

### 目标

将数据库和 ORM 模型从 `project_presets` 多对多表切换到
`projects.default_preset_id` 单字段模型，并在迁移中直接清除旧结构。

### 任务清单

#### 0.1 为 projects 增加可空 default_preset_id

**描述：** 使用 Alembic 自动生成迁移起点，然后手工调整 revision，使
`projects` 表新增可空外键 `default_preset_id -> presets.id`。

**涉及文件：**
- `backend/alembic/versions/<new_revision>.py` — 新增字段、外键和索引
- `backend/app/models/project.py` — 添加 `default_preset_id` 字段与
  `default_preset` 关系
- `backend/app/models/preset.py` — 添加被 `Project.default_preset`
  引用的关系定义

**验收标准：**
- [ ] `projects` 表存在可空 `default_preset_id`
- [ ] 外键指向 `presets.id`
- [ ] SQLAlchemy 模型可以直接访问 `project.default_preset`
- [ ] `Project.project_presets` 关系不再保留

#### 0.2 回填已有默认 preset 并删除 project_presets 表

**描述：** 在同一版迁移中，从 `project_presets.is_default = true` 回填
`projects.default_preset_id`，然后删除 `project_presets` 表及其索引。因
为是开发态迁移，不保留旧表。

**涉及文件：**
- `backend/alembic/versions/<new_revision>.py` — 写入数据迁移 SQL，回填后
  删除 `project_presets` 表和 `ix_project_preset_default`
- `backend/app/models/project_preset.py` — 删除
- `backend/app/models/__init__.py` — 移除 `ProjectPreset` 导出

**验收标准：**
- [ ] 已有默认 preset 被正确回填到 `projects.default_preset_id`
- [ ] 未设置默认 preset 的项目回填结果保持 `NULL`
- [ ] `project_presets` 表被删除
- [ ] 代码库中不存在 `ProjectPreset` ORM 模型

#### 0.3 清理依赖 project_presets 的仓储层

**描述：** 删除已无意义的 `ProjectPresetRepository`，并将“有项目仍在使用该
preset”这类校验改为基于 `Project.default_preset_id` 统计。

**涉及文件：**
- `backend/app/repositories/project_preset_repository.py` — 删除
- `backend/app/repositories/project_repository.py` — 增加默认 preset 的
  `selectinload` 和查询能力
- `backend/app/repositories/preset_repository.py` — 增加统计被项目默认引用的
  方法，或等价查询接口

**验收标准：**
- [ ] `ProjectPresetRepository` 已删除
- [ ] 删除 preset 时仍能阻止“被项目默认使用”的 preset 被误删
- [ ] 查询项目时能一并加载默认 preset，避免 N+1

---

## Phase 1: 后端接口与服务清理

### 目标

将后端 API 语义统一到 `Project.default_preset_id`，移除旧的
`/projects/{project_id}/presets` 专用接口和相关服务。

### 任务清单

#### 1.1 扩展 Project schema

**描述：** 在项目创建、更新、返回 schema 中加入
`default_preset_id: int | None`，并在服务层校验 preset 是否属于当前用户。

**涉及文件：**
- `backend/app/schemas/project.py` — 为 `ProjectCreateRequest`、
  `ProjectUpdateRequest`、`ProjectResponse` 添加 `default_preset_id`
- `backend/app/services/project_service.py` — 在 create/update/get/list 中读
  写该字段，并做 preset 所有权校验
- `backend/app/repositories/preset_repository.py` — 复用 `get_by_id()` 作为
  所有权校验入口

**验收标准：**
- [ ] `GET /projects` 和 `GET /projects/{id}` 返回 `default_preset_id`
- [ ] `POST /projects` 和 `PATCH /projects/{id}` 支持传入 `default_preset_id`
- [ ] `default_preset_id = null` 合法
- [ ] 非本人 preset 无法设为项目默认 preset

#### 1.2 删除 project preset 专用 API

**描述：** 删除旧的项目 preset 路由和服务，不再保留 add/remove/reorder
等能力。项目默认 preset 的更新统一走 `PATCH /projects/{id}`。

**涉及文件：**
- `backend/app/api/v1/project_presets.py` — 删除
- `backend/app/services/project_preset_service.py` — 删除
- `backend/app/api/v1/__init__` 或主路由注册文件 — 移除相关 router 注册
- `backend/app/schemas/preset.py` — 删除 `ProjectPresetAddRequest`、
  `PresetOrderUpdateRequest`、`ProjectPresetResponse`

**验收标准：**
- [ ] 后端不再暴露 `/projects/{project_id}/presets` 系列接口
- [ ] 代码库中不存在 `ProjectPresetService`
- [ ] 项目默认 preset 只通过项目接口维护

#### 1.3 更新删除 preset 的保护逻辑和测试

**描述：** 现有删除 preset 逻辑依赖 `ProjectPresetRepository` 统计使用数。
切换后应改成检查 `projects.default_preset_id` 是否引用该 preset，并同步更新
单元测试和 API 测试。

**涉及文件：**
- `backend/app/services/preset_service.py` — 调整删除保护逻辑
- `backend/tests/test_preset_services.py` — 去除对 `ProjectPresetRepository`
  的 mock 依赖，改测新查询路径
- `backend/tests/test_preset_api.py` — 增加项目默认 preset 的 API 回归测试
- `backend/tests/` 下与 `project_presets` 相关的旧测试文件 — 删除或重写

**验收标准：**
- [ ] 被某项目设为默认 preset 的 preset 无法删除
- [ ] 未被项目使用的 preset 仍可正常删除
- [ ] `project_presets` 相关测试或 mock 不再存在

---

## Phase 2: 前端状态链路切换

### 目标

前端项目页不再维护独立的 `projectPresets` 列表，而是直接使用
`ProjectItem.defaultPresetId` 作为唯一来源。

### 任务清单

#### 2.1 扩展 ProjectItem 与 projects API 映射

**描述：** 项目对象增加 `defaultPresetId`，从项目接口直接读取和写回。

**涉及文件：**
- `frontend/features/projects/types/index.ts` — 为 `ProjectItem` 添加
  `defaultPresetId?: number | null`
- `frontend/features/projects/api/projects-api.ts` — 映射
  `default_preset_id`
- `frontend/services/api-client.ts` — 删除
  `projectPresets/projectPreset/projectPresetDefault/projectPresetOrder`
  endpoint 常量

**验收标准：**
- [ ] `ProjectItem` 直接携带 `defaultPresetId`
- [ ] 前端不再需要从独立接口推导默认 preset
- [ ] `api-client` 中不存在旧 project preset endpoint 常量

#### 2.2 移除 projectPresets 前端服务与工具函数

**描述：** 删除仅服务旧绑定模型的前端模块，避免保留兼容状态层。

**涉及文件：**
- `frontend/features/projects/api/project-presets-api.ts` — 删除
- `frontend/features/projects/lib/project-presets.ts` — 删除
- `frontend/features/projects/lib/project-presets.test.ts` — 删除
- `frontend/features/capabilities/presets/lib/preset-types.ts` — 删除
  `ProjectPreset`、`ProjectPresetAddInput`、`PresetOrderUpdateInput`

**验收标准：**
- [ ] 前端代码库中不存在 `ProjectPreset` 类型
- [ ] 前端代码库中不存在 `projectPresetsService`
- [ ] 不再有默认 preset 的二次推导辅助函数

#### 2.3 更新项目页和运行入口的默认 preset 读取方式

**描述：** 项目页、信息抽屉和任务发起入口改为从
`currentProject.defaultPresetId` 读取默认 preset。

**涉及文件：**
- `frontend/features/projects/components/project-page-client.tsx` — 删除独立
  加载 `projectPresets` 的 effect，直接使用 `currentProject.defaultPresetId`
- `frontend/features/projects/components/project-info-drawer.tsx` — 将
  `presetCount` 改为是否设置默认 preset 的状态呈现，或使用 `0 / 1`
- `frontend/features/projects/components/project-stats.tsx`
  与 `frontend/features/projects/components/project-info-section.tsx` —
  同步调整 preset 数量语义

**验收标准：**
- [ ] 项目页初始加载不再额外请求 project preset 列表
- [ ] 发起任务时传递的 `initialPresetId` 直接来自项目对象
- [ ] 项目统计区不再暗示“项目持有多个 preset”

---

## Phase 3: 项目设置对话框重做

### 目标

将 **Manage presets** 对话框改为“在全部 preset 中单选默认值”的浏览器，
视觉上复用 preset 卡片样式，但交互与状态表达针对项目选择场景收敛。

### 任务清单

#### 3.1 提取可复用的 preset 卡片视觉骨架

**描述：** 将现有 `PresetCard` 中“图标 + 标题 + 描述 + 能力 badge”的视
觉骨架抽成可复用组件或可配置变体，避免在项目对话框里复制一份卡片 UI。

**涉及文件：**
- `frontend/features/capabilities/presets/components/preset-card.tsx` — 抽出
  可配置视觉层，或扩展为支持 `mode="manage" | "select-default"`
- `frontend/features/projects/components/project-settings-dialog.tsx` — 使用
  共享卡片视觉，而不是自行拼卡片

**验收标准：**
- [ ] 项目对话框中的卡片与 preset 页主卡片保持同一视觉语言
- [ ] 项目对话框卡片不显示设置菜单按钮
- [ ] 不出现复制粘贴的第二套卡片结构

#### 3.2 改为单选默认 preset 交互

**描述：** 用户不再“添加多个 preset”，而是在所有 preset 中直接点击卡片
选择默认 preset。再次点击当前选中项不取消；清空默认值通过单独入口完成。

**涉及文件：**
- `frontend/features/projects/components/project-settings-dialog.tsx` — 删除
  add/remove/reorder/default 按钮逻辑，改为卡片点击即保存默认 preset
- `frontend/features/projects/api/projects-api.ts` — 通过 `updateProject()`
  提交 `default_preset_id`
- `frontend/lib/i18n/locales/*/translation.json` — 更新项目 preset 相关文案

**验收标准：**
- [ ] 对话框中不再有“添加 preset”“移除”“上移”“下移”等按钮
- [ ] 点击任一卡片会把该 preset 设为项目默认 preset
- [ ] 保存动作调用项目更新接口，而不是旧 project preset 接口
- [ ] 项目支持清空默认 preset

#### 3.3 增加搜索和清空入口

**描述：** 顶部提供搜索框，按 preset `name + description` 过滤列表；同
时提供一个明确的“无默认 preset”入口，便于将项目恢复为空状态。

**涉及文件：**
- `frontend/features/projects/components/project-settings-dialog.tsx` — 新增
  搜索输入、过滤逻辑、空结果态、清空默认 preset 按钮或卡片
- `frontend/lib/i18n/locales/*/translation.json` — 新增搜索、空态、清空
  等文案

**验收标准：**
- [ ] 搜索同时匹配名称和描述
- [ ] 搜索结果为空时有明确空态提示
- [ ] 用户可显式将 `default_preset_id` 设为 `null`

#### 3.4 调整选中与未选中样式

**描述：** 项目选择态需要和通用编辑态区分。选中卡片保留 preset 自身的淡
色 icon 背景；未选中卡片的 icon 底座统一为灰色，以突出当前默认项。

**涉及文件：**
- `frontend/features/capabilities/presets/components/preset-card.tsx` 或新抽出
  的共享卡片文件 — 增加 `selected`、`selectionMode` 等样式开关
- `frontend/features/projects/components/project-settings-dialog.tsx` — 传入
  当前项目默认 preset 的选中态

**验收标准：**
- [ ] 选中卡片的 icon 背景延续 preset 自身淡色底座
- [ ] 未选中卡片的 icon 底座为灰色
- [ ] 选中态在 hover、focus、键盘导航下都清晰可辨

---

## Phase 4: 清理与验证

### 目标

清理所有旧绑定模型残留，并完成数据库、后端 API、前端交互三层验证。

### 任务清单

#### 4.1 删除旧代码与翻译残留

**描述：** 全量搜索并移除 `project preset` 旧语义，包括接口、类型、文案、
测试和无效 UI 拷贝。

**涉及文件：**
- `backend/` 与 `frontend/` 全局搜索结果 — 删除 `projectPresets`、
  `ProjectPreset`、`setDefaultProjectPreset`、`sortProjectPresets` 等残留
- `frontend/lib/i18n/locales/*/translation.json` — 移除不再使用的旧文案

**验收标准：**
- [ ] 全仓库不存在旧 project preset 类型和 service 名称
- [ ] i18n 中无废弃 key 残留
- [ ] 代码搜索不再出现 add/remove/reorder project preset 的实现

#### 4.2 验证迁移与核心流程

**描述：** 覆盖数据库迁移、项目设置、任务发起和 preset 删除保护几个关键路
径，确保本次重构没有遗漏。

**涉及文件：**
- `backend/tests/` — 补充项目 schema / project service / preset service 的
  迁移后测试
- `frontend/` 相关测试文件 — 为项目设置搜索、单选默认 preset、清空默认
  preset 添加必要覆盖

**验收标准：**
- [ ] Alembic `upgrade head` 后数据库结构正确
- [ ] 项目可以设置默认 preset，也可以清空默认 preset
- [ ] 新建任务时会继承项目默认 preset
- [ ] 已被项目设为默认值的 preset 无法删除
- [ ] `pnpm lint`、`pnpm test`、关键后端单测通过

---

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 迁移回填逻辑遗漏了“无默认 preset”的项目 | 中 | 在 migration 和 service 测试中分别覆盖 `NULL` 与已设置默认值两类样本 |
| 删除 `project_presets` 后仍有旧前端代码访问旧接口 | 高 | 在同一批改动中删除前端 service、type、API endpoint 常量，并通过全局搜索清理 |
| 项目统计区域仍显示旧的“多个 preset”心智 | 中 | 将 `presetCount` 语义改为 `0 / 1` 或直接改成“Default preset”状态展示 |
| preset 卡片复用过程中复制出第二套 UI | 中 | 先抽共享视觉骨架，再让项目对话框消费，禁止直接复制 `PresetCard` JSX |
| 删除 preset 的保护逻辑在迁移后失效 | 中 | 将校验集中到 `PresetService.delete_preset()`，补服务层和 API 层回归测试 |

---

## 总结

本方案把“项目 preset 管理”从多绑定模型收敛成一个更符合产品直觉的可空
默认值字段。改动的核心不是只换 UI，而是删除整套 `project_presets`
中间层，让数据库结构、后端 API、前端状态和用户心智保持一致。迁移完成
后，项目只需要回答一个问题：当前默认 preset 是谁，或者没有默认 preset。
