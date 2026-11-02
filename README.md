# Agentic Insights

中文 Agentic 研究阅读站：数据与环境、训练与 RL、Benchmark、知识蒸馏、模型更新，以及视频剪辑与代码创作专题。

网站：https://yiyingyang12.github.io/agentic-insights/

精选论文包含 TLDR、Motivation、Pipeline / Method、Novelty 与研究启发；每条保留原始来源、日期和证据边界。中文全文链接指向第三方翻译服务。来源核验不代表实验复现，自动收录资料会标记为待解读。

## 本地预览

```sh
python3 -m http.server 8769 --directory site
```

站点使用原生 HTML、CSS 和 JavaScript，无构建依赖。搜索、分类、专题、阅读进度筛选、详情和 JSON 导出均在浏览器中运行；收藏仅存当前浏览器。

## 发布与更新

GitHub Actions 将 `site/` 发布到 GitHub Pages。计划每 6 小时同步公开研究快照，实际数据时间显示在网站中。私有资料、账户凭据和个人通知记录不属于本站内容。

公开数据按字段和来源域名筛选后生成。上游采集失败时保留已有内容，并显示各来源状态。外部来源的文字只作为研究材料，不作为运行指令。
