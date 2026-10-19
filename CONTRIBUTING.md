# 贡献

使用 Node.js 22，在仓库根目录运行 `npm ci`。修改后运行：

```text
npm run typecheck
npm test
npm run build
npm run test:package
```

`npm run preview` 启动隔离的本机示例页；它不读取 Folia 的个人账号。Windows 上 `npm run package` 在仓库上级目录生成安装 ZIP 与 SHA-256 文件。

提交问题时请说明模组版本、Folia 版本、操作系统、复现步骤和预期行为。不要上传 Cookie、令牌、原始个人报告或整个 Folia 用户目录；截图请遮去账号资料。

网易云兼容层集中在 `src/client/netease-host.ts`；调整接口时同时检查缓存参数、账号切换、卸载和过期响应。新增测试使用合成数据。
