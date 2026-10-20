# 模组提交资料

- 名称：听歌档案
- 模组 ID：`listening-archive`
- 作者：imicola
- 版本：1.2.2
- 许可证：MIT
- 兼容声明：Folia `>=0.7.21 <0.8.0`；实际验证 Windows / Folia 0.7.21 / Folium 1.6
- 源码：https://github.com/imicola/folia-listening-archive
- 安装包：https://github.com/imicola/folia-listening-archive/releases/tag/v1.2.2

## 简介

在 Folia 中查看自己的听歌档案：本机播放排行、累计时长、声河、热力图、单曲轨迹与备份；也可切换网易云档案，复用现有登录同步榜单与时长报告。排行支持无限拖动画布与单曲聚焦，播放时用当前榜单替换队列并进入 Folia 原生拼贴。

## 安装

下载 Release 的 `listening-archive-v1.2.2.zip`，在 Folia 模组设置中安装并启用。手动安装时，将 ZIP 中的 `listening-archive` 文件夹完整解压到模组目录并重载。无需另装 Node.js 或单独部署网易云服务。

## 权限用途

- `filesystem.data`：模组专属目录中的记录、快照、设置与封面缓存。
- `stageLayers`：通过公开播放页接口取得本机歌曲封面。
- `playback.control`：用户点击后的本机播放与加入队列。

网易云功能通过 Folia 内置的本机服务请求平台数据，凭据不经模组 RPC 或写入模组文件，无开发者遥测。封面可能从原音乐来源加载。具体数据位置与备份范围见 README。

## 审核说明

网易云部分依赖 Folia 0.7.21 内部端口桥接与已有会话键，非 Folium 正式登录 API。累计报告单位需首次显式确认。平台榜单最多使用本次返回的 100 首，歌手和专辑贡献不是全量平台统计。本机记录从启用后开始积累，不回填历史。

整队替换另依赖 Folia 0.7.21 已验证构建的模块指纹，未知构建会在修改队列前拒绝操作；本地历史歌曲通过只读查询宿主 IndexedDB 曲库进行唯一匹配，仍需要宿主原有文件权限。其他 Folia 构建尚未验证。

本文件仅整理提交信息，不表示已提交或通过官方模组审核；请在提交时按目标平台表单填写。
