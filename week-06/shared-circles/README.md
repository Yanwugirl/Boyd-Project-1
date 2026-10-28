# Week 6 Shared Circles

按 Boyd 提供的 Shared Circles 教程整理。核心规则保持不变：点击空白处添加圆，点中圆删除最上层那个圆，服务器向每个浏览器广播同一份列表。额外加入了连接状态、输入检查和简单的数量上限。

## Windows 与 VS Code

1. 从 GitHub 下载本仓库 ZIP，解压并在 VS Code 打开。
2. 在 Terminal → New Terminal 中进入 `week-06/shared-circles`。
3. 执行：

```powershell
node -v
npm -v
npm ci
npm start
```

Node 建议使用 24 LTS。PowerShell 若拦截 npm.ps1，改用 `npm.cmd ci` 与 `npm.cmd start` 即可。

4. 浏览器打开 http://localhost:3000 。不要双击 HTML，也不要用 Live Server 启动联网版。
5. 同时开两个窗口；在一个窗口点击，另一个应出现同色圆。再开第三个，应看到之前的圆。
6. 按 Ctrl+C 停止。改 server.js 后重新启动；只改 public 中的文件则刷新网页。

## 三个入口

- `/stage-1/`：单个红圆跟鼠标，供重敲教程前半段。
- `/`：Socket.io 联网版。左上显示连接使用 polling 还是 websocket。
- `/practice/`：11 个原例和 5 个课堂练习改写；可编辑、重置、清空重敲。

## 在 Render 部署

GitHub Pages 只能发静态文件，不能运行这里的 Node 服务器。按教程创建 **Web Service**。

| 设置 | 值 |
|---|---|
| Public Git repository | https://github.com/Yanwugirl/Project-1-Networked-Presence |
| Branch | main |
| Root Directory | week-06/shared-circles |
| Runtime | Node |
| Build Command | npm ci --omit=dev |
| Start Command | npm start |
| Instance Type | Free |
| Health Check Path | /health |

仓库根目录也包含 render.yaml。只有 Render 真正完成部署并返回地址后，才有可分享的在线联网入口。不要把预计服务名写成已上线地址。

免费服务闲置会休眠；演示前提前打开。圆圈存在服务器内存中，刷新网页通常保留，服务器重启会清空。这个教程使用像素坐标，宽屏画出的圆可能超出窄屏；尚未做 Step 18 的坐标归一化扩展。

## 关键代码

浏览器：`socket.emit('click', { x, y })` 发送动作，`socket.on('circles', ...)` 接收状态。

服务器：`socket.emit` 发给一个客户端，`io.emit` 发给所有客户端。服务器决定删除哪个圆和随机颜色，浏览器只画收到的列表。

Socket.io 与 WebSocket 不是同一个名称的两个写法。Socket.io 提供事件、重连等功能，可以先用 HTTP polling 再升级到 WebSocket。连接状态与测试记录用于确认真实传输。

## 检查

```powershell
npm ci
npm test
```

自动检查在本地启动真实 Node 服务器，连接多个 Socket.io 客户端，并检查新增、同步、重叠删除、新加入者和重新连接。它不能替代你本人在 Windows 上重敲，或两台物理设备通过 Render 进行测试。

## 来源

Shared Circles 教程和 Creative Coding Live Examples 来自 Boyd 提供的课堂材料。Shared Circles 使用 p5.js 2.3.4；课堂 live examples 使用 1.9.4，两个入口分别加载对应版本。

- https://socket.io/docs/v4/tutorial/step-5
- https://p5js.org/reference/p5/createCanvas/
- https://render.com/docs/deploy-node-express-app
- https://render.com/docs/free
