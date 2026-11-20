package com.scrollbouncer.app;

import android.app.ActivityManager;
import android.app.ApplicationExitInfo;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.SystemClock;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.FileWriter;
import java.io.IOException;
import java.io.Writer;
import java.util.ArrayList;
import java.util.List;

/**
 * Notes on how he is getting on, for the app's own screen to show, so that it
 * is possible to tell whether he is working and, if not, why. The notes stay
 * on the phone.
 */
final class Status {
    /** An app he saw come to the front. */
    static final class Sighting {
        final String app;
        final boolean onList;
        final long at;

        Sighting(String app, boolean onList, long at) {
            this.app = app;
            this.onList = onList;
            this.at = at;
        }
    }

    /** Something worth telling the person about, and when it happened. */
    static final class Note {
        final String what;
        final long at;

        Note(String what, long at) {
            this.what = what;
            this.at = at;
        }
    }

    private static final int SIGHTINGS_KEPT = 3;
    private static final long DAY_MS = 24 * 60 * 60 * 1000;
    /** Android stops the app to put a new version in. Anything this close to that is not news. */
    private static final long UPDATE_MS = 15_000;

    private static final List<Sighting> SIGHTINGS = new ArrayList<>();   // newest first

    /** When he last checked which app is in front, by the clock that counts from start-up. */
    static volatile long checkedAt;
    /** When he last went on screen, or 0 if he has not since the app was started. */
    static volatile long wentOnAt;

    private Status() {
    }

    /** Remembers the last few apps he saw opened, for as long as the app keeps running. */
    static synchronized void noticed(String app, boolean onList, long at) {
        if (!SIGHTINGS.isEmpty() && SIGHTINGS.get(0).app.equals(app)) SIGHTINGS.remove(0);
        SIGHTINGS.add(0, new Sighting(app, onList, at));
        if (SIGHTINGS.size() > SIGHTINGS_KEPT) SIGHTINGS.remove(SIGHTINGS.size() - 1);
    }

    static synchronized List<Sighting> sightings() {
        return new ArrayList<>(SIGHTINGS);
    }

    // The rest is written to the phone's storage, so it is still there if the app is stopped.

    private static SharedPreferences notes(Context context) {
        return context.getApplicationContext().getSharedPreferences("notes", Context.MODE_PRIVATE);
    }

    /** Writes down something that went wrong, in plain words. */
    static void problem(Context context, String what) {
        notes(context).edit().putString("problem", what).putLong("problemAt", System.currentTimeMillis()).apply();
    }

    /**
     * Writes down a crash. It goes in a file of its own, read afresh each time,
     * because the crash may be in the other of the app's two processes.
     */
    static void crashed(Context context, Throwable error) {
        Throwable cause = error;
        while (cause.getCause() != null && cause.getCause() != cause) cause = cause.getCause();
        StringBuilder what = new StringBuilder(String.valueOf(cause));
        for (StackTraceElement frame : cause.getStackTrace()) {
            if (frame.getClassName().startsWith("com.scrollbouncer")) {
                what.append(" at ").append(frame);
                break;
            }
        }
        if (what.length() > 400) what.setLength(400);
        try (Writer file = new FileWriter(crashFile(context))) {
            file.write(System.currentTimeMillis() + "\n" + what);
        } catch (IOException ignored) {
            // Then it goes unrecorded.
        }
    }

    private static File crashFile(Context context) {
        return new File(context.getFilesDir(), "last-crash.txt");
    }

    /** The last thing that went wrong, if it was in the last day. */
    static Note problem(Context context) {
        return note(context, "problem");
    }

    /** The last crash, if it was in the last day. */
    static Note crash(Context context) {
        try (BufferedReader file = new BufferedReader(new FileReader(crashFile(context)))) {
            long at = Long.parseLong(file.readLine());
            String what = file.readLine();
            if (what == null || System.currentTimeMillis() - at > DAY_MS) return null;
            return new Note(what, at);
        } catch (IOException | NumberFormatException e) {
            return null;   // there has not been one
        }
    }

    /** The last time something stopped him while he was on duty, if it was in the last day. */
    static Note stopped(Context context) {
        return note(context, "stopped");
    }

    /** Whether the phone itself has ever stopped him while he was on duty. */
    static boolean stoppedByPhone(Context context) {
        return notes(context).getBoolean("stoppedByPhone", false);
    }

    private static Note note(Context context, String name) {
        SharedPreferences notes = notes(context);
        String what = notes.getString(name, null);
        long at = notes.getLong(name + "At", 0);
        if (what == null || System.currentTimeMillis() - at > DAY_MS) return null;
        return new Note(what, at);
    }

    /**
     * Call when he goes on duty. If he was already meant to be on duty, something
     * stopped him without his being switched off, and this notes what.
     */
    static void onDuty(Context context) {
        SharedPreferences notes = notes(context);
        long now = System.currentTimeMillis();
        long since = notes.getLong("dutyAt", 0);
        SharedPreferences.Editor edit = notes.edit().putLong("dutyAt", now);
        // Restarting the phone stops everything, and is not worth a mention.
        boolean sameStart = since > now - SystemClock.elapsedRealtime();
        if (sameStart) {
            Stop stop = lastStop(context, since);
            if (stop != null) {
                edit.putString("stopped", stop.why).putLong("stoppedAt", stop.at);
                if (stop.byPhone) edit.putBoolean("stoppedByPhone", true);
            }
        }
        edit.apply();
    }

