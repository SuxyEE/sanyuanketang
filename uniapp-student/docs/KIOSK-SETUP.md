# 红米 Pad SE 9 · Kiosk 强控制模式配置完整步骤

> 目标：把三元课堂学生端固化为「单应用 Kiosk」—— 学生不能切走、不能拉下通知栏、不能进设置、不能卸载，重启自动回到本应用。

## 0.5. UTS 插件已自带（无需手动安装）

本项目仓库已经在 `uniapp-student/src/uni_modules/snyuan-kiosk/` 内集成了完整的 UTS 插件：

```
uniapp-student/src/uni_modules/snyuan-kiosk/
├── package.json                                      插件元信息
├── utssdk/
│   ├── interface.uts                                 TypeScript 类型定义
│   └── app-android/
│       ├── index.uts                                 UTS 主入口（startLockTask / setStatusBarDisabled / ...）
│       ├── config.json                               原生权限 + Receiver 注册
│       ├── res/xml/snyuan_device_admin.xml           DeviceAdmin policy
│       └── src/com/snyuan/kiosk/
│           └── SnyuanDeviceAdminReceiver.java       Device Admin 接收器
```

HBuilderX 在打包 app-android 时会自动编译。无需 `npx skills add` 或手动 import。

JS 侧调用入口：`@/kiosk/index.ts`，被 `@/composables/useAntiExit.ts` 与 classroom 页的 `screen:lock` 事件自动调用。

剩下要做的只有：**第 3 步 ADB 设 Device Owner**。

## 0. 前置条件

