package com.scrollbouncer.app;

import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.graphics.PixelFormat;
import android.hardware.display.DisplayManager;
import android.os.Binder;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.ResultReceiver;
import android.util.Log;
import android.view.Display;
import android.view.Gravity;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.webkit.WebView;

/**
 * Draws him over whatever app is in front, when the service that keeps watch
 * asks for it.
 *
 * It runs in a process of its own. The web view he is drawn with is a large
 * piece of software: now and then it crashes, and Android stops any process
 * using it when the Google service it borrows fonts from is restarted. Keeping
 * it apart means the watching carries on when that happens.
 */
public class StageService extends Service {
    private static final String TAG = "ScrollBouncer";

    /** What the watcher can ask for. */
    static final String WARM_UP = "com.scrollbouncer.app.WARM_UP";
    static final String ENTER = "com.scrollbouncer.app.ENTER";
    static final String LEAVE = "com.scrollbouncer.app.LEAVE";
    /** With ENTER: a ResultReceiver that is told how the performance goes. */
    static final String CUES = "cues";
    /** With ENTER: whether he offers the dance deal, and what he says if not "Nope not now". */
    static final String DEAL = "deal";
    static final String LINE = "line";

    /**
     * What the watcher is told: he is on screen, the screen has gone dark, he has
     * finished, or he could not go on. Sending the phone to its home screen when it
     * goes dark is left to the watcher, which has to know about it first: otherwise
     * it would see the home screen appear and take it that the person had left.
     */
    static final int ON = 1;
    static final int DARK = 2;
    static final int DONE = 3;
    static final int FAILED = 4;
    /** They said yes to the dance deal, and they danced to the end so he is letting them back in. */
    static final int DANCING = 5;
    static final int LET_IN = 6;
    /** With FAILED: Android's description of what went wrong. */
    static final String WHY = "why";
    /** With ON: an IBinder belonging to this process, so the watcher can tell if the process is stopped. */
    static final String ALIVE = "alive";

    /** The watcher takes him off long before this. It is here in case the watcher has been stopped. */
    private static final long LONGEST_MS = 90_000;
    /** The same, once they have said yes to a dance: it lasts just over a minute. */
    private static final long DANCING_MS = 180_000;

    private final Handler main = new Handler(Looper.getMainLooper());
    private final IBinder alive = new Binder();
    private int lastAsk;                             // Android's number for the most recent thing asked of this service
    private final Runnable tooLong = () -> {
        Log.w(TAG, "on stage for too long");
        leave();
        stopSelf(lastAsk);
    };
    private static boolean warm;                     // whether this process has loaded the web view
    private Context windowContext;
    private WindowManager windows;

    private WebView stage;                           // null unless he is on screen
    private WindowManager.LayoutParams stageParams;
    private ResultReceiver cues;
    private int turn;                                // goes up by one each time he goes on or comes off

    /** Asks for one of the things above. Throws if Android will not start the service just now. */
    static void ask(Context context, String what, ResultReceiver cues) {
        ask(context, what, cues, false, null);
    }

    static void ask(Context context, String what, ResultReceiver cues, boolean deal, String line) {
        Intent intent = new Intent(context, StageService.class).setAction(what);
        if (cues != null) intent.putExtra(CUES, cues);
        intent.putExtra(DEAL, deal);
        if (line != null) intent.putExtra(LINE, line);
        context.startService(intent);
    }

    @Override
    public void onCreate() {
        super.onCreate();
        windowContext = windowContext();
        windows = windowContext.getSystemService(WindowManager.class);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        lastAsk = startId;
        String what = intent == null ? null : intent.getAction();
        if (ENTER.equals(what)) {
            leave();
            enter(receiver(intent), intent.getBooleanExtra(DEAL, false), intent.getStringExtra(LINE));
        } else if (LEAVE.equals(what)) {
            leave();
        } else if (WARM_UP.equals(what)) {
            warmUp();
        }
        // Nothing keeps this process once he is off: Android can have the memory back.
        // Giving the number means this is ignored if something else has been asked for since.
        if (stage == null) stopSelf(startId);
        return START_NOT_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        if (stage != null) {
            // Android has stopped the service with him still on. The watcher is not expecting that.
            leave();
            tell(FAILED, "the service that draws him was stopped");
        }
        super.onDestroy();
    }

    @SuppressWarnings("deprecation") // The replacement only exists from Android 13.
    private static ResultReceiver receiver(Intent intent) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return intent.getParcelableExtra(CUES, ResultReceiver.class);
        }
        return intent.getParcelableExtra(CUES);
    }

    /** Gets the web view loaded before he is first needed, because the first load is the slow one. */
    private void warmUp() {
        if (warm) return;
        warm = true;
        try {
            new WebView(getApplicationContext()).destroy();
            Log.i(TAG, "web view ready");
        } catch (RuntimeException e) {
            // He may still be able to go on later, for instance once the web view has finished updating.
            Log.w(TAG, "could not start the web view", e);
        }
    }

    /** Puts him on screen, over the top of the app. */
    private void enter(ResultReceiver tellWatcher, boolean deal, String line) {
        cues = tellWatcher;
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

        // A cue from the page can arrive a moment after its performance has been cut
        // short. By then he may be on again, so only this turn's cues are heeded.
        int mine = ++turn;
        Stage.Cues fromPage = new Stage.Cues() {
            @Override
            public void dark() {
                if (mine == turn) wentDark();
            }

            @Override
            public void done() {
                if (mine == turn) finished();
            }

            @Override
            public void dancing() {
                if (mine != turn) return;
                main.removeCallbacks(tooLong);
                main.postDelayed(tooLong, DANCING_MS);
                // They will be jumping about, not touching the screen: keep it from going to sleep.
                if (stage != null) {
                    stageParams.flags |= WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON;
                    try {
                        windows.updateViewLayout(stage, stageParams);
                    } catch (RuntimeException e) {
                        Log.w(TAG, "could not keep the screen on", e);
                    }
                }
                tell(DANCING, null);
            }

            @Override
            public void letIn() {
                if (mine != turn || stage == null) return;
                // The app is opening again underneath: let taps through to it as the screen lightens.
                stageParams.flags |= WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE;
                try {
                    windows.updateViewLayout(stage, stageParams);
                } catch (RuntimeException e) {
                    Log.w(TAG, "could not let taps through", e);
                }
                tell(LET_IN, null);
            }
        };
        WebView web = null;
        try {
            web = Stage.open(windowContext, statusBarDp(), fromPage, deal, line);
            windows.addView(web, params);
        } catch (RuntimeException e) {
            // The phone's web view is missing or being updated, or the permission to draw over apps has gone.
            Log.w(TAG, "could not go on stage", e);
            if (web != null) web.destroy();
            tell(FAILED, String.valueOf(e));
            return;
        }
        warm = true;
        stage = web;
        stageParams = params;
        main.postDelayed(tooLong, LONGEST_MS);
        Log.i(TAG, "on stage");
        tell(ON, null);
    }

    /** The screen is dark. The watcher sends them home, unseen, while he says his piece. */
    private void wentDark() {
        if (stage == null) return;
        // From here on, taps should not reach whatever is underneath.
        stageParams.flags &= ~WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE;
        try {
            windows.updateViewLayout(stage, stageParams);
        } catch (RuntimeException e) {
            Log.w(TAG, "could not take over the screen's taps", e);
        }
        tell(DARK, null);
    }

    /** He has said his piece and faded away. */
    private void finished() {
        leave();
        tell(DONE, null);
        stopSelf(lastAsk);
    }

    /** Takes him off screen. Safe to call when he is not on. */
    private void leave() {
        main.removeCallbacks(tooLong);
        if (stage == null) return;
        turn++;
        try {
            windows.removeView(stage);
        } catch (RuntimeException ignored) {
            // Already gone.
        }
        stage.destroy();
        stage = null;
        Log.i(TAG, "off stage");
    }

    private void tell(int what, String why) {
        if (cues == null) return;
        Bundle more = new Bundle();
        if (why != null) more.putString(WHY, why);
        if (what == ON) more.putBinder(ALIVE, alive);
        cues.send(what, more);
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
