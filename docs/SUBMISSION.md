# [模组更新] 听歌档案 v1.3.2（网易云档案 / Folium 1.7）

### 模组 id / Mod id

listening-archive

### 版本 / Version (tag or commit)

v1.3.2

### 发布渠道 / Channel

保持不变 / Keep current

### 更新说明 / What changed

关联原提交 #61（已正式收录 v1.2.4）。本次沿用同一模组 ID、登记的源码仓库及目录，不另起网易云模组。

源码仓库：https://github.com/imicola/folia-listening-archive
模组目录：`dist/listening-archive`

**1. 使用 Folium 1.7 官方接口恢复网易云档案**

按 #61 及 chthollyphile/folia-major#788 的建议迁移：登录状态使用 `folium.account.getState('netease')`，监听 `account.changed`；平台数据通过实验性 `folium.experimental['platform.raw']` 读取。

新增网易云最近一周／所有时间听歌榜单，以及累计／本周／本月听歌报告。云端平台快照与 Folia 本机统计分别保存，不将云端次数混入本机记录，也不生成虚构的逐次播放轨迹。

只调用以下三个只读接口，均由用户主动点击同步触发：

| 接口 | 参数 | 用途 |
| --- | --- | --- |
| `user_record` | `type: 1` / `type: 0` | 最近一周／所有时间榜单，读取歌曲元数据与平台播放次数 |
| `listen_data_total` | 无 | 累计听歌报告 |
| `listen_data_realtime_report` | `type: 'week'` / `type: 'month'` | 本周／本月听歌报告 |

不传 `uid`、Cookie、Token、URL 或代理参数，会话与当前用户身份由宿主管理。不调用账号写入、登录或听歌记录上报接口。

**2. 权限变化与数据边界**

相对已收录的 v1.2.4，仅新增 `platform.netease.read`；`experimental` 仅新增 `platform.raw`。

- `platform.netease.read`：仅用于上述榜单和报告读取，不申请 `platform.netease.write` 或 `net.fetch`。
- `filesystem.data`：原用途不变，并在模组专属数据目录保存处理后的云端快照与报告字段映射。
- `stageLayers`：原用途不变，通过公开播放页接口取得封面。
- `playback.control`：原用途不变，用于用户主动播放／追加队列；通过公开 `playSong` / `enqueue` 操作，不清空原队列。

账号接口仅使用昵称和不透明的 `accountKey`，不读取宿主登录凭据、本机服务端口、IndexedDB 曲库或宿主打包模块，不模拟快捷键。无开发者遥测，不下载或执行远程代码。用户主动导出本机备份仍通过 `api.paths.documents` 写入「文档/Folia 听歌档案备份」。

换号／退出时取消旧请求并清除旧账号云端快照、报告与单位映射；核对响应的账号键，避免晚到响应串号。本机听歌记录不受清理影响。请求可取消、20 秒超时，模组处理的响应限制为 4 MiB；错误不回显原始平台文本。报告持久化前过滤凭据类字段和任意文本，仅保留必要的数字数据。

原始报告字段不属于稳定语义契约：所有周期的时长均需用户确认字段与单位，未确认或字段变化时显示未知，不用曲长乘播放次数估算。

**3. 兼容声明与升级**

需要 Folia v0.7.22 / Folium 1.7。按 #61 最新要求，`mod.json` 声明 `folia: ">=0.7.22"`，并保留 Folium major=1、minor>=7 的运行时检查。v1.3.2 在已发布 v1.3.1 的官方接口实现基础上，补齐稳定版兼容范围及说明；网易云实现和权限未变。

升级前可导出本机记录，完整替换模组程序目录并保留 `mods-data/listening-archive`；不要同时启用相同 ID 的副本。旧私有接口版本的云端缓存会重置，需重新同步并确认报告单位，本机记录保留。

**4. 验证范围**

本地类型检查、65 项自动测试、打包 main／worker 集成检查及分发目录检查通过；已使用 Folia v0.7.22 官方清单校验器核对兼容范围。运行逻辑与 v1.3.1 相同；此前深浅主题、窄窗、低性能模式和取消同步检查使用合成数据。

尚未在真实 Folia v0.7.22 中使用真实网易云账号完成在线验收，不将自动测试或合成预览当作在线功能已验证。本次申请沿用正式发布渠道，新增平台读取权限及功能仍需重新审查，不沿用 v1.2.4 的签名结论。

### 确认 / Confirmations

- [x] 新版本同样不收集或上传用户数据，也不下载并执行远程代码（除非这是它明确声明的功能） / The new version does not collect user data or run remote code unless that is its declared purpose
