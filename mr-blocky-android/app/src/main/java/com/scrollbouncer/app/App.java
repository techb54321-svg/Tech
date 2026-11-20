package com.scrollbouncer.app;

import android.app.Application;

/** Writes down any crash before the app closes, so its screen can say what happened next time. */
public class App extends Application {
    @Override
    public void onCreate() {
        super.onCreate();
        Thread.UncaughtExceptionHandler usual = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((thread, error) -> {
            try {
                Status.crashed(this, error);
            } catch (RuntimeException ignored) {
                // Nothing more can be done about it here.
            }
            // Then let Android deal with the crash as it normally would.
            if (usual != null) usual.uncaughtException(thread, error);
        });
    }
}
