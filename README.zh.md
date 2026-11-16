# dsh-bundle-template

[English](README.md) | 中文

面向 [DeepSeek Harness](https://github.com/deepseek-ai) 的 pnpm monorepo bundle 模板：**一个元包 + N 个真实 plugin 包**。每个 plugin 是独立安装、独立启停、独立带 Client 半边与行级元数据的包；元包只负责组合与默认配置。

## 为什么是 monorepo

DSH 里同一行会被三套子系统用三种键识别：

- **Loader**：`name` 什么都认——包名、子路径、相对路径、`file:` URL；
- **client-modules**：只认「包」——从行模块向上找最近的 `package.json`，一个包只能有一个活跃 Client 来源；
- **Plugin Manager 元数据**：只认「裸包规格符」——相对路径行没有行级标题/图标。

所以「每组件独立行 + 独立 Client + 独立元数据」三件事要同时成立，plugin 就必须是 Node 能解析到的真实包。元包只插入行、给默认 config，不把 plugin 合并成一个运行时对象。

完整推导和四种形状的取舍见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

## 目录

```
packages/
  bundle/               # 元包：cordis.patch.yml + bundle 级 locale/icon/docs
  echo/                 # plugin：Host 工具 template_echo
  badge/                # plugin：Host 空壳 + Client 徽标
build/config.ts         # 共享 tsdown 配置：Host ESM / Client loader 外壳
scripts/build.ts        # 枚举 packages/*，逐包构建
scripts/check-pack.ts   # 逐包 npm pack，检查 files 清单
templates/github-actions/ci.yml  # 可选 CI，不默认启用
docs/ARCHITECTURE.md    # 三套身份键与形状取舍
```

## 快速开始

```sh
pnpm install
pnpm check
```

`pnpm check` = `typecheck` + `build` + `pack:check`。契约检查暂未内置；需要时可以按包加。

`pnpm install` 会在 monorepo 根跑 `prepare`，所以装完即有各包的 `lib/` 产物。

## 两个示例

| 包 | 作用 | Host 半边 | Client 半边 |
|---|---|---|---|
| `@dsh-bundle-template/echo` | `template_echo` 工具，受 row config 控制 | ✅ | — |
| `@dsh-bundle-template/badge` | 输入框下方的徽标 | 空壳（只为激活 Client） | ✅ |
| `@dsh-bundle-template/bundle` | 组合层：patch、locale、icon、docs | — | — |

`echo` 演示纯 Host 插件；`badge` 演示「Host 空壳 + Client 半边」。两者都带自己的 `locale/` 和 `icon.svg`，所以 Plugin Manager 里每行有自己的标题、描述和图标。

## 加一个 plugin

1. 复制 `packages/echo` 或 `packages/badge` 为 `packages/<name>`。
2. 改 `package.json` 的 `name`、`src/`、`locale/`、`icon.svg`。
3. 在 `packages/bundle/package.json` 的 `dependencies` 加 `"@your-scope/<name>": "workspace:*"`。
4. 在 `packages/bundle/cordis.patch.yml` 加一行；只有插件导出 `Config` 时才写 `config`。
5. 从根跑 `pnpm install`（建立 workspace 链接）和 `pnpm check`。

N=1 和 N=10 走同一条路径；元包不需要为新插件改代码。

## `@deepseek-ai/*` 的引用规则

每个 plugin 包：

- 把它 import 的 `@deepseek-ai/*` 同时写进 `peerDependencies` 和 `devDependencies`；
- 构建时保持 external（`build/config.ts` 里的 `neverBundle`）；
- Client 半边只能 `import type`，不能运行时 import。

为什么是三条一起：

- `devDependencies` 让本地构建、类型检查、测试能解析；
- `peerDependencies` 让 profile resolver 把 linked importer 的裸请求路由到 installation 副本——`dsh-app-boot` 的 resolver 会读祖先 `package.json` 的 peers，命中后走 installation scope；
- external 保证运行时真的还有裸请求可路由。若把 `@deepseek-ai/*` 打进 `lib/index.js`，就生成第二份 Cordis/Schemastery 实例，peer 声明也救不了。

Client 半边不走这套：浏览器的模块表只有 `react` 等基座模块，`@deepseek-ai/*` 的运行时 import 会让整个 bundle 加载失败。

## 本地开发

```sh
# 1. 建一个 web 型 dev profile（普通 plugin add 出来的是 base 型，没有界面）
dsh --profile dev --from-default-profile web --dump-config > /dev/null

# 2. 先在 monorepo 根装依赖，让 packages/bundle/node_modules 有兄弟包链接
pnpm install

# 3. link 元包（不要用 file:，见下）
dsh plugin --profile dev add ./packages/bundle

# 4. 确认配置层合成
dsh --profile dev --dump-config   # 应看到 echo / badge 两行

# 5. 启动
dsh --profile dev --port 0
```

**`file:` 不行。** `workspace:*` 只在 workspace 内解析；用 `file:` 把元包装进消费者时，pnpm 会报：

```
ERR_PNPM_WORKSPACE_PKG_NOT_FOUND
"@task/a@workspace:*" is in the dependencies but no package named "@task/a" is present in the workspace
```

用 `link:` / `dsh plugin add`。发布形态下 `pnpm pack` 会把 `workspace:*` 重写成版本号，那时才用 `file:` 或 registry 安装 tarball。

### 本地 link 的边界

link 安装验的是「组合」：行挂上了、Client 加载了、config 生效了。

它不保证「`@deepseek-ai/*` 用的是宿主实例」：只 link 元包时，plugin 包的真实路径在元包目录之外，profile resolver 的 linked-root 判定可能不覆盖它们；这些模块的静态 import 会走 Node 原生解析，落到 workspace 的 devDependencies 副本。

要验实例共享，两条路：

1. 把每个 plugin 包也做成 dev profile 的顶层 `link:`，让它们各自成为 linked root；
2. 走 release-like：`pnpm pack` 所有包，装进一次性 profile（有本地 registry 更稳）。

不要因为「link 后功能正常」就断定实例共享也成立。

## 构建

| 半边 | 格式 | 消费方 | 产物 |
|---|---|---|---|
| Host | ESM，`platform: node` | Node 当普通模块 import | `packages/<name>/lib/index.js`、`index.d.ts` |
| Client | 包在 `window.__ModuleLoader__.load(...)` 里的 CJS | 页面当脚本抓取并执行 | `packages/<name>/lib/client.js` |

- 每个包写自己的 `lib/`，`clean` 在 `scripts/build.ts` 里按包执行。
- `build/config.ts` 是共享配置；`scripts/build.ts` 枚举 `packages/*`，跳过纯元包，按 `src/index.ts` / `dsh.client` 决定构建哪半边。
- Host 构建把 `@deepseek-ai/*` 保持 external；Client 构建把 `react` / `react/jsx-runtime` 保持 external。
- Client 的 loader id 由构建脚本按包名注入；改包名后不需要手改 banner。

## 打包与发布

```sh
# 每个包各打一个 tarball
pnpm --filter @dsh-bundle-template/echo pack
pnpm --filter @dsh-bundle-template/badge pack
pnpm --filter @dsh-bundle-template/bundle pack
```

`pnpm pack` 会把元包依赖里的 `workspace:*` 重写成实际版本。消费者装到元包后，pnpm 会按这些版本去装 plugin 包；因此发布时**每个 plugin 包都要发**，不能只发元包。

- 发布顺序：先 plugin 包，后元包。
- 单 tarball 的需求可以用 `bundledDependencies`，但 DSH 的安装路径是否保留 bundled deps 需要实验验证；模板暂不默认这样做。
- 没有发布 workflow；发布是手动步骤。

## CI 可选

模板默认不带 `.github/workflows/`。要启用：

```sh
mkdir -p .github/workflows
cp templates/github-actions/ci.yml .github/workflows/ci.yml
```

工作流跑 `pnpm typecheck`、`pnpm build`、`pnpm pack:check`，安装时用 `--ignore-scripts`，构建失败不会被误报成安装失败。

## 改名为你自己的 scope

当前 `@dsh-bundle-template` 是占位 scope。要改的地方：

1. `packages/*/package.json` 的 `name`；
2. `packages/bundle/package.json` 的 `dependencies` 键；
3. `packages/bundle/cordis.patch.yml` 每行的 `name`；
4. 各包源码里的 `name` 常量与注释；
5. `locale/*.json`、`README.md`、`docs/` 里的标题和包名。

改完跑 `pnpm install && pnpm check`；loader id 由构建脚本从 `package.json` 读，不需要手改。

## 已经踩过的坑

- **元包不要声明 `dsh.client`。** 它有多行；一个包只能有一个活跃 Client 来源，多行加 `dsh.client` 会让整个 bundle 起不来。
- **一个带 UI 的组件一个包。** 不要把多个面板塞进同一个包的 `dsh.client`；它们的 UI 生命周期会绑在一起，没法按行独立启停。
- **plugin 包的 `exports` 必须包含 `./locale/*.json`、`./icon`、`./package.json`。** `readPluginMeta` 正是通过这三个导出读行级标题/图标；只写 `.` 和 `./client`，元数据读不到。
- **路径式行有 Client 但没行级元数据；子路径行有元数据但没 Client。** 裸包根是三件事同时成立的交集。
- **Client 半边不能运行时 import `@deepseek-ai/*`。** 页面模块表不认；`import type` 会被擦除，安全。
- **link 不等于生产安装。** 实例共享要按「本地 link 的边界」验。
- **`workspace:*` 不要手改成 `file:`。** 发布时 `pnpm pack` 只重写 `workspace:`；手写 `file:` 会把本地路径带进 tarball。

## 许可

MIT
