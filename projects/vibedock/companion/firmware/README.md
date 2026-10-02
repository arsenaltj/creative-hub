# 吧唧固件接入边界

这里提供 BLE 通信契约和 C 头文件，**不是可烧录固件**。现有目录的烧录程序、说明不能代替板型对应的 SDK、示例工程与编译工具链。拿到 SDK 后，将下列入口接入其 BLE、JSON、UI 与触控 API。

| 设备需要实现 | 约定 |
|---|---|
| 广播服务 | `VD_SERVICE_UUID`；用户在 PC 本机 Chrome / Edge 中选择设备 |
| 接收快照、动作回执 | `VD_SNAPSHOT_UUID`，Write With Response |
| 发送触控动作 | `VD_TOUCH_UUID`，Notify |
| 数据拆包 | 12 字节头 + UTF-8 JSON，使用实际协商的特征值长度；PC 保守默认 20 字节 |
| 四区与菜单 | 四区查看任务；中心进入菜单；菜单二级页切换工具，不直接一键切换 |
| 断连 | 保留画面并标明离线，停止发动作；重连先收完整快照 |
| 控制 | 原样带回快照中的 `epoch/tool`；每次动作生成唯一 `actionId`；收到匹配回执后更新，失败显示提示 |

头部：`56 44 01 kind id:u32LE index:u16LE count:u16LE`。kind：1 快照、2 触控、3 回执。单条 JSON ≤64 KiB、同时最多 4 条未完成消息、15 秒超时；限制累计长度，拒绝冲突重复片。拆包参考 `public/ble-codec.mjs`，协议已通过最小 MTU、多字节、乱序、重复与损坏片测试。

触控 JSON 例（变量须从最新快照获得）：

```json
{"v":1,"actionId":"device-unique-0001","type":"task.select","epoch":"snapshot-epoch","tool":"codex","taskId":"task-id","source":"device"}
```

快照包含 `tasks[4]`、`selected`、工具、状态、输出节选、能力与用量。`interaction.resolve` 必须包含当前请求 `requestId/requestRevision/decision`；真实审批能力为 false 时不能显示可批准按钮。菜单进入工具选择页后用 `tool.select` 加 `target` 切换。PC 将控制凭据留在本机；设备不接收云端 Token 或服务器密钥。

蓝牙音频由 Windows 已识别的麦克风/扬声器连接处理，数据 GATT 服务不能替代音频连接；VibeDock 不做语音识别。真机烧录、功耗、休眠、触控命中与音频路由仍需在正确板型验证。
