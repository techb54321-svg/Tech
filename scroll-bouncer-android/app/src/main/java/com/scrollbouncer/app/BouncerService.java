package com.scrollbouncer.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.ServiceInfo;
import android.graphics.PixelFormat;
import android.hardware.display.DisplayManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Log;
import android.view.Display;
import android.view.Gravity;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;

/**
 * Keeps an eye on which app is in front. When it is one on the list, the little
 * guy walks across the top of the screen, boops the close button, and the
 * person is sent back to the home screen.
 *
 * It learns which app is in front from Android's record of app use, which says
 * only which app was opened and when. It cannot read what is on the screen.
 */
public class BouncerService extends Service implements Stage.Cues {
    private static final String TAG = "ScrollBouncer";
    private static final String CHANNEL = "on-duty";
    /** How often to check which app is in front, while the screen is on. */
    private static final long LOOK_EVERY_MS = 600;
    /** How far back each check re-reads, in case Android wrote something down a moment late. */
    private static final long LOOK_BACK_MS = 3_000;
    /** He normally takes about ten seconds. After this long, clear up regardless. */
    private static final long TOO_LONG_MS = 30_000;
    /** After a performance, how long before the same app can set him off again. */
    private static final long REST_MS = 1_500;

    private final Handler main = new Handler(Looper.getMainLooper());
    private final Runnable look = this::look;
    private final Runnable giveUp = this::leave;
    private final BroadcastReceiver screen = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            // Nothing can be opened while the screen is off, so stop checking until it is back on.
            main.removeCallbacks(look);
            if (Intent.ACTION_SCREEN_ON.equals(intent.getAction())) {
                lastSeen = System.currentTimeMillis();
                main.post(look);
            }
        }
    };
    private Prefs prefs;
    private UsageStatsManager usage;
    private Context windowContext;
    private WindowManager windows;
    private long lastSeen;                           // time of the newest app-use record acted on

    private WebView stage;                           // null unless he is on screen
    private WindowManager.LayoutParams stageParams;
    private String target;                           // the app he has come to close
    private boolean dark;
    private String lastTarget;
    private long restUntil;

    static void start(Context context) {
        context.startForegroundService(new Intent(context, BouncerService.class));
    }

    static void stop(Context context) {
        context.stopService(new Intent(context, BouncerService.class));
    }

    @Override
    public void onCreate() {
        super.onCreate();
        prefs = new Prefs(this);
        usage = getSystemService(UsageStatsManager.class);
        windowContext = windowContext();
        windows = windowContext.getSystemService(WindowManager.class);
        goOnDuty();

        IntentFilter onOrOff = new IntentFilter(Intent.ACTION_SCREEN_ON);
        onOrOff.addAction(Intent.ACTION_SCREEN_OFF);
        registerReceiver(screen, onOrOff);
        lastSeen = System.currentTimeMillis();
        main.post(look);
        Log.i(TAG, "on duty");

        // Loading the phone's web view for the first time is slow. Start on it now,
        // away from the main thread so nothing freezes, rather than when he is first needed.
        new Thread(() -> {
            try {
                WebSettings.getDefaultUserAgent(this);
            } catch (RuntimeException e) {
                Log.w(TAG, "could not warm up the web view", e);
            }
        }, "warm-up").start();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        main.removeCallbacks(look);
        unregisterReceiver(screen);
        leave();
        super.onDestroy();
    }

    /** Android asks that anything running all the time shows a notification saying so. */
    private void goOnDuty() {
        NotificationManager notes = getSystemService(NotificationManager.class);
        notes.createNotificationChannel(new NotificationChannel(
                CHANNEL, getString(R.string.duty_channel), NotificationManager.IMPORTANCE_LOW));
        Notification note = new Notification.Builder(this, CHANNEL)
                .setSmallIcon(R.drawable.ic_on_duty)
                .setContentTitle(getString(R.string.duty_title))
                .setContentText(getString(R.string.duty_text))
                .setContentIntent(PendingIntent.getActivity(this, 0,
                        new Intent(this, MainActivity.class), PendingIntent.FLAG_IMMUTABLE))
                .setOngoing(true)
                .build();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(1, note, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        } else {
            startForeground(1, note);
        }
    }

    /** Reads what has been opened since the last look, and acts on the most recent. */
    private void look() {
        main.postDelayed(look, LOOK_EVERY_MS);
        long now = System.currentTimeMillis();
        UsageEvents events = usage.queryEvents(Math.max(lastSeen, now - LOOK_BACK_MS), now + 1000);
        UsageEvents.Event event = new UsageEvents.Event();
        String latest = null;
        long newest = lastSeen;
        while (events.hasNextEvent()) {
            events.getNextEvent(event);
            if (event.getEventType() != UsageEvents.Event.ACTIVITY_RESUMED) continue;
            if (event.getTimeStamp() <= lastSeen) continue;   // already acted on
            if (event.getTimeStamp() >= newest) {
                newest = event.getTimeStamp();
                latest = event.getPackageName();
            }
        }
        lastSeen = newest;
        if (latest != null) cameToFront(latest);
    }

    private void cameToFront(String app) {
        // Only written when someone has asked for it with: adb shell setprop log.tag.ScrollBouncer DEBUG
        if (Log.isLoggable(TAG, Log.DEBUG)) Log.d(TAG, "in front: " + app);
        if (app.equals(getPackageName())) return;
        if (stage != null) {
            // He is already on. If they have gone somewhere else themselves before
            // he got there, there is nothing left for him to close.
            if (!dark && !app.equals(target)) leave();
            return;
        }
        if (!prefs.closes(app) || !Access.drawsOver(this)) return;
        if (app.equals(lastTarget) && SystemClock.uptimeMillis() < restUntil) return;
        enter(app);
    }

    /** Puts him on screen, over the top of the app. */
    private void enter(String app) {
        WindowManager.LayoutParams params = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
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
            web = Stage.open(windowContext, statusBarDp(), this);
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
        Intent home = new Intent(Intent.ACTION_MAIN)
                .addCategory(Intent.CATEGORY_HOME)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            startActivity(home);
            Log.i(TAG, "dark, sent home");
        } catch (RuntimeException e) {
            Log.w(TAG, "dark, but could not go to the home screen", e);
        }
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
        lastTarget = target;
        restUntil = SystemClock.uptimeMillis() + REST_MS;
        Log.i(TAG, "off stage");
    }

    /** A context that is allowed to put a window over other apps. */
    private Context windowContext() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return this;
        Display display = getSystemService(DisplayManager.class).getDisplay(Display.DEFAULT_DISPLAY);
        return createDisplayContext(display)
                .createWindowContext(WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY, null);
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
