package com.scrollbouncer.app;

import android.content.Context;
import android.content.SharedPreferences;

import java.text.SimpleDateFormat;
import java.util.Arrays;
import java.util.Date;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

/** What the person has chosen, and how many times he has closed something. */
final class Prefs {
    /** The apps he closes until the person changes the list. */
    static final Set<String> DEFAULT_APPS = new HashSet<>(Arrays.asList(
            "com.instagram.android",      // Instagram
            "com.zhiliaoapp.musically",   // TikTok
            "com.ss.android.ugc.trill",   // TikTok, in some regions
            "com.facebook.katana",        // Facebook
            "com.twitter.android",        // X
            "com.reddit.frontpage",       // Reddit
            "com.instagram.barcelona",    // Threads
            "com.snapchat.android"));     // Snapchat

    private static final long BREAK_MS = 5 * 60 * 1000;
    /** How often he offers the dance deal, and never twice within this long. */
    private static final double DEAL_CHANCE = 0.25;
    private static final long DEAL_GAP_MS = 2 * 60 * 60 * 1000;

    private final SharedPreferences store;

    Prefs(Context context) {
        // The app's old name. Changing it would lose the settings of everyone who has the app already.
        store = context.getApplicationContext().getSharedPreferences("scroll-bouncer", Context.MODE_PRIVATE);
    }

    boolean enabled() {
        return store.getBoolean("enabled", true);
    }

    void setEnabled(boolean on) {
        store.edit().putBoolean("enabled", on).apply();
    }

    Set<String> apps() {
        return new HashSet<>(store.getStringSet("apps", DEFAULT_APPS));
    }

    void setApp(String app, boolean closes) {
        Set<String> apps = apps();
        if (closes) apps.add(app); else apps.remove(app);
        store.edit().putStringSet("apps", apps).apply();
    }

    /** Milliseconds of the five-minute break still to go, or 0 if not on one. */
    long breakLeftMs() {
        return Math.max(0, store.getLong("breakUntil", 0) - System.currentTimeMillis());
    }

    void startBreak() {
        store.edit().putLong("breakUntil", System.currentTimeMillis() + BREAK_MS).apply();
    }

    void endBreak() {
        store.edit().putLong("breakUntil", 0).apply();
    }

    /** Whether he now and then offers to let them in if they dance with him. */
    boolean danceDeals() {
        return store.getBoolean("danceDeals", true);
    }

    void setDanceDeals(boolean on) {
        store.edit().putBoolean("danceDeals", on).apply();
    }

    /** Whether the next app he closes gets the dance deal for certain, for trying it out. */
    boolean danceNext() {
        return store.getBoolean("danceNext", false);
    }

    void setDanceNext(boolean on) {
        store.edit().putBoolean("danceNext", on).apply();
    }

    /**
     * Whether he offers the dance deal this time. It is noted straight away, so the
     * next offer is a while off and opening an app over and over does not pay.
     */
    boolean dealThisTime() {
        long now = System.currentTimeMillis();
        boolean deal = danceNext()
                || (danceDeals() && now - store.getLong("dealAt", 0) > DEAL_GAP_MS && Math.random() < DEAL_CHANCE);
        if (deal) store.edit().putBoolean("danceNext", false).putLong("dealAt", now).apply();
        return deal;
    }

    /** Whether he should go after this app right now. */
    boolean closes(String app) {
        return enabled() && breakLeftMs() == 0 && apps().contains(app);
    }

    void countClose() {
        store.edit()
                .putString("day", today())
                .putInt("today", closedToday() + 1)
                .putInt("total", closedTotal() + 1)
                .apply();
    }

    int closedToday() {
        return today().equals(store.getString("day", "")) ? store.getInt("today", 0) : 0;
    }

    int closedTotal() {
        return store.getInt("total", 0);
    }

    private static String today() {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
    }
}
