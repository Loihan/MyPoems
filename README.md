# 🏮 MyPoems：个人数字化诗词书斋

**MyPoems** 是一款专为文学创作者与诗词爱好者打造的「数字化书斋」。它把诗词的**沉浸式阅读**与**深度文本分析**融为一体，数据以最朴素的 `.json` 文件保存，既可用于桌面端（Windows），也能装进安卓手机随身携带。

> **「笔落惊风雨，诗成泣鬼神。」** —— 在这里，每一行墨迹都有迹可循，每一个意象都被精准捕捉。

---

## ✨ 核心特性

- **作品总览**：卡片式浏览 + 多维度筛选（年份 / 月份 / 类型 / 体裁 / 标签）。
- **添加 / 管理**：所见即所得的诗词编辑器，支持标签云、精句摘录、序言与注释。
- **索引管理**：标签批量重命名、合并、删除，多标签交集筛选。
- **编年史**：中轴时间线，按创作年份串联，支持年份快捷导航。
- **精句集**：瀑布流展示摘录，一键复制。
- **意象簿**：高频意象统计（单字 / 双字）、楷书田字格、意象年度频次与占比折线图。
- **笔耕录**：创作热力图、沉默期分析、时节偏好等创作洞察。
- **深浅色模式**：日间素笺、夜间墨色，自动适配系统。

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

| 端 | 存储位置 |
|---|---|
| 桌面端 | `poems/`（项目根目录） |
| 移动端 | `内部存储 / Documents / MyPoems / poems/`（公开目录，卸载不丢） |

**多端同步**：用 [Syncthing](https://syncthing.net/) 等工具同步上述两个 `poems/` 目录即可；也可 USB 手动拷贝。

> 注意：安卓 11+ 上，App 读取「外部拷入」的 JSON 文件需在系统设置里给「诗词集」开启「所有文件访问权限」，详见 [ANDROID.md](ANDROID.md) 第五节。

---

## 🗂️ 项目结构

```text
MyPoems/
├── index.html             # 应用唯一入口
├── css/                   # 样式（variables/base/layout/components/pages）
├── html/                  # 各功能页的 HTML 片段
├── js/                    # 前端逻辑（含 db-mock.js 双模数据层、vendor/）
├── poems/                 # 你的私密诗词库（.json，已被 gitignore）
├── scripts/               # 构建脚本（make-seed / build-www）
├── server.js              # 桌面端后端 API
├── electron-main.js       # 桌面端主进程
├── capacitor.config.json  # Capacitor 配置
├── android/               # 安卓原生工程
├── ANDROID.md             # 安卓打包 / 同步 / 权限说明
└── CHANGELOG.md           # 更新日志
```

---

## 🔒 隐私与备份

- **隐私保护**：`.gitignore` 默认忽略 `poems/*.json`、`ignore_words.json`、`js/seed-data.js`，确保私人创作不会被上传到公共仓库。
- **数据安全**：所有数据即 `.json` 文件本身，随时可拷贝备份；由于采用去数据库化设计，迁移、同步都只是「复制文件夹」。

---

## 📜 许可

[MIT](LICENSE) · 作者 [Loihan](https://github.com/Loihan)
