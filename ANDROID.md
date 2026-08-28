# 安卓 App 打包与多端同步指南

本项目已具备打包成安卓 APK 的全部代码与工程配置。以下是构建、同步与常见问题说明。

---

## 一、这是什么、数据存在哪

手机端 App 的数据（诗词）仍然是**每首诗一个 `.json` 文件**，存放在手机**公开可见**的目录：

```
内部存储 / Documents / MyPoems /
├── poems/
│   ├── 定风波·槐时别.json
│   ├── 八月廿五记梦.json
│   └── ...（共 129 首）
└── ignore_words.json      （屏蔽词配置）
```

- 该目录**卸载 App 也不会被删除**（公开目录不受卸载影响）。
- 首次启动时，App 会把打包内置的 129 首诗「只写入不存在的文件、绝不覆盖」，因此重装/升级/同步回来都不会丢数据。
- 电脑端（Electron）功能**完全不变**：`js/db-mock.js` 在电脑上自动失效，继续走原来的 `server.js` + `poems/` 目录。

---

## 二、构建 APK（需要 Android Studio / SDK）

> 本机已装 **Node 24 与 JDK 21**，但**尚未安装 Android SDK**。任选下面一种方式安装 SDK 并构建。

### 方式 A：用 Android Studio（推荐，最简单）

1. 下载安装 [Android Studio](https://developer.android.com/studio)（首次启动会自动装好 SDK）。
2. 打开 Android Studio → 选择 **Open** → 打开本项目下的 `android/` 文件夹。
3. 等它自动同步 Gradle（首次会下载依赖，耐心等待）。
4. 菜单 **Build → Build Bundle(s) / APK(s) → Build APK(s)**。
5. 产物位置：`android/app/build/outputs/apk/debug/app-debug.apk`，把该文件传到手机安装即可。

### 方式 B：命令行（已装 SDK 后）

```bash
npm run android:prepare   # 重新生成 seed + www，并 cap sync
cd android
./gradlew assembleDebug   # 或： gradlew.bat assembleDebug（Windows）
```

产物同样在 `android/app/build/outputs/apk/debug/`。

> 首次命令行构建需在 `android/local.properties` 里写 `sdk.dir=C:\\Users\\<你>\\AppData\\Local\\Android\\Sdk`（Android Studio 会自动生成此文件）。

---

## 三、每次改完诗词后如何更新 App

如果以后在电脑上新增/修改了诗词，想同步进新打包的 App：

```bash
npm run android:prepare   # 重新把 poems/ 打进 seed，并同步到安卓工程
```

然后再用上面的方式重新 Build APK 安装。

---

## 四、手机 ↔ 电脑 数据同步

App **本身不做同步**（保持原有逻辑），同步交给外部工具，数据仍是 JSON 文件。

### 推荐：Syncthing（免费开源，双向自动同步）

1. 电脑和手机各装 [Syncthing](https://syncthing.net/)。
2. 建立一条同步关系：
   - **手机端文件夹**：`/storage/emulated/0/Documents/MyPoems/poems`
   - **电脑端文件夹**：`d:\MyProject\MyPoems\poems`
3. 开启双向同步后，任何一端新增/编辑的诗都会自动同步到另一端。

> 屏蔽词配置 `ignore_words.json` 也可以再建一条同步（手机 `Documents/MyPoems/ignore_words.json` ↔ 电脑 `ignore_words.json`），不同步也不影响使用，只是两端屏蔽词可能略有差异。

### 备选：USB 手动拷贝

手机连电脑，在文件管理器里把手机 `Documents/MyPoems/poems/` 里的 `.json` 文件拷到电脑 `poems/` 即可（反之亦然）。

---

## 五、存储权限说明（重要）

诗词文件存在公开目录 `Documents/MyPoems/`。由于 **Android 11+ 的分区存储（Scoped Storage）限制**，App 默认只能看到「自己创建」的 `.json` 文件；从电脑 USB / 文件管理器**拷入**的文件属于「其它来源」，需要 App 拥有「所有文件访问权限」才能被列出来。

因此首次使用请**开启一次**该权限：

1. 手机「设置」→「应用」→「应用管理」（或「应用和通知」）。
2. 找到「诗词集」。
3. 进入「权限」→「文件和媒体」/「所有文件访问权限」→ 设为「允许」。

> 开启后，App 才能看到你从电脑拷贝进来的 JSON 文件。
> 不开启也不影响 App 内「添加新篇」等正常使用（那些文件由 App 自己创建、自己可见）。


---

## 六、桌面端不受影响

- `js/db-mock.js` 仅在手机 App（Capacitor 原生环境）内接管 `/api/...`；在电脑端（Electron）自动失效。
- 桌面端仍用 `npm start` 启动，功能与数据路径（`poems/`）完全不变。

---

## 七、图标（可选）

当前 App 使用 Capacitor 默认图标。若要换成自己的图标：

1. 准备 1024×1024 的 PNG 图标。
2. 运行 `npx capacitor-assets generate --android`（或手动替换 `android/app/src/main/res/mipmap-*/ic_launcher*.png`）。
