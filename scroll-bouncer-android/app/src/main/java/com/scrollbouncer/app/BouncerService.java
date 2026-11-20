package com.scrollbouncer.app;

import android.accessibilityservice.AccessibilityService;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.PixelFormat;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Log;
import android.view.Gravity;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.view.accessibility.AccessibilityEvent;
import android.webkit.WebView;

/**
 * Watches which app comes to the front. When it is one on the list, the little
 * guy walks across the top of the screen, boops the close button, and the
 * person is sent back to the home screen.
 *
 * Android tells this service only that a different window has come to the
 * front and which app it belongs to. It cannot read what is on the screen.
 */
public class BouncerService extends AccessibilityService implements Stage.Cues {
    private static final String TAG = "ScrollBouncer";
    /** He normally takes about ten seconds. After this long, clear up regardless. */
    private static final long TOO_LONG_MS = 30_000;
    /** After a performance, how long before the same app can set him off again. */
    private static final long REST_MS = 1_500;

    private final Handler main = new Handler(Looper.getMainLooper());
    private final Runnable giveUp = this::leave;
    private Prefs prefs;
    private WindowManager windows;

    private WebView stage;                           // null unless he is on screen
    private WindowManager.LayoutParams stageParams;
    private String target;                           // the app he has come to close
    private boolean dark;
    private String lastTarget;
    private long restUntil;

    @Override
    protected void onServiceConnected() {
        prefs = new Prefs(this);
        windows = getSystemService(WindowManager.class);
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event.getEventType() != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return;
        CharSequence name = event.getPackageName();
        if (name == null || prefs == null) return;
        String app = name.toString();
        if (app.equals(getPackageName())) return;

        if (stage != null) {
            // He is already on. If they have gone somewhere else themselves before
            // he got there, there is nothing left for him to close.
            if (!dark && !app.equals(target) && isAnApp(app)) leave();
            return;
        }
        if (!prefs.closes(app)) return;
        if (app.equals(lastTarget) && SystemClock.uptimeMillis() < restUntil) return;
        enter(app);
    }

    @Override
    public void onInterrupt() {
    }

    @Override
    public boolean onUnbind(Intent intent) {
        leave();
        return super.onUnbind(intent);
    }

    /** Puts him on screen, over the top of the app, without getting in the way of taps. */
    private void enter(String app) {
        WindowManager.LayoutParams params = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                        | WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE
                        | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
                        | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS
                        | WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
                PixelFormat.TRANSLUCENT);
        params.gravity = Gravity.TOP | Gravity.START;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            params.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }

        WebView web;
        try {
            web = Stage.open(this, statusBarDp(), this);
            windows.addView(web, params);
        } catch (RuntimeException e) {
            // The phone's web view is missing or being updated, so he cannot be drawn just now.
            Log.w(TAG, "could not go on stage", e);
            return;
        }
        stage = web;
        stageParams = params;
        target = app;
        dark = false;
        main.postDelayed(giveUp, TOO_LONG_MS);
        Log.i(TAG, "on stage");
    }

    /** The screen is dark: send them home, unseen, while he says his piece. */
    @Override
    public void dark() {
        if (stage == null) return;
        dark = true;
        prefs.countClose();
        // From here on, taps should not reach whatever is underneath.
        stageParams.flags &= ~WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE;
        windows.updateViewLayout(stage, stageParams);
        boolean home = performGlobalAction(GLOBAL_ACTION_HOME);
        Log.i(TAG, "dark, sent home: " + home);
    }

    @Override
    public void done() {
        leave();
    }

    /** Takes him off screen. Safe to call when he is not on. */
    private void leave() {
        main.removeCallbacks(giveUp);
        if (stage == null) return;
        try {
            windows.removeView(stage);
        } catch (RuntimeException ignored) {
            // Already gone.
        }
        stage.destroy();
        stage = null;
        Log.i(TAG, "off stage");
        lastTarget = target;
        restUntil = SystemClock.uptimeMillis() + REST_MS;
    }

    /** Whether this is something a person opens, as opposed to a keyboard or a system pop-up. */
    private boolean isAnApp(String app) {
        PackageManager packages = getPackageManager();
        if (packages.getLaunchIntentForPackage(app) != null) return true;
        Intent home = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME);
        ResolveInfo launcher = packages.resolveActivity(home, PackageManager.MATCH_DEFAULT_ONLY);
        return launcher != null && launcher.activityInfo != null && app.equals(launcher.activityInfo.packageName);
    }

    /** Height of the status bar and any camera cut-out, so he walks below them. */
    private int statusBarDp() {
        float density = getResources().getDisplayMetrics().density;
        int px;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            px = windows.getCurrentWindowMetrics().getWindowInsets()
                    .getInsetsIgnoringVisibility(WindowInsets.Type.statusBars() | WindowInsets.Type.displayCutout())
                    .top;
        } else {
            px = Math.round(24 * density);
        }
        return Math.round(px / density);
    }
}