| 项 | 要求 |
|---|---|
| 设备 | 红米 Pad SE 9（HyperOS / Android 14，型号 24087RA8AC） |
| 系统语言 | 中文简体 |
| 平板状态 | **新机或已恢复出厂**（**重要**：Device Owner 必须在没有任何账号绑定的设备上设置） |
| 电脑 | Windows / macOS / Linux，装好 [`adb`](https://developer.android.com/tools/releases/platform-tools) |
| USB 线 | 数据线（能 ADB 调试，不只是充电） |

## 1. 平板开启开发者选项 + USB 调试

1. 设置 → 我的设备 → 全部参数与信息 → 连按 **MIUI 版本（或 HyperOS 版本）** 7 次，提示「您已处于开发者模式」
2. 设置 → 更多设置 → 开发者选项
3. 打开：
   - **USB 调试**
   - **USB 调试（安全设置）**：允许通过 USB 修改密码 / 模拟用户操作
   - **OEM 解锁**（如要 root 锁机，否则可不开）
4. 用 USB 连接电脑，平板弹「允许 USB 调试」→ 勾选「始终允许」→ 确定
5. 终端 `adb devices`，看到 `xxxx  device` 即可

## 2. 安装本 App

把 HBuilderX 出的 `apk` 拖进 adb：

```bash
adb install -r snyuan-student-debug.apk
```

或扫码 / 直接拷贝到平板 → 文件管理器安装。

## 3. **关键步骤** · 把本 App 设为 Device Owner

> **必须**在「没有任何 Google 账号 / 小米账号 / 工作账号绑定」的设备上执行；
> 否则会报 `java.lang.IllegalStateException: Not allowed to set the device owner because there are already several users on the device`。
>
> 红米 Pad SE 9 新机首次开机时，**跳过登录小米账号**直接进入桌面，然后再装 App，**最稳**。
> 若已经登录过，建议「设置 → 我的设备 → 备份与重置 → 恢复出厂设置」一次再来。

### 3.1 找到本 App 的 `DeviceAdminReceiver` 全名

**重要**：UniApp 编译出来的 Android applicationId（包名）默认是 `uni.UNI<appid 后 8 位 hash>`，**不是** `com.snyuan.kiosk`。需要先确认。

#### 方法 A · `aapt dump badging`（推荐）

```bash
# 找到 APK 实际包名
aapt dump badging snyuan-student-release.apk | grep "^package:"
# 输出示例：package: name='uni.UNIE234A1B' versionCode='100' versionName='1.0.0'
# 那么 applicationId = uni.UNIE234A1B
```

#### 方法 B · `manifest.json` 显式固定包名（推荐生产环境用）

编辑 `uniapp-student/src/manifest.json`，在 `app-plus.distribute.android` 下加 `packagename` 字段：

```json
"app-plus": {
  "distribute": {
    "android": {
      "packagename": "com.snyuan.kiosk",
      "permissions": [ ... ]
    }
  }
}
```

重新打包后包名就是 `com.snyuan.kiosk`，与 UTS 插件里 `SnyuanDeviceAdminReceiver` 的包路径一致。

#### Receiver 全名

无论用哪种方法，Receiver 类的 `ComponentName` **始终是**：

```
<applicationId>/com.snyuan.kiosk.SnyuanDeviceAdminReceiver
```

举例：
- 默认包名 `uni.UNIE234A1B` → ComponentName `uni.UNIE234A1B/com.snyuan.kiosk.SnyuanDeviceAdminReceiver`
- 已固定 `com.snyuan.kiosk` → ComponentName `com.snyuan.kiosk/com.snyuan.kiosk.SnyuanDeviceAdminReceiver`

### 3.2 ADB 命令

```bash
# Step 1：确保设备没有任何用户账号
adb shell dpm list-owners            # 期望输出 "No device owner."
adb shell pm list users              # 期望只有 UserInfo{0:主用户:13} flags=13 一个主用户

# Step 2：拿到包名后设置 device owner（替换 <APP_ID> 为 aapt 看到的实际值）
adb shell dpm set-device-owner <APP_ID>/com.snyuan.kiosk.SnyuanDeviceAdminReceiver

# 例如：
# adb shell dpm set-device-owner uni.UNIE234A1B/com.snyuan.kiosk.SnyuanDeviceAdminReceiver
# 或固定包名后：
# adb shell dpm set-device-owner com.snyuan.kiosk/com.snyuan.kiosk.SnyuanDeviceAdminReceiver

# 看到 "Success: Device owner set to package ..." 即成功
```

⚠️ 如果失败常见报错与处理：

| 报错 | 原因 | 处理 |
|---|---|---|
| `Not allowed to set the device owner because there are already several users on the device` | 已有用户/账号 | 恢复出厂、重新激活时跳过账号登录 |
| `does not have AndroidManifest's <DeviceAdminReceiver>` | UTS 插件没编 receiver | 检查 `snyuan-kiosk-uts-template.uts` 是否注册了 receiver；用 `aapt dump xmltree` 看 AndroidManifest 是否含 `android.app.action.DEVICE_ADMIN_ENABLED` |
| `Unable to start service` | 包名拼错 | 用 `adb shell dumpsys package com.snyuan.kiosk` 确认存在 |

### 3.3 验证 Device Owner

```bash
adb shell dpm list-owners
# 期望输出：Device Owner: ComponentInfo{<APP_ID>/com.snyuan.kiosk.SnyuanDeviceAdminReceiver}
# APP_ID 与第 3.2 步设置时一致
```

## 4. App 内自检

启动 App → 进任意页面 → 调 `diagnoseKiosk()` 看返回：

```json
{
  "ok": true,
  "info": {
    "isDeviceOwner": true,
    "sdkInt": 34,
    "model": "24087RA8AC",
    "manufacturer": "Xiaomi",
    "isInLockTask": true,
    "isKeyguardDisabled": true
  }
}
```

`isDeviceOwner: true` + `isInLockTask: true` 就成功了。

## 5. 学生平板部署清单（每台）

- [ ] 平板已恢复出厂、首次开机跳过账号
- [ ] 装好 `snyuan-student-release.apk`
- [ ] adb 执行 `dpm set-device-owner` 设置为 device owner
- [ ] App 启动后 `diagnose()` 返回 `isDeviceOwner: true`
- [ ] 测试：长按 Home / Recent → 无任何反应
- [ ] 测试：从顶部下拉 → 状态栏不展开
- [ ] 测试：拔电源重新插电 → 自动开机进入本 App
- [ ] 测试：教师下发 `screen:lock` → 即使按 Home 也回不到桌面

## 6. 解除 Kiosk（运维 / 维修时）

```bash
# 替换 <APP_ID> 为实际编译产物包名

# 临时退出 lockTask（不解 device owner）
adb shell am force-stop <APP_ID>

# 完全移除 device owner（需要 App 内主动 clearDeviceOwnerApp）
adb shell dpm remove-active-admin <APP_ID>/com.snyuan.kiosk.SnyuanDeviceAdminReceiver
```

或者，在 App 内加一个**师傅密码后门**：长按右上角 logo 10 秒 → 输入运维密码 → 调 `dpm.clearDeviceOwnerApp()` 退出。

## 7. 红米 / MIUI / HyperOS 已知坑

| 现象 | 原因 / 处理 |
|---|---|
| 设置 Device Owner 后还能从顶部下拉通知栏 | HyperOS 14 上 `startLockTask` + `STATUS_BAR_DISABLE_*` 才能彻底禁用；需在 UTS 里加 `statusBarManager.disable()` |
| 锁屏密码界面能切到其他 App | 必须 `setKeyguardDisabled(true)` 配合，且关闭电源键长按菜单 |
| 平板重启不自动回到本 App | 在 manifest 增加 `<receiver android:name=".BootReceiver">` 监听 `RECEIVE_BOOT_COMPLETED`，启动时拉起 MainActivity |
| 充电时弹小米助手 | 设置 → 应用管理 → 「小米助手」→ 禁用，或 device owner 模式下用 `setApplicationHidden()` |
| 长按电源键还能关机 | 真正完全禁需 root；妥协方案：在 App 启动后调 `KeyguardManager.requestDismissKeyguard()` + 注册关机广播延迟开机 |

## 8. 安全提示

- **Device Owner 一旦设置，只能通过 App 主动调用 `clearDeviceOwnerApp()` 或恢复出厂解除**，不要弄丢运维密码。
- 建议在 App 内置 `dpm.clearDeviceOwnerApp()` 触发按钮，便于学校 IT 紧急维修。
- 切勿在生产固件中暴露 ADB（关闭 USB 调试），否则任何带 USB 的人都能拿到学生数据。
