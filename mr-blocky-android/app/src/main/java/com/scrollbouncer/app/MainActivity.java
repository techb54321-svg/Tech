package com.scrollbouncer.app;

import android.Manifest;
import android.app.Activity;
import android.app.ActivityManager;
import android.app.NotificationManager;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.drawable.Drawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.os.SystemClock;
import android.provider.Settings;
import android.text.format.DateUtils;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.Switch;
import android.widget.TextView;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** The one screen: turn him on, choose the apps he closes, take a break, see the count. */
public class MainActivity extends Activity {
    private final Handler main = new Handler(Looper.getMainLooper());
    private final Runnable everySecond = new Runnable() {
        @Override
        public void run() {
            refresh();
            main.postDelayed(this, 1000);
        }
    };
    private Prefs prefs;
    private Boolean onDuty;   // whether the watching service was last told to run; null before the first check
    private List<Status.Note> recentStops = new ArrayList<>();   // read each time the screen is opened

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        prefs = new Prefs(this);
        setContentView(R.layout.main);

        Switch enabled = findViewById(R.id.enabled);
        enabled.setChecked(prefs.enabled());
        enabled.setOnCheckedChangeListener((view, on) -> {
            prefs.setEnabled(on);
            refresh();
        });

        Uri me = Uri.fromParts("package", getPackageName(), null);
        findViewById(R.id.open_usage).setOnClickListener(view ->
                openSettings(Settings.ACTION_USAGE_ACCESS_SETTINGS, me));
        findViewById(R.id.open_overlay).setOnClickListener(view ->
                openSettings(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, me));
        findViewById(R.id.open_app_info).setOnClickListener(view ->
                startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                        Uri.fromParts("package", getPackageName(), null))));
        findViewById(R.id.open_battery).setOnClickListener(view -> askToKeepRunning(me));
        findViewById(R.id.take_break).setOnClickListener(view -> {
            if (prefs.breakLeftMs() > 0) prefs.endBreak(); else prefs.startBreak();
            refresh();
        });
        findViewById(R.id.preview).setOnClickListener(view ->
                startActivity(new Intent(this, PreviewActivity.class)));

        Switch deals = findViewById(R.id.dance_deals);
        deals.setChecked(prefs.danceDeals());
        deals.setOnCheckedChangeListener((view, on) -> prefs.setDanceDeals(on));
        findViewById(R.id.dance_next).setOnClickListener(view -> {
            prefs.setDanceNext(!prefs.danceNext());
            refresh();
        });
        findViewById(R.id.dance_try).setOnClickListener(view ->
                startActivity(new Intent(this, PreviewActivity.class).putExtra(PreviewActivity.DEAL, true)));

        listApps();

        // Android wants a notification while he is on duty, and from Android 13 that needs asking for.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            requestPermissions(new String[] {Manifest.permission.POST_NOTIFICATIONS}, 0);
        }
    }

    /**
     * Opens the app's page in Android's settings, where its battery use can be set to
     * Unrestricted. Only offered once the phone has stopped him, since he cannot do his
     * job if he is not left running. (Asking Android directly needs a permission that
     * Google Play only allows for a few kinds of app.)
     */
    private void askToKeepRunning(Uri me) {
        openSettings(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, me);
    }

    /** Opens one of Android's settings screens, straight at this app where the phone allows it. */
    private void openSettings(String screen, Uri me) {
        try {
            startActivity(new Intent(screen, me));
        } catch (ActivityNotFoundException e) {
            startActivity(new Intent(screen));
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        recentStops = Status.recentStops(this);
        main.post(everySecond);
    }

    @Override
    protected void onPause() {
        main.removeCallbacks(everySecond);
        super.onPause();
    }

    /** Brings the parts of the screen that change by themselves up to date. */
    private void refresh() {
        boolean seesApps = Access.seesApps(this);
        boolean drawsOver = Access.drawsOver(this);
        findViewById(R.id.need_usage).setVisibility(seesApps ? View.GONE : View.VISIBLE);
        findViewById(R.id.need_overlay).setVisibility(drawsOver ? View.GONE : View.VISIBLE);
        findViewById(R.id.setup).setVisibility(seesApps && drawsOver ? View.GONE : View.VISIBLE);
        boolean leftAlone = getSystemService(PowerManager.class).isIgnoringBatteryOptimizations(getPackageName());
        findViewById(R.id.keep_running).setVisibility(
                seesApps && drawsOver && !leftAlone && Status.stoppedByPhone(this) ? View.VISIBLE : View.GONE);

        // He is on duty whenever he is switched on and allowed to do his job. If he
        // should be checking and has not for a while, he has been stopped: start him again.
        boolean should = prefs.enabled() && seesApps && drawsOver;
        boolean checking = Status.checkedAt > 0 && SystemClock.elapsedRealtime() - Status.checkedAt < 5000;
        if (onDuty == null || onDuty != should || (should && !checking)) {
            if (onDuty == null || onDuty != should) {
                Log.i("ScrollBouncer", "duty " + should + ": sees apps " + seesApps + ", draws over " + drawsOver);
            }
            onDuty = should;
            if (should) BouncerService.start(this); else BouncerService.stop(this);
        }
        showStatus(seesApps && drawsOver, checking);
        ((Button) findViewById(R.id.dance_next)).setText(prefs.danceNext() ? R.string.deals_next_set : R.string.deals_next);
        ((TextView) findViewById(R.id.closed_today)).setText(String.valueOf(prefs.closedToday()));
        ((TextView) findViewById(R.id.closed_total)).setText(String.valueOf(prefs.closedTotal()));

        long left = prefs.breakLeftMs();
        Button takeBreak = findViewById(R.id.take_break);
        TextView breakNote = findViewById(R.id.break_note);
        if (left > 0) {
            int minutes = (int) Math.ceil(left / 60000.0);
            takeBreak.setText(R.string.end_break);
            breakNote.setText(getResources().getQuantityString(R.plurals.break_left, minutes, minutes));
            breakNote.setVisibility(View.VISIBLE);
        } else {
            takeBreak.setText(R.string.take_break);
            breakNote.setVisibility(View.GONE);
        }
    }

    /** Says whether he is working and, underneath, what he has seen and anything that has gone wrong. */
    private void showStatus(boolean allowed, boolean checking) {
        int headline;
        boolean watching = false;   // whether he is noticing which apps are opened
        boolean closing = false;    // whether he would also close one on his list
        if (!prefs.enabled()) {
            headline = R.string.status_off;
        } else if (!allowed) {
            headline = R.string.status_needs;
        } else if (prefs.breakLeftMs() > 0) {
            headline = R.string.status_break;
            watching = true;
        } else {
            headline = checking ? R.string.status_on : R.string.status_starting;
            watching = true;
            closing = true;
        }
        show(R.id.status, getString(headline));
        ((TextView) findViewById(R.id.status)).setTextColor(getColor(closing ? R.color.accent : R.color.warning));

        StringBuilder lines = new StringBuilder();
        if (watching) {
            List<Status.Sighting> seen = Status.sightings();
            lines.append(getString(seen.isEmpty() ? R.string.status_none : R.string.status_noticed)).append('\n');
            for (Status.Sighting sighting : seen) {
                lines.append(getString(
                        sighting.onList ? R.string.status_app_listed : R.string.status_app,
                        label(sighting.app), ago(sighting.at))).append('\n');
            }
        }
        if (Status.wentOnAt > 0) {
            lines.append(getString(R.string.status_went_on, ago(Status.wentOnAt))).append('\n');
        }
        Status.Note stopped = Status.stopped(this);
        if (stopped != null) {
            lines.append(getString(R.string.status_stopped, ago(stopped.at), stopped.what)).append('\n');
        }
        Status.Note crash = Status.crash(this);
        if (crash != null) {
            lines.append(getString(R.string.status_crashed, ago(crash.at), crash.what)).append('\n');
        }
        Status.Note problem = Status.problem(this);
        if (problem != null) {
            lines.append(getString(R.string.status_problem, ago(problem.at), problem.what)).append('\n');
        }
        show(R.id.details, lines.toString().trim());

        // The small print: what would help someone work out why he is not turning up.
        StringBuilder trouble = new StringBuilder();
        trouble.append(getString(R.string.trouble_settings,
                onOrOff(Access.seesApps(this)), onOrOff(Access.drawsOver(this)),
                onOrOff(getSystemService(NotificationManager.class).areNotificationsEnabled()),
                onOrOff(!getSystemService(PowerManager.class).isIgnoringBatteryOptimizations(getPackageName()))));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                && getSystemService(ActivityManager.class).isBackgroundRestricted()) {
            trouble.append('\n').append(getString(R.string.trouble_restricted));
        }
        if (!recentStops.isEmpty()) trouble.append('\n').append(getString(R.string.trouble_stops));
        for (Status.Note stop : recentStops) {
            trouble.append('\n').append(getString(R.string.trouble_stop, stop.what, ago(stop.at)));
        }
        trouble.append('\n').append(getString(R.string.status_phone,
                version(), Build.VERSION.RELEASE, Build.MANUFACTURER, Build.MODEL));
        show(R.id.trouble, trouble.toString());
    }

    /** Puts words in a piece of text on the screen, leaving it alone if they are already there. */
    private void show(int id, String words) {
        TextView view = findViewById(id);
        if (!words.contentEquals(view.getText())) view.setText(words);
        view.setVisibility(words.isEmpty() ? View.GONE : View.VISIBLE);
    }

    private String onOrOff(boolean on) {
        return getString(on ? R.string.on : R.string.off);
    }

    private CharSequence ago(long when) {
        long now = System.currentTimeMillis();
        if (now - when < 3000) return getString(R.string.just_now);
        return DateUtils.getRelativeTimeSpanString(when, now, DateUtils.SECOND_IN_MILLIS);
    }

    private String version() {
        try {
            return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
        } catch (PackageManager.NameNotFoundException e) {
            return "";
        }
    }

    /** The name a person knows an app by. */
    private CharSequence label(String app) {
        try {
            PackageManager packages = getPackageManager();
            return packages.getApplicationLabel(packages.getApplicationInfo(app, 0));
        } catch (PackageManager.NameNotFoundException e) {
            return app;
        }
    }

    /** Fills in the list of apps on the phone, with the ones he closes at the top. */
    private void listApps() {
        LinearLayout list = findViewById(R.id.apps);
        new Thread(() -> {
            PackageManager packages = getPackageManager();
            Set<String> chosen = prefs.apps();
            Set<String> seen = new HashSet<>();
            List<App> apps = new ArrayList<>();
            Intent launchable = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER);
            for (ResolveInfo info : packages.queryIntentActivities(launchable, 0)) {
                String name = info.activityInfo.packageName;
                if (name.equals(getPackageName()) || !seen.add(name)) continue;
                apps.add(new App(name, info.loadLabel(packages).toString(), info.loadIcon(packages),
                        chosen.contains(name)));
            }
            apps.sort((a, b) -> a.chosen != b.chosen ? (a.chosen ? -1 : 1) : a.label.compareToIgnoreCase(b.label));
            runOnUiThread(() -> {
                if (isDestroyed()) return;
                list.removeAllViews();
                for (App app : apps) list.addView(row(app));
            });
        }).start();
    }

    private View row(App app) {
        LinearLayout row = new LinearLayout(this);
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.setMinimumHeight(dp(52));

        ImageView icon = new ImageView(this);
        icon.setImageDrawable(app.icon);
        row.addView(icon, new LinearLayout.LayoutParams(dp(36), dp(36)));

        TextView label = new TextView(this);
        label.setText(app.label);
        label.setTextSize(16);
        label.setPadding(dp(14), 0, dp(8), 0);
        row.addView(label, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));

        CheckBox closes = new CheckBox(this);
        closes.setChecked(app.chosen);
        closes.setContentDescription(app.label);
        closes.setOnCheckedChangeListener((view, on) -> prefs.setApp(app.name, on));
        row.addView(closes);

        row.setOnClickListener(view -> closes.toggle());
        return row;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    /** One app on the phone. */
    private static final class App {
        final String name;
        final String label;
        final Drawable icon;
        final boolean chosen;

        App(String name, String label, Drawable icon, boolean chosen) {
            this.name = name;
            this.label = label;
            this.icon = icon;
            this.chosen = chosen;
        }
    }
}
