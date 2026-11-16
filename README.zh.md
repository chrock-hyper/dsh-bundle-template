# dsh-bundle-template

[English](README.md) | 中文

面向 [DeepSeek Harness](https://github.com/deepseek-ai) **bundle** 的 TypeScript + [tsdown](https://tsdown.dev) 模板。它同时交付一个可运行的 **Host 半边**和一个可运行的 **Client 半边**，两者都构建成 DSH 实际加载的产物形状，并附带一套契约检查——坏掉的 bundle 在进 profile 之前就会失败。

## 为什么需要它

DSH 自己的 client 产物由 `packages/client/tsdown.client.ts` 这个 tsdown 预设生成，而该预设**不在任何已发布的包中**；官方文档写得很直接：仓库之外的包必须自己复刻这一步构建。Client 半边必须是一段调用 `window.__ModuleLoader__.load({ id, factory })` 的脚本，Host 半边则是普通 ESM。让这两者从同一个 TypeScript 工程里产出来、并让 `package.json` exports 对得上，就是本模板要解决的问题。

## 环境要求

- Node.js ≥ 24.9
- pnpm（npm 亦可）
- DSH `>=0.2.0 <0.3.0`（写在 `engines.dsh` 里）

## 快速开始

```sh
pnpm install
pnpm check      # 类型检查 → 构建 → 契约检查 → 打包清单检查
```

## 目录

```
src/index.ts          Host 半边：apply(ctx, config)，具名导出 name / inject / Config
src/client.tsx        Client 半边：具名导出 inject / apply，返回插件对象
src/contract.ts       浏览器侧契约的本地类型（不产生任何运行时 import）
build/tsdown.host.ts  ESM 构建 → lib/index.js + lib/index.d.ts
build/tsdown.client.ts CJS 构建 + loader 外壳 → lib/client.js
cordis.patch.yml      bundle 配置层：插入一行带默认 config 的插件记录
locale/{en,zh}.json   Plugin Manager 与 Settings 读取的展示元数据
docs/DETAIL.md        插件页上展示的详情文档
scripts/check-*.ts    契约与打包两道闸门
```

## 构建契约

两次构建、两个消费方、两种格式。两者写进同一个 `lib/`，所以两个配置都不开 `clean`；由 `pnpm build` 在开头统一清一次。

| 半边 | 格式 | 消费方 | 产物 |
|---|---|---|---|
| Host | ESM，`platform: node` | Node 当普通模块 import | `lib/index.js`、`lib/index.d.ts` |
| Client | 包在 `window.__ModuleLoader__.load(...)` 里的 CJS | 页面当脚本抓取并执行 | `lib/client.js` |

`package.json` 两者都导出，加载器不需要任何特殊路径：

```json
{
  ".":        { "types": "./lib/index.d.ts", "default": "./lib/index.js" },
  "./client": { "types": "./lib/client.d.ts", "default": "./lib/client.js" }
}
```

### 构建强制执行的规则

- **Client 半边必须用具名导出。** 外壳把 `module.exports` 交回加载器；默认导出会变成 `{ default: ... }`，等于什么都没注册。
- **运行时 `require` 只能命中基座模块。** 页面只种了一张很短的模块表——实际就是 `react` 和 `react/jsx-runtime`。Client 半边里绝不能 import `@deepseek-ai/*`：`import type` 会被擦除、安全，运行时 import 不安全。契约检查会把它抓出来。
- **不要有顶层副作用。** 运行 client 产物只应注册一个 factory，其余一律等模块物化时再跑。
- **只有一个包名。** 注册的 `id`、`dsh.client` 声明、`package.json` 的 `name` 三者必须一致。

## 本地开发

```sh
# 1. 先建一个 web 型 profile。单跑 `dsh plugin add` 出来的是 base 型 profile，
#    它没有界面，Client 半边无处落地——所以要从 web 模板起步。
dsh --profile dev --from-default-profile web --dump-config > /dev/null

# 2. 把本 checkout link 进去。
dsh plugin --profile dev add .

# 3. 不启动也能确认配置层合成成功。
dsh --profile dev --dump-config   # 会看到 "# == dsh-bundle-template"

# 4. 启动，打开 CLI 打印的带 token 的 URL。
dsh --profile dev --port 0
```

改完源码重新 `pnpm build` 即可；link 安装是就地读取的。DSH 会从运行中的安装解析 `@deepseek-ai/*` 这些 peer，因此 Host 半边与宿主共用同一个 Cordis 实例，而不是各持一份——pnpm 会提示这个 link 包的 peer 未解析，属预期行为。

`pnpm install` 会顺带跑 `prepare`，所以装完即有构建产物（约 1.7 秒，不做类型检查——类型检查归 CI）。

## 装到别处

```sh
dsh plugin --profile demo add ./                       # 本地目录（link checkout）
dsh plugin --profile demo add ./pkg-0.1.0.tgz          # 打包好的 tarball
dsh plugin --profile demo add github:owner/repo#<sha>   # 直接从 git 装
```

从 git 安装拿到的**是源码不是产物**：它跑的是本包的 `prepare` 脚本，所以 pnpm ≥ 10 第一次会要求你放行这个构建。把 pnpm 打印出来的包 key 抄进 profile 的 `pnpm-workspace.yaml`：

```yaml
allowBuilds:
  dsh-bundle-template: true
```

这条放行等于允许该包在你的机器上于安装期执行代码，所以从 git 装时请钉住 commit。

## 改名为你自己的包

以下要一起改；注册 id 一旦和 `package.json` 漂移，契约检查就会失败：

1. `package.json` → `name`、`description`
2. `build/tsdown.client.ts` 从 manifest 读包名，无需改动
3. `cordis.patch.yml` → 记录的 `id` 与 `name`
4. `locale/{en,zh}.json` → `meta.title`、`meta.description`
5. `docs/DETAIL.md`、`README.md`、`README.zh.md`

## 本模板已经替你踩过的坑

- **`--config build/x.ts` 会让 tsdown 把 `build/` 当成工作目录。** 两份配置都把 `cwd` 钉在工程根；否则 `src/index.ts` 根本解析不到。
- **在 `"type": "module"` 包里，CJS 默认输出 `.cjs`。** client 配置用 `outExtensions` 强制成 `.js`：页面按名字抓 `client.js`，从不用 Node import 它，那个"安全扩展名"只会让预期路径失效。
- **Host 构建绝不能把 `@deepseek-ai/*` 打进去。** 宿主侧多出一份 Cordis 或 Schemastery 会破坏实例共享。它们保持 external，并在 `peerDependencies` 与 `devDependencies` 里各声明一次。
- **link 安装会掩盖 `files` 漏项。** `pnpm pack:check` 真打一个 tarball，断言该有的文件都在、`src/` 没漏进去。

## 许可

MIT