    /** Call when he comes off duty because he was told to. */
    static void offDuty(Context context) {
        notes(context).edit().remove("dutyAt").apply();
    }

    private static final class Stop {
        final String why;
        final long at;
        final boolean byPhone;

        Stop(String why, long at, boolean byPhone) {
            this.why = why;
            this.at = at;
            this.byPhone = byPhone;
        }
    }

    /** What Android says about the last time the app was stopped since then, or null if it was nothing unusual. */
    private static Stop lastStop(Context context, long since) {
        long updated = 0;
        try {
            updated = context.getPackageManager().getPackageInfo(context.getPackageName(), 0).lastUpdateTime;
        } catch (PackageManager.NameNotFoundException ignored) {
            // The app is always installed when its own code is running.
        }
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            // Older phones do not say why, or when. Being updated is the everyday reason.
            if (updated > since) return null;
            return new Stop(context.getString(R.string.stopped_by_phone), System.currentTimeMillis(), true);
        }
        ActivityManager manager = context.getSystemService(ActivityManager.class);
        List<ApplicationExitInfo> exits;
        try {
            exits = manager.getHistoricalProcessExitReasons(null, 0, 16);   // newest first
        } catch (RuntimeException e) {
            return null;
        }
        for (ApplicationExitInfo exit : exits) {
            // The web view runs helpers under other names. Only the app itself matters here.
            if (!context.getPackageName().equals(exit.getProcessName())) continue;
            if (exit.getTimestamp() < since) break;
            if (Math.abs(exit.getTimestamp() - updated) < UPDATE_MS) continue;
            int words = words(exit.getReason());
            if (words == 0) continue;
            String why = context.getString(words);
            // Android's own short note is for whoever is working out what went wrong.
            if (exit.getDescription() != null) why += " (" + exit.getDescription() + ")";
            return new Stop(why, exit.getTimestamp(), words != R.string.stopped_crash && words != R.string.stopped_frozen);
        }
        return null;
    }

    /**
     * The last few times the app closed, newest first, as Android describes them,
     * everyday reasons included. For working out what is happening on a phone.
     */
    static List<Note> recentStops(Context context) {
        List<Note> stops = new ArrayList<>();
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return stops;
        try {
            ActivityManager manager = context.getSystemService(ActivityManager.class);
            String watcher = context.getPackageName();
            for (ApplicationExitInfo exit : manager.getHistoricalProcessExitReasons(null, 0, 16)) {
                int words = words(exit.getReason());
                boolean crashed = words == R.string.stopped_crash || words == R.string.stopped_frozen;
                String what;
                if (watcher.equals(exit.getProcessName())) {
                    what = context.getString(words != 0 ? words : everydayWords(exit.getReason()));
                } else if (crashed && (watcher + ":stage").equals(exit.getProcessName())) {
                    // Android closes the part that draws him whenever it likes, which does no harm. A crash is news.
                    what = context.getString(R.string.stopped_stage, context.getString(words));
                } else {
                    continue;
                }
                if (exit.getDescription() != null) what += " (" + exit.getDescription() + ")";
                stops.add(new Note(what, exit.getTimestamp()));
                if (stops.size() == 4) break;
            }
        } catch (RuntimeException ignored) {
            // Then there is nothing to show.
        }
        return stops;
    }

    private static int everydayWords(int reason) {
        switch (reason) {
            case ApplicationExitInfo.REASON_PACKAGE_UPDATED:
                return R.string.stopped_updated;
            case ApplicationExitInfo.REASON_EXIT_SELF:
                return R.string.stopped_itself;
            case ApplicationExitInfo.REASON_PERMISSION_CHANGE:
                return R.string.stopped_permission;
            default:
                return R.string.stopped_other;
        }
    }

    /** Android's reason for stopping an app, in plain words. 0 for the everyday reasons, such as an update. */
    private static int words(int reason) {
        switch (reason) {
            case ApplicationExitInfo.REASON_LOW_MEMORY:
                return R.string.stopped_memory;
            case ApplicationExitInfo.REASON_EXCESSIVE_RESOURCE_USAGE:
                return R.string.stopped_power;
            case ApplicationExitInfo.REASON_USER_REQUESTED:
                return R.string.stopped_by_hand;
            case ApplicationExitInfo.REASON_CRASH:
            case ApplicationExitInfo.REASON_CRASH_NATIVE:
            case ApplicationExitInfo.REASON_INITIALIZATION_FAILURE:
                return R.string.stopped_crash;
            case ApplicationExitInfo.REASON_ANR:
                return R.string.stopped_frozen;
            case ApplicationExitInfo.REASON_SIGNALED:
            case ApplicationExitInfo.REASON_OTHER:
            case ApplicationExitInfo.REASON_DEPENDENCY_DIED:
            case ApplicationExitInfo.REASON_FREEZER:
                return R.string.stopped_by_phone;
            default:
                return 0;
        }
    }
}
