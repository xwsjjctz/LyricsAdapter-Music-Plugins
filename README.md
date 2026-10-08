# LyricsAdapter Music Plugins

QQ 音乐与网易云音乐的独立音乐源插件，供 [LyricsAdapter](https://github.com/xwsjjctz/LyricsAdapter) 使用。

## 构建与验证

使用 Node 24.19.x（24 系列），运行：

```sh
npm ci
npm run check
```

构建产物为 `dist/qq/` 与 `dist/netease/`。每个目录包含 `manifest.json` 和独立的 `index.cjs`，已打包其 JS 依赖，不要求用户额外运行 npm。
`npm run package` 会进一步生成 `packages/qq.laplugin`、`packages/netease.laplugin` 和在线目录 `packages/catalog.json`；`npm run check` 也会生成这些文件。
在支持独立插件页的 LyricsAdapter 版本中，进入设置 → 插件，点击“下载安装”即可从本仓库安装；也可选择“安装本地插件”导入 `.laplugin` 文件。首次安装立即生效，更新已有插件后重启应用。两个插件分别启用、禁用和更新。安装文件保存在应用数据目录的 `plugin/<id>/`，默认是 `~/.la/plugin/`，页面会显示实际路径。

## 边界

插件在宿主的 Node 运行环境中执行，通过 `createPlugin(host)` 接收日志和仅属于该插件的凭据存储能力。插件本身不导入 Electron、React 或 LyricsAdapter 内部代码。

- QQ：搜索、推荐、歌单分页、vkey 与音质回退、扫码登录、musickey 续期、LRC/QRC 获取与解密。
- 网易云：歌曲与封面补全、歌单分页、weapi 加密、扫码登录、登录续期、音频 URL 与实际音质、LRC/YRC。
- 宿主：界面、播放器、队列、音乐库、歌词解析和有界缓存、音频传输、文件保存、元数据写入、safeStorage 加密及兼容性检查。

API 版本为 1，当前歌曲字段保留 `songmid` 等旧结构，音乐源标识保留 `qq` 与 `netease`。`src/sdk.ts` 定义插件合同；宿主拒绝不兼容的 `apiVersion`。
`manifest.json` 描述 ID、名称、版本、入口、是否需登录和能力。`createPlugin` 返回统一 provider、登录兼容调用、Cookie 校验及流媒体请求头。
凭据协议由插件处理；持久化由宿主负责。插件更新不会迁移或删除宿主的歌曲和凭据。

这是可维护的官方插件机制。插件以 Node 权限运行，应仅安装可信来源的代码；合同中的凭据隔离并不等于运行时沙箱。

## 分发与插件目录

`packages/` 中的安装包和目录随源码一同提交到 `main`，宿主从 GitHub 原始文件地址读取，无需先创建 Release，也无需用户克隆源码或构建插件。目录记录插件版本和安装包 SHA-256，安装包内部同时记录代码 SHA-256；宿主验证摘要、ID、版本与 API 兼容性后才安装。GitHub Releases 安装包仍可作为兼容分发方式。

修改协议实现或版本后运行 `npm run check`，一同提交源码、安装包和目录。CI 重新生成并比较已提交的分发文件，防止源码与下载包不一致，也会上传安装包为 Actions artifact。插件页可手动刷新目录和下载安装更新；自动更新、第三方市场与运行隔离尚未实现。

主应用可无插件启动，插件源码项目独立开发，不是主应用的构建依赖。宿主保留的可选测试构建不会将插件打进应用资源。

## License

GPL-3.0-only，保留来自 LyricsAdapter 的许可证与第三方说明，详见 LICENSE 和 THIRD_PARTY_NOTICES.md。
