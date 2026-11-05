# Act 2 Between the Words 设计与试玩说明

2026 年 11 月 4 日。接在 Act 1 末尾的双人可玩设计版，供家铭与 Sam 试玩后调整。

## 设计出发点

这一幕让两个人亲身遇到“我表达的，和你收到的，是否一样”。空间里的行动需要对方维持，通道的方向需要对方解释。找回原始表达、提出澄清、交换主导权和共同决定，构成实际操作。

本次新增的两关、符号回声、轮换职责、双人合钥，是根据之前 Notes 做出的具体玩法提案。角色暂用暖色人形和冷色外壳形象区分，两位玩家都由真实参与者控制。正式的机器人身份与 Act 3 结局仍可由你和 Sam 调整。

## 全程流程

| 段落 | 两人的行动 | 推进条件 |
|---|---|---|
| 从 Act 1 到共享空间 | 各发至少两条消息，分别确认 Continue together | 双方场景加载完成 |
| 看到话语的旅程 | 对照本房间 Act 1 的原话和送达文字，各自选择 Step into the space | 两人都确认看过 |
| 第一关 Make room to listen | 玩家二站在右侧倾听圆环，引导玩家一穿门取钥匙碎片 | 正确信号经过双方澄清，而且引路者保持在圆环内 |
| 第二关 Let the other person lead | 交换职责，玩家一站在左侧圆环，玩家二穿门取另一半 | 两人分别确认换位后，按同样规则合作 |
| 双人合钥 | 各自把碎片带到拱门下相应的暖色或冷色圆环 | 同时停留约 1.6 秒 |
| 前往 Act 3 | 两人分别选择 Continue together | 合钥完成且双方同意，下一场景也完成加载 |

实际游玩时长需要试玩观察。第一遍请慢慢读提示，留意对方视角的差异。

## 第一关怎样玩

1. 玩家二点击地板右边的双圈，人物会走过去。停在圈内后，右侧会显示正确符号，可能是 △、○ 或 ≈。
2. 玩家二点击对应符号发送。空间里的“回声”会把送达符号改变，玩家一会看见这个送达版本。
3. 玩家一点击 Ask for the original signal，向对方请求澄清。
4. 玩家二点击 Share my original signal。玩家一现在能看见实际发出的符号。
5. 玩家二继续留在圆环里，玩家一沿着对应符号的门走到另一边，再靠近发光的半圆碎片。
6. 一半钥匙取得后，两人各点 I’m ready to exchange roles，开始第二关。

门上的 △、○、≈ 从上到下排列。可以先点击门前，再点击门后。人物有行走速度，墙壁会挡住人物，停留一下再看位置。

## 第二关与合钥

第二关改由玩家一引路。玩家一站左边圆环，玩家二从右往左穿门。正确符号会重新选择。第二块碎片找到后，墙壁消退，两人都可以走向上方拱门。

暖色人物走到左边的暖色圆环，冷色人物走到右边的冷色圆环。两人同时停留，进度条填满，钥匙合在一起。

点击 Continue together 后，另一位会看到明显的准备提示。已经准备的人可以选择 Keep this moment a little longer，取消自己的准备。两人都确认后，共同进入 Act 3 的门口。

## 操作方式

- 点击或按住鼠标拖动游戏地板，人物会朝所选位置行走。移动到右侧面板操作时，人物会走到上一次选择的位置后停下。
- 手机和平板可触摸地板或拖动。
- 方向键或 WASD 可以微调位置。
- Use my hand 使用现有手势识别。指尖在地板某处停留约 0.8 秒可选定行走目的地，在按钮上停留约 1.5 秒可选择。需要摄像头、网络加载模型，以及 localhost 或 HTTPS。
- 普通局域网 HTTP 地址可使用鼠标与触屏。摄像头识别仍需你们在实际设备验证。

## 消息与回声的区别

开场对照使用当前房间 Act 1 的真实记录，包含双方各自的原话和实际送达文字。Ollama 模式展示实际模型输出，Prepared 模式展示明确的预设改写，Direct 模式如实展示两者相同。画面不会伪造聊天记录。

解谜中的三个符号采用固定循环改写，由空间内的“回声”装置表现。这样每次谜题都能解释和完成，双方可以通过请求和确认找回原始信号。它是游戏规则，与 Act 1 所选模型独立。

## 为什么两个人都需要操作

引路者掌握另一人看不见的线索，并用身体位置维持通道。行动者需要发起澄清，并真正走过通道取得碎片。第二关让双方交换任务，避免一人始终指挥或等待。结尾两个人各自带来一半钥匙，并各自选择是否继续。

## 为 Act 3 留下什么

同一房间、同一玩家身份、原有聊天记录和已完成幕次持续保留。服务器交接包记录合成钥匙、两人确认、已找回的消息 ID 和仍然关闭的外壳状态。

完整版本中的 Act 3 已接上共享钥匙的邀请、接受与外壳打开。之后两人自由输入，原样交流，并共同决定何时结束。详细操作见 ACT3_交流与完整流程.md。

## English description for discussion

Between the Words is a cooperative second act about asking what another person meant. The players first compare their own messages with what actually reached the other screen. They then enter a shared room with two alternating roles. One person holds a listening circle and sees a private mark. The other must request the original signal, follow it through a passage, and recover a key fragment. In the second room they exchange responsibilities. Both fragments have to arrive at the doorway together, and both people choose whether to continue. The shared key, transcript, and player identities carry into the third act.

## 试玩后观察

请先完整走一遍，再记录具体卡住的位置。可以特别观察对方是否理解原话揭示、能否找到倾听圆环、是否注意到请求澄清、交换职责是否有意义、合钥时是否感到双方都在参与。
