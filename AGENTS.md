# Soha Web 仓库入口

- 本仓负责 React/Vite/Ant Design 控制台源码；公开协议以 `soha-contracts` 为源，API 调用遵循现有 api-client 和 feature 所有权边界。
- 在 OpenSoha 多仓工作区中读取 `../AGENTS.md` 一次；独立克隆时使用本仓规则，不要求初始化相邻仓库或规划工具。
- 本仓保留 Antd，页面形态由 Soha 产品体验决定；统一设计语言与交互语义，不强制相同管理模板。
- 基础规则和主题校准不自动启动页面重设计或指定业务样板；产品工作区与紧凑管理页可共存，品牌和导航尺度不随单页切换。
- UI 实现或实质审查前读取 [soha-frontend](.agents/skills/soha-frontend/SKILL.md)、[产品体验规范](.agents/skills/soha-frontend/references/product-experience.md) 和 [主题规范](.agents/skills/soha-frontend/references/theme-system.md)，不只依赖技能自动匹配。维护任务保持局部；明确授权的产品重设计可调整布局、信息层级与组合。复用组件时保留行为，不默认复制旧页面骨架。
- 按改动选择受影响组件测试、Lint、类型检查及必要浏览器检查；主入口为 `npm run lint`、`npm run typecheck`、`npm test`、`npm run build`。路由、共享边界、依赖或发布改动执行 [CI](.github/workflows/ci.yml) 与包脚本规定的适用完整门禁。
- 视觉完成需要实际页面与交互状态验证，不能仅以类型检查或构建通过判断；不自行代签用户设计认可。
- 文档和技能改动只检查内容、链接与差异；相关代码和环境未变化时复用成功验证，保留用户未提交改动，不手改 `dist/` 等生成物。

## 新页面与共享能力

- 修改前明确任务场景、数据/交互所有者、适用参考及需保持的行为。旧页面只能证明现状，不能自动充当合格样板；规则冲突需说明依据。新会话或关键上下文丢失时只补读必要规则。
- 页面布局、查询行为和表格行为分离。普通业务表格复用 AdminTable；不强制 ManagementDataPage，不新建万能外壳或平行 Table API。
- 保留真实分页/排序/筛选、稳定 rowKey、选择范围、权限、确认和失败反馈。局部视觉任务不顺手改变 API/DTO、路由、全局主题或共享组件默认行为。
- 共享组件或查询能力变更需要验证实际消费者。新增/重构页面不按纯样式小改验收；覆盖相关数据状态、操作与必要的主题/视口检查。
- [表格边界检查](.github/workflows/table-boundaries.yml) 阻止相对已审查 Git 基线新增的原生 Table、隐藏来源的 Antd runtime 导入及重新导出。类型导入不受限；历史债务保留报告，不重新写基线掩盖新增违规。执行方法见前端 Skill。
- 报告实际提交、适用检查及 pass/fail/skip/not-run；明确工程、行为和视觉证据的不同范围。未验证的浏览器或集成行为不能记为通过。
