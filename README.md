# 🏮 MyPoems：个人数字化诗词书斋

**MyPoems** 是一款专为文学创作者与诗词爱好者打造的「数字化书斋」。它把诗词的**沉浸式阅读**与**深度文本分析**融为一体，数据以最朴素的 `.json` 文件保存，既可用于桌面端（Windows），也能装进安卓手机随身携带。

> **「笔落惊风雨，诗成泣鬼神。」** —— 在这里，每一行墨迹都有迹可循，每一个意象都被精准捕捉。

---

## ✨ 九页书斋

| 页 | 说明 |
|---|---|
| **作品总览** | 卡片式浏览 + 多维度筛选（年份 / 月份 / 类型 / 体裁 / 标签），右侧推送式阅读栏 |
| **添加新篇** | 稿纸样式编辑器，实时字数与段数、草稿自动留存、`Ctrl/Cmd+S` 保存 |
| **作品管理** | 搜索、排序、批量删除，改动直接落到 `.json` 文件 |
| **索引管理** | 标签批量重命名、合并、删除，多标签交集筛选 |
| **编年史** | 年表全景轴 + 逐年切片（同比、月度分布、沉默期、新启主题、首次体裁） |
| **精句集** | 今日一句、案头收藏、横向卡片轨道、按年份 / 标签 / 体裁分组的精句墙 |
| **意象簿** | 高频意象统计（单字 / 双字）、楷书田字格、年度频次与占比折线图 |
| **笔耕录** | 全期画像：累计字数曲线、篇长分布、月份偏好、创作节律、创作之最与排行 |
| **设置** | 主题、阅读器模式、界面偏好 |

---

## 🎨 主题与阅读体验

- **20 套预设主题**，另有「跟随系统」自动切换：
  - 日间：宣纸、月白、青瓷、竹影、雪松、天青、秋香、檀木、藕荷、胭脂
  - 夜间：墨夜、松烟、黛绿、苍青、藏蓝、夜雨、绛紫、绛雪、焦茶、玄墨
- **阅读器两种模式**：`push`（宽屏时挤压左侧内容）与 `modal`（浮层居中）；支持横排 / 竖排、对齐方式，左对齐时自动段首缩进。
- **自定义对话框**：全站不再使用浏览器原生 `confirm` / `prompt`，危险操作默认聚焦「取消」以防误按回车。
- **跨页联动**：编年史里的意象可直接跳进意象簿并选中该字，摘录句数可跳进精句集对应年份，笔耕录的体裁 / 词牌 / 标签可跳进作品总览并预置筛选。

---

## 🖥️ 双端架构

| 端 | 技术 | 说明 |
|---|---|---|
| 桌面端 | Electron 25 + Node.js/Express | 本地服务读写 `poems/` 目录 |
| 移动端 | Capacitor 8 + @capacitor/filesystem | 读写手机公开目录的 JSON 文件 |

两端**共用同一套前端**（`index.html` + `html/` + `js/` + `css/`）。数据层 `js/db-mock.js` 自动判断运行环境：手机端走原生文件插件，桌面端则继续由 `server.js` 提供 API，互不干扰。

---

## 🚀 快速开始

### 环境要求

- Node.js 16+（推荐 20+）
- 桌面端：无需额外环境
- 安卓端：JDK 17+ 与 Android SDK（可安装 [Android Studio](https://developer.android.com/studio)）

### 桌面端运行 / 打包

```bash
npm install          # 安装依赖
npm start            # 以 Electron 启动
npm run build        # 打包 Windows 桌面版（产物在 dist/）
```

> 也可直接运行 `start.bat`：启动本地服务并打开浏览器。

### 常用脚本

```bash
npm run seed         # 重新生成种子数据 js/seed-data.js
npm run web          # 组装前端资源到 www/（含 logo.ico）
npm run android:prepare   # 种子数据 + www + cap sync
```

### 安卓端打包

```bash
npm install
npm run android:prepare     # 重新生成种子数据 + 前端资源 + cap sync
cd android
./gradlew assembleDebug     # 产物在 android/app/build/outputs/apk/debug/app-debug.apk
```

> 完整说明（含安装、图标、存储权限）见 [ANDROID.md](ANDROID.md)。

---

## 📂 数据存储与同步

所有诗词都以**独立的 `.json` 文件**保存，天然支持同步与备份：

| 内容 | 桌面端 | 移动端 |
|---|---|---|
| 诗词 | `poems/`（项目根目录） | `内部存储 / Documents / MyPoems / poems/` |
| 案头收藏 | `favorites.json` | `Documents / MyPoems / favorites.json` |
| 屏蔽词 | `ignore_words.json` | `Documents / MyPoems / ignore_words.json` |

**多端同步**：用 [Syncthing](https://syncthing.net/) 等工具同步上述目录即可；也可 USB 手动拷贝。

> 注意：安卓 11+ 上，App 读取「外部拷入」的 JSON 文件需在系统设置里给「诗词集」开启「所有文件访问权限」，详见 [ANDROID.md](ANDROID.md) 第五节。

---

## 🗂️ 项目结构

```text
MyPoems/
├── index.html             # 应用唯一入口（含主题预应用脚本）
├── css/                   # 样式（variables/base/layout/components/pages）
├── html/                  # 九个功能页的 HTML 片段
├── js/                    # 前端逻辑（main.js 外壳与路由、db-mock.js 双模数据层、vendor/）
├── poems/                 # 你的私密诗词库（.json，已被 gitignore）
├── scripts/               # make-seed / build-www / normalize-poem-text
├── server.js              # 桌面端后端 API
├── electron-main.js       # 桌面端主进程
├── capacitor.config.json  # Capacitor 配置
├── android/               # 安卓原生工程
├── ANDROID.md             # 安卓打包 / 同步 / 权限说明
└── CHANGELOG.md           # 更新日志
```

---

## 🔒 隐私与备份

- **隐私保护**：`.gitignore` 默认忽略 `poems/*.json`、`ignore_words.json`、`favorites.json`、`js/seed-data.js`，确保私人创作不会被上传到公共仓库。
- **数据安全**：所有数据即 `.json` 文件本身，随时可拷贝备份；由于采用去数据库化设计，迁移、同步都只是「复制文件夹」。

---

## 📝 更新记录

各次改动详见 [CHANGELOG.md](CHANGELOG.md)。

---

## 📜 许可

[MIT](LICENSE) · 作者 [Loihan](https://github.com/Loihan)
