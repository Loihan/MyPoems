# 🏮 MyPoems - 个人诗词书斋

MyPoems 是一个基于 Node.js 开发的本地诗词管理与分析系统。它旨在为文学创作者提供一个静谧、优雅的数字化空间，用于记录、管理、赏析以及深度分析个人诗词作品。

![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)
![Node Version](https://img.shields.io/badge/node-%3E%3D%2014.0.0-green.svg)

## ✨ 项目亮点

- **🎨 唯美交互**：采用衬线字体排版，支持**深色模式**，营造沉浸式文学氛围。
- **🏛️ 三栏布局**：持久化的右侧阅读面板，支持在浏览、统计、管理时无缝查阅作品详情。
- **📊 笔耕录 (统计)**：动态生成**创作热力图**、最长沉默期、最密集创作月等洞察数据。
- **⏳ 编年史**：以中轴线时间轴呈现创作轨迹，支持年份快捷跳转。
- **🖼️ 意象簿**：深度文本挖掘，自动提取高频词汇，并生成**田字格书法预览**及年度频率/占比折线图。
- **🔖 索引管理**：强大的标签清洗功能，支持标签合并、批量重命名、批量添加及“无标签”筛选。
- **💡 随机精句**：侧边栏自动展示随机摘录的古雅诗句。

## 🛠️ 技术栈

- **后端**: Node.js, Express
- **前端**: 原生 JavaScript (ES6+), CSS3 (Flexbox/Sticky/Grid), Chart.js
- **存储**: 本地 JSON 文件系统（无需数据库，迁移极简）

## 📂 项目结构

```text
MyPoems/
├── css/             # 样式表 (变量、基础、布局、组件、页面)
├── html/            # 页面结构片段
├── js/              # 前端逻辑脚本 (路由、分析、图表)
├── poems/           # 诗词数据存放处 (*.json)
├── index.html       # 应用入口
├── server.js        # 后端 Express 服务
└── package.json     # 配置与依赖

## 🚀 快速上手

1. 环境准备
确保你的电脑安装了 Node.js。

2. 下载并安装
code
Bash
# 克隆仓库
git clone https://github.com/Loihan/MyPoems.git

# 进入目录
cd MyPoems

# 安装依赖
npm install

3. 启动应用
code
Bash
npm start
启动后，在浏览器访问 http://localhost:3000 即可开始创作。
📝 备份说明
本项目数据以 JSON 格式存储在 poems/ 文件夹下。
注意： 上传至 GitHub 时已通过 .gitignore 忽略了具体作品文件。建议您定期手动备份 poems/ 文件夹。
📜 开源协议
本项目采用 MIT License 协议。