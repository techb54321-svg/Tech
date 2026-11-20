package com.scrollbouncer.app;

import android.app.AppOpsManager;
import android.content.Context;
import android.os.Build;
import android.os.Process;
import android.provider.Settings;

/** The two things the person has to allow before he can do his job. */
final class Access {
    private Access() {
    }

    /** Whether Android will tell the app which app is in front ("usage access"). */
    @SuppressWarnings("deprecation") // checkOpNoThrow is the only way to ask before Android 10.
    static boolean seesApps(Context context) {
        AppOpsManager ops = context.getSystemService(AppOpsManager.class);
        int uid = Process.myUid();
        String app = context.getPackageName();
        int mode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                ? ops.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, uid, app)
                : ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, uid, app);
        return mode == AppOpsManager.MODE_ALLOWED;
    }

    /** Whether he may be drawn on top of other apps. */
    static boolean drawsOver(Context context) {
        return Settings.canDrawOverlays(context);
    }

    static boolean ready(Context context) {
        return seesApps(context) && drawsOver(context);
    }
}
