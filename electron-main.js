const { app, BrowserWindow } = require('electron');
const path = require('path');
const { fork } = require('child_process');

let mainWindow;
let serverProcess;

function createWindow() {
    // 1. 在后台启动你的 server.js
    serverProcess = fork(path.join(__dirname, 'server.js'), [], {
        env: { ...process.env, NODE_ENV: 'production' }
    });

    // 2. 创建浏览器窗口
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        title: "MyPoems 个人诗词书斋",
        icon: path.join(__dirname, 'icon.ico'), // 如果你有图标的话
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    // 隐藏默认菜单栏 (可选)
    mainWindow.setMenuBarVisibility(false);

    // 3. 加载你的本地服务地址
    // 等待服务器启动的一小会儿
    setTimeout(() => {
        mainWindow.loadURL('http://localhost:3000');
    }, 1000);

    mainWindow.on('closed', function () {
        mainWindow = null;
    });
}

// 当 Electron 初始化完成时创建窗口
app.on('ready', createWindow);

// 窗口全部关闭时退出程序并杀死 Node 服务进程
app.on('window-all-closed', function () {
    if (serverProcess) serverProcess.kill();
    if (process.platform !== 'darwin') app.quit();
});