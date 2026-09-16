# Soha Web 仓库入口

- 本仓负责 React/Vite/Ant Design 控制台源码；公开协议以 `soha-contracts` 为源，API 调用遵循现有 api-client 和 feature 所有权边界。
- 在 OpenSoha 多仓工作区中读取 `../AGENTS.md` 一次；独立克隆时使用本仓规则，不要求初始化相邻仓库或规划工具。
- 前端实现或审查按需使用 [soha-frontend](.agents/skills/soha-frontend/SKILL.md)，优先复用现有组件、权限和状态处理。
- 按改动选择受影响组件测试、Lint、类型检查及必要浏览器检查；主入口为 `npm run lint`、`npm run typecheck`、`npm test`、`npm run build`。路由、共享边界、依赖或发布改动执行 [CI](.github/workflows/ci.yml) 与包脚本规定的适用完整门禁。
- 文档和技能改动只检查内容、链接与差异；相关代码和环境未变化时复用成功验证，保留用户未提交改动，不手改 `dist/` 等生成物。
