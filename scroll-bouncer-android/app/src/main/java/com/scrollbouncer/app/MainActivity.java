package com.scrollbouncer.app;

import android.Manifest;
import android.app.Activity;
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
import android.provider.Settings;
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
        findViewById(R.id.take_break).setOnClickListener(view -> {
            if (prefs.breakLeftMs() > 0) prefs.endBreak(); else prefs.startBreak();
            refresh();
        });
        findViewById(R.id.preview).setOnClickListener(view ->
                startActivity(new Intent(this, PreviewActivity.class)));

        listApps();

        // Android wants a notification while he is on duty, and from Android 13 that needs asking for.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            requestPermissions(new String[] {Manifest.permission.POST_NOTIFICATIONS}, 0);
        }
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
    protected void onStart() {
        super.onStart();
        Stage.screenOpened();
    }

    @Override
    protected void onStop() {
        Stage.screenClosed();
        super.onStop();
    }

    @Override
    protected void onResume() {
        super.onResume();
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

        // He is on duty whenever he is switched on and allowed to do his job.
        boolean should = prefs.enabled() && seesApps && drawsOver;
        if (onDuty == null || onDuty != should) {
            onDuty = should;
            Log.i("ScrollBouncer", "duty " + should + ": sees apps " + seesApps + ", draws over " + drawsOver);
            if (should) BouncerService.start(this); else BouncerService.stop(this);
        }
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
