package com.snyuan.kiosk;

import android.app.admin.DeviceAdminReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;
import android.widget.Toast;

/**
 * 师渊课堂 · Android Device Admin 接收器。
 *
 * 必须搭配 {@code adb shell dpm set-device-owner com.snyuan.kiosk/com.snyuan.kiosk.SnyuanDeviceAdminReceiver}
 * 才能让 UTS 层的 startLockTask() 真正生效。
 *
 * 本类不存任何业务状态；仅在被启用 / 禁用时记日志，便于运维 ADB 调试。
 */
public class SnyuanDeviceAdminReceiver extends DeviceAdminReceiver {
    private static final String TAG = "SnyuanKioskAdmin";

    @Override
    public void onEnabled(Context context, Intent intent) {
        Log.i(TAG, "Device admin enabled");
        try {
            Toast.makeText(context, "三元课堂已获得设备管理权限", Toast.LENGTH_SHORT).show();
        } catch (Throwable t) {
            // ignore toast failures in headless contexts
        }
        super.onEnabled(context, intent);
    }

    @Override
    public void onDisabled(Context context, Intent intent) {
        Log.i(TAG, "Device admin disabled");
        try {
            Toast.makeText(context, "三元课堂设备管理权限已被取消", Toast.LENGTH_SHORT).show();
        } catch (Throwable t) {
            // ignore
        }
        super.onDisabled(context, intent);
    }

    @Override
    public void onLockTaskModeEntering(Context context, Intent intent, String pkg) {
        Log.i(TAG, "Lock task entered for package: " + pkg);
        super.onLockTaskModeEntering(context, intent, pkg);
    }

    @Override
    public void onLockTaskModeExiting(Context context, Intent intent) {
        Log.i(TAG, "Lock task exited");
        super.onLockTaskModeExiting(context, intent);
    }
}
