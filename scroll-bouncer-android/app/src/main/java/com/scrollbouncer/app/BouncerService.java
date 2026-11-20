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
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.content.pm.ServiceInfo;
import android.graphics.PixelFormat;
import android.hardware.display.DisplayManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.ResultReceiver;
import android.os.SystemClock;
import android.util.Log;
import android.view.Display;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.Toast;

import java.util.HashSet;
import java.util.Set;

/**
 * Keeps an eye on which app is in front. When it is one on the list, it sends
 * for the little guy, who walks across the top of the screen, boops the close
 * button, and sends the person back to the home screen.
 *
 * It learns which app is in front from Android's record of app use, which says
 * only which app was opened and when. It cannot read what is on the screen.
 *
 * He is drawn by StageService, in a process of its own, so that nothing that
 * goes wrong with the drawing can stop the watching. If he cannot be drawn, the
 * app is closed all the same.
 */
public class BouncerService extends Service {
    private static final String TAG = "ScrollBouncer";
    private static final String DUTY_CHANNEL = "on-duty";
    private static final String HELP_CHANNEL = "needs-you";
    private static final int DUTY_NOTE = 1;
    private static final int HELP_NOTE = 2;

    /** How often to check which app is in front, while the screen is on. */
    private static final long LOOK_EVERY_MS = 600;
    /** How far back each check re-reads, in case Android wrote something down a moment late. */
    private static final long LOOK_BACK_MS = 5_000;
    /** How often to check whether the screen is back on, in case Android is late saying so. */
    private static final long SCREEN_OFF_EVERY_MS = 5_000;
    /** On first going on duty, how far back to look for the app that is already in front. */
    private static final long ALREADY_OPEN_MS = 30 * 60_000;
    /** After a performance, how long before the same app can set him off again. */
    private static final long REST_MS = 1_500;
    /** How long he may take to appear once sent for. Most of it is for a slow phone starting its web view. */
    private static final long SHOW_UP_MS = 15_000;
    /**
     * How long he may then take to reach the button: this much for each dp he has to
     * walk, plus some to get going. It is well over twice what he needs on a slow phone.
     */
    private static final long WALK_MS_PER_DP = 30;
    private static final long GET_GOING_MS = 15_000;
    /** Once the screen is dark, how long he may take to say his piece and leave. */
    private static final long ENDING_MS = 20_000;
    /** How many times to try going on duty when Android will not allow it straight away, and how far apart. */
    private static final int DUTY_TRIES = 6;
    private static final long DUTY_RETRY_MS = 400;

    private final Handler main = new Handler(Looper.getMainLooper());
    private final Runnable look = this::look;
    private final Runnable giveUp = this::giveUp;
    private final BroadcastReceiver screen = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (Intent.ACTION_SCREEN_ON.equals(intent.getAction())) {
                lookNow();
            } else if (performing && !dark) {
                // They have put the phone down before he reached the button. Whatever was
                // open comes to the front again when the screen is back on, and so will he.
                callOff();
            }
        }
    };
    private Prefs prefs;
    private UsageStatsManager usage;
    private PowerManager power;
    private Context windowContext;
    private WindowManager windows;

    private boolean looking;                         // whether he has got as far as going on duty
    private long lastLook;                           // when the app-use records were last read
    private long lastSeen;                           // time of the newest app-use record acted on
    private String inFront;                          // the app that came to the front most recently
    private final Set<String> places = new HashSet<>();   // see isPlace
    private String letIn;                            // an app on his list that was opened during a break

    private View dot;                                // see goOnDuty
    private boolean performing;                      // whether he has been sent for and has not finished
    private int turn;                                // goes up by one each time he is sent for
    private String target;                           // the app he has come to close
    private boolean onStage;                         // whether he has appeared yet
    private boolean dark;
    private boolean wentElsewhere;                   // whether something else has come to the front since the screen went dark
    private String lastTarget;
    private long restUntil;

    /** Puts him on duty. Returns false if Android would not allow it just now. */
    static boolean start(Context context) {
        try {
            context.startForegroundService(new Intent(context, BouncerService.class));
            return true;
        } catch (RuntimeException e) {
            // Android does not always let an app that is in the background start this.
            Log.w(TAG, "could not be started", e);
            Status.problem(context, context.getString(R.string.problem_no_duty, e));
            return false;
        }
    }

    static void stop(Context context) {
        context.stopService(new Intent(context, BouncerService.class));
    }

    @Override
    public void onCreate() {
        super.onCreate();
        prefs = new Prefs(this);
        usage = getSystemService(UsageStatsManager.class);
        power = getSystemService(PowerManager.class);
        windowContext = windowContext();
        windows = windowContext.getSystemService(WindowManager.class);

        IntentFilter onOrOff = new IntentFilter(Intent.ACTION_SCREEN_ON);
        onOrOff.addAction(Intent.ACTION_SCREEN_OFF);
        registerReceiver(screen, onOrOff);
        goOnDuty(1);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // The app's own screen asks for this whenever it is open, which makes it a good
        // moment to be sure he is still looking.
        lookNow();
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        main.removeCallbacksAndMessages(null);
        unregisterReceiver(screen);
        hideDot();
        callOff();
        if (looking) Status.offDuty(this);
        super.onDestroy();
    }

    /**
     * Android asks that anything running all the time shows a notification saying
     * so, and does not always allow that to be started from the background, which
     * is where he is when Android has stopped the app and is starting it again.
     */
    private void goOnDuty(int attempt) {
        try {
            showOnDuty();
        } catch (RuntimeException e) {
            // Android does allow it for an app that is showing something over other apps.
            // So put up a dot too small to see, and try again in a moment.
            Log.w(TAG, "not allowed on duty, attempt " + attempt + ": " + e);
            if (dot == null) dot = showDot();
            if (dot != null && attempt < DUTY_TRIES) {
                main.postDelayed(() -> goOnDuty(attempt + 1), DUTY_RETRY_MS);
                return;
            }
            hideDot();
            Status.problem(this, getString(R.string.problem_no_duty, e));
            askToBeOpened();
            stopSelf();
            return;
        }
        hideDot();
        Status.onDuty(this);
        looking = true;
        // Start a little way back, so that an app which is already in front counts as just opened.
        lastSeen = System.currentTimeMillis() - Math.min(ALREADY_OPEN_MS, SystemClock.elapsedRealtime());
        lastLook = lastSeen + LOOK_BACK_MS;
        main.post(look);
        Log.i(TAG, "on duty");

        try {
            StageService.ask(this, StageService.WARM_UP, null);
        } catch (RuntimeException e) {
            // Not needed: it only saves a moment the first time he is sent for.
            Log.w(TAG, "could not warm up the stage", e);
        }
    }

    private void showOnDuty() {
        NotificationManager notes = getSystemService(NotificationManager.class);
        notes.createNotificationChannel(new NotificationChannel(
                DUTY_CHANNEL, getString(R.string.duty_channel), NotificationManager.IMPORTANCE_LOW));
        Notification note = new Notification.Builder(this, DUTY_CHANNEL)
                .setSmallIcon(R.drawable.ic_on_duty)
                .setContentTitle(getString(R.string.duty_title))
                .setContentText(getString(R.string.duty_text))
                .setContentIntent(openApp())
                .setOngoing(true)
                .build();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(DUTY_NOTE, note, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        } else {
            startForeground(DUTY_NOTE, note);
        }
        notes.cancel(HELP_NOTE);
    }

    /** He could not go back on duty by himself. Opening the app puts him back, so ask for that. */
    private void askToBeOpened() {
        NotificationManager notes = getSystemService(NotificationManager.class);
        notes.createNotificationChannel(new NotificationChannel(
                HELP_CHANNEL, getString(R.string.help_channel), NotificationManager.IMPORTANCE_DEFAULT));
        notes.notify(HELP_NOTE, new Notification.Builder(this, HELP_CHANNEL)
                .setSmallIcon(R.drawable.ic_on_duty)
                .setContentTitle(getString(R.string.help_title))
                .setContentText(getString(R.string.help_text))
                .setContentIntent(openApp())
                .setAutoCancel(true)
                .build());
    }

    private PendingIntent openApp() {
        return PendingIntent.getActivity(this, 0, new Intent(this, MainActivity.class), PendingIntent.FLAG_IMMUTABLE);
    }

    private View showDot() {
        if (!Access.drawsOver(this)) return null;
        View view = new View(windowContext);
        WindowManager.LayoutParams params = new WindowManager.LayoutParams(
                1, 1,
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE,
                PixelFormat.TRANSLUCENT);
        params.gravity = Gravity.TOP | Gravity.START;
        try {
            windows.addView(view, params);
            return view;
        } catch (RuntimeException e) {
            Log.w(TAG, "could not show the dot", e);
            return null;
        }
    }

    private void hideDot() {
        if (dot == null) return;
        try {
            windows.removeView(dot);
        } catch (RuntimeException ignored) {
            // Already gone.
        }
        dot = null;
    }

    /** Checks straight away which app is in front, and carries on checking from there. */
    private void lookNow() {
        if (!looking) return;
        main.removeCallbacks(look);
        main.post(look);
    }

    /** Reads what has been opened since the last look, and acts on the most recent. */
    private void look() {
        if (!power.isInteractive()) {
            // Nothing can be opened while the screen is off.
            main.postDelayed(look, SCREEN_OFF_EVERY_MS);
            return;
        }
        main.postDelayed(look, LOOK_EVERY_MS);
        Status.checkedAt = SystemClock.elapsedRealtime();
        long now = System.currentTimeMillis();
        if (lastSeen > now) lastSeen = now - LOOK_BACK_MS;   // the phone's clock has been put back
        // Read from a little before the last look, so that nothing is missed if this one is late.
        UsageEvents events = usage.queryEvents(Math.min(lastLook, now) - LOOK_BACK_MS, now + 1000);
        lastLook = now;
        UsageEvents.Event event = new UsageEvents.Event();
        Set<String> list = null;
        Set<String> notPlaces = null;
        String latest = null;      // the newest place to come to the front
        long latestAt = 0;
        String passing = null;     // the newest screen put up in passing, see isPlace
        long passingAt = 0;
        long newest = lastSeen;
        while (events.hasNextEvent()) {
            events.getNextEvent(event);
            if (event.getEventType() != UsageEvents.Event.ACTIVITY_RESUMED) continue;
            long at = event.getTimeStamp();
            if (at <= lastSeen) continue;   // already acted on
            newest = Math.max(newest, at);
            String app = event.getPackageName();
            if (list == null) {
                list = prefs.apps();
                notPlaces = new HashSet<>();
            }
            boolean place = !notPlaces.contains(app)
                    && (app.equals(getPackageName()) || list.contains(app) || isPlace(app));
            if (place) {
                if (at >= latestAt) {
                    latest = app;
                    latestAt = at;
                }
            } else {
                notPlaces.add(app);
                if (at >= passingAt) {
                    passing = app;
                    passingAt = at;
                }
            }
        }
        lastSeen = newest;
        if (latest != null) cameToFront(latest, latestAt, list.contains(latest));
        // A sign-in page or a permission question on top of an app does not mean they
        // have left it, so it is only noted, for the app's screen to show.
        if (passing != null && passingAt > latestAt) Status.noticed(passing, false, passingAt);
        if (latest == null && letIn != null && prefs.breakLeftMs() == 0) {
            // Their break has run out. If the app they were let into is still in front, it is time.
            String app = letIn;
            letIn = null;
            if (app.equals(inFront)) cameToFront(app, now, prefs.apps().contains(app));
        }
    }

    /**
     * @param at when it came to the front
     * @param listed whether it is one of the apps he closes
     */
    private void cameToFront(String app, long at, boolean listed) {
        // Only written when someone has asked for it with: adb shell setprop log.tag.ScrollBouncer DEBUG
        if (Log.isLoggable(TAG, Log.DEBUG)) Log.d(TAG, "in front: " + app);
        if (!app.equals(getPackageName())) Status.noticed(app, listed, at);
        inFront = app;
        letIn = null;
        if (performing) {
            if (dark) {
                if (!app.equals(target)) wentElsewhere = true;
                return;
            }
            if (app.equals(target)) return;
            // They have gone somewhere else themselves before he got there, so he has
            // nothing left to close. Where they have gone may be on his list too, though.
            callOff();
        }
        if (!listed || !prefs.enabled()) return;
        if (prefs.breakLeftMs() > 0) {
            letIn = app;
            return;
        }
        if (app.equals(lastTarget) && SystemClock.uptimeMillis() < restUntil) return;
        if (!Access.drawsOver(this)) {
            Status.problem(this, getString(R.string.problem_no_overlay));
            return;
        }
        Log.i(TAG, "an app on his list has been opened");
        sendFor(app);
    }

    /**
     * Whether this is somewhere a person goes on purpose: an app with an icon to
     * open it, or the home screen. Android and other apps also put up screens of
     * their own in passing, which are not.
     */
    private boolean isPlace(String app) {
        if (places.contains(app)) return true;
        PackageManager packages = getPackageManager();
        boolean place = packages.getLaunchIntentForPackage(app) != null;
        if (!place) {
            Intent home = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME);
            for (ResolveInfo info : packages.queryIntentActivities(home, 0)) {
                if (app.equals(info.activityInfo.packageName)) place = true;
            }
        }
        // Only remembered when true: an app can gain an icon later, and looking again is cheap.
        if (place) places.add(app);
        return place;
    }

    /** Sends for him to come and close this app, and listens for how it goes. */
    private void sendFor(String app) {
        int mine = ++turn;
        ResultReceiver cues = new ResultReceiver(main) {
            @Override
            protected void onReceiveResult(int what, Bundle more) {
                // A cue can arrive a moment after its performance has been called off.
                if (mine == turn && performing) cue(what, more == null ? null : more.getString(StageService.WHY));
            }
        };
        try {
            StageService.ask(this, StageService.ENTER, cues);
        } catch (RuntimeException e) {
            Log.w(TAG, "could not send for him", e);
            Status.problem(this, getString(R.string.problem_no_stage, e));
            closeWithoutHim(app);
            return;
        }
        performing = true;
        target = app;
        onStage = false;
        dark = false;
        wentElsewhere = false;
        main.postDelayed(giveUp, SHOW_UP_MS);
    }

    /** How his performance is going, as told by the service that draws him. */
    private void cue(int what, String why) {
        switch (what) {
            case StageService.ON:
                onStage = true;
                Status.wentOnAt = System.currentTimeMillis();
                main.removeCallbacks(giveUp);
                main.postDelayed(giveUp, widthDp() * WALK_MS_PER_DP + GET_GOING_MS);
                break;
            case StageService.DARK:
                dark = true;
                prefs.countClose();
                if (why != null) Status.problem(this, getString(R.string.problem_no_home, why));
                main.removeCallbacks(giveUp);
                main.postDelayed(giveUp, ENDING_MS);
                break;
            case StageService.DONE:
                if (dark && !wentElsewhere) {
                    // Nothing else has come to the front, so the app he came to close is still there.
                    Status.problem(this, getString(R.string.problem_still_open));
                }
                rest();
                break;
            case StageService.FAILED: {
                String app = target;
                Status.problem(this, getString(R.string.problem_no_stage, why));
                rest();
                closeWithoutHim(app);
                break;
            }
            default:
                break;
        }
    }

    /** It has taken far longer than his routine does, so something has gone wrong with it. */
    private void giveUp() {
        if (!performing) return;
        if (dark) {
            Status.problem(this, getString(R.string.problem_no_end));
            callOff();
        } else {
            String app = target;
            Status.problem(this, getString(onStage ? R.string.problem_too_slow : R.string.problem_no_show));
            callOff();
            closeWithoutHim(app);
        }
    }

    /** For when he cannot be shown: the app is closed all the same, with a word to say why. */
    private void closeWithoutHim(String app) {
        prefs.countClose();
        Intent home = new Intent(Intent.ACTION_MAIN)
                .addCategory(Intent.CATEGORY_HOME)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            startActivity(home);
        } catch (RuntimeException e) {
            Log.w(TAG, "could not go to the home screen", e);
            Status.problem(this, getString(R.string.problem_no_home, e));
        }
        Toast.makeText(this, R.string.nope, Toast.LENGTH_SHORT).show();
        lastTarget = app;
        restUntil = SystemClock.uptimeMillis() + REST_MS;
        Log.i(TAG, "closed without him");
    }

    /** Takes him off screen, if he has been sent for. */
    private void callOff() {
        if (!performing) return;
        try {
            StageService.ask(this, StageService.LEAVE, null);
        } catch (RuntimeException e) {
            // Then the service that draws him is not running, and nor is he.
            Log.w(TAG, "could not call him off", e);
        }
        rest();
    }

    /** His performance is over, one way or another. */
    private void rest() {
        main.removeCallbacks(giveUp);
        performing = false;
        lastTarget = target;
        restUntil = SystemClock.uptimeMillis() + REST_MS;
    }

    /** A context that is allowed to put a window over other apps. */
    private Context windowContext() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return this;
        Display display = getSystemService(DisplayManager.class).getDisplay(Display.DEFAULT_DISPLAY);
        return createDisplayContext(display)
                .createWindowContext(WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY, null);
    }

    private int widthDp() {
        float density = getResources().getDisplayMetrics().density;
        int px = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
                ? windows.getCurrentWindowMetrics().getBounds().width()
                : getResources().getDisplayMetrics().widthPixels;
        return Math.round(px / density);
    }
}
