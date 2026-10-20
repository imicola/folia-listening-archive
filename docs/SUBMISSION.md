# 模组提交资料（仅源码仓库）

- 模组：听歌档案 / listening-archive
- 作者：imicola
- 版本：v1.2.4
- 源码：https://github.com/imicola/folia-listening-archive
- 目录：dist/listening-archive
- 渠道：正式发布（申请，尚未签名）
- 许可证：MIT

本机播放排行、时长、声河、热力图、折线图、单曲轨迹与备份。网易云功能已从本版移除；播放仅通过公开 playSong / enqueue 解析当前歌曲与队列，不替换原队列，不读宿主数据库或登录凭据。

权限：filesystem.data 用于模组记录、设置与封面缓存；stageLayers 用于公开播放页封面；playback.control 用于用户触发的播放／追加。用户主动导出备份写入文档目录。无开发者遥测。

旧 v1.2.3 保留供先行测试方案讨论，同 ID 不能同时分发两渠道，独立 ID 须先征求维护者意见。
