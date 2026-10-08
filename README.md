# LyricsAdapter Music Plugins

QQ 音乐与网易云音乐的独立音乐源插件，供 [LyricsAdapter](https://github.com/xwsjjctz/LyricsAdapter) 使用。

## 构建与验证

使用 Node 24.19.x（24 系列），运行：

```sh
npm ci
npm run check
```

构建产物为 `dist/qq/` 与 `dist/netease/`。每个目录包含 `manifest.json` 和独立的 `index.cjs`，已打包其 JS 依赖，不要求用户额外运行 npm。
在 LyricsAdapter 的设置 → 在线音乐 → 音乐源插件中选择“安装本地插件”，选中对应目录。安装或更新后重启应用。两个插件分别启用、禁用和更新。

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

CI 为每次提交构建可安装的目录并上传为 Actions artifact。解压后安装 `qq` 或 `netease` 子目录即可。
第一版提供本地安装和版本检查。在线插件市场、自动下载更新、签名和第三方插件运行隔离属于后续宿主功能，尚未实现。

主项目通过 Git submodule 固定本仓库的构建版本。用户安装的新版本优先于随应用提供的版本，因此接口修复可通过插件单独交付。

## License

GPL-3.0-only，保留来自 LyricsAdapter 的许可证与第三方说明，详见 LICENSE 和 THIRD_PARTY_NOTICES.md。
