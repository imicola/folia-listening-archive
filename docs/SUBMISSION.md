# 模组更新资料草稿（尚未提交）

- 听歌档案 / listening-archive，imicola，MIT
- 版本 v1.3.0，目录 dist/listening-archive
- 源码 https://github.com/imicola/folia-listening-archive
- 本次先发布仓库预发布 Release；folium-compound #61 及市场更新 issue 保持原状。待官方稳定版包含 Folium 1.7，并完成新版本验证后，再准备正式市场更新。

权限：filesystem.data 保存模组档案、设置、封面及云端快照；stageLayers 读取公开播放页封面；playback.control 用于用户主动播放/追加；platform.netease.read 用于主动同步网易云数据。experimental 仅 platform.raw。

调用范围：user_record（type 1/0 周/总榜），listen_data_total（累计报告），listen_data_realtime_report（type week/month 周/月报告）。不传 uid、URL、代理或凭据，不调用写接口。凭据和用户 ID 由宿主管理。账号接口只用昵称与不透明 accountKey，换号取消请求并清理旧快照。20 秒超时、4 MiB 响应上限，错误不回显原始平台文本。所有报告单位需用户确认，不推算时长。

预发布不是市场签名；不自动更新 issue、评论或请求签名。发布 issue 前按用户约定展示最终文案并取得放行。
