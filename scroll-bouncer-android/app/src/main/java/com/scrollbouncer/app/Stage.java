package com.scrollbouncer.app;

import android.annotation.SuppressLint;
import android.content.Context;
import android.graphics.Color;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;

/**
 * The see-through page the little guy performs on. He is drawn by the same
 * JavaScript as in the browser extension, so he looks and moves the same.
 */
final class Stage {
    /** Told as the performance goes along. Both arrive on the main thread. */
    interface Cues {
        /** The screen has just gone fully dark. */
        void dark();

        /** He has finished and faded away. */
        void done();
    }

    private static final String TAG = "ScrollBouncer";
    private static final Handler MAIN = new Handler(Looper.getMainLooper());
    private static boolean preparing;
    private static int screensOpen;   // how many of the app's own screens are showing

    private Stage() {
    }

    /**
     * Gets the phone's web view loaded before he is first needed, because the
     * first load is slow. Most of it happens on a background thread. The last
     * part has to run on the main thread and would freeze the app's own screen
     * if that were open, so it waits until it is not.
     */
    static void prepare(Context context) {
        if (preparing) return;
        preparing = true;
        Context app = context.getApplicationContext();
        new Thread(() -> {
            try {
                WebSettings.getDefaultUserAgent(app);
            } catch (RuntimeException e) {
                Log.w(TAG, "could not load the web view", e);
                Status.problem(app, app.getString(R.string.problem_no_web_view, e));
            }
            MAIN.post(() -> finishPreparing(app));
        }, "web-view-loader").start();
    }

    private static void finishPreparing(Context app) {
        if (screensOpen > 0) {
            MAIN.postDelayed(() -> finishPreparing(app), 1500);
            return;
        }
        try {
            new WebView(app).destroy();
            Log.i(TAG, "web view ready");
        } catch (RuntimeException e) {
            Log.w(TAG, "could not start the web view", e);
            Status.problem(app, app.getString(R.string.problem_no_web_view, e));
        }
    }

    /** One of the app's own screens has come into view. Call on the main thread. */
    static void screenOpened() {
        screensOpen++;
    }

    /** One of the app's own screens has gone out of view. Call on the main thread. */
    static void screenClosed() {
        screensOpen--;
    }

    /**
     * Starts a performance and returns the view to put on screen.
     *
     * @param topDp where the status bar ends, so he walks just underneath it
     */
    @SuppressLint("SetJavaScriptEnabled") // It only ever loads the page shipped inside the app.
    static WebView open(Context context, int topDp, Cues cues) {
        WebView web = new WebView(context);
        web.setBackgroundColor(Color.TRANSPARENT);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.getSettings().setJavaScriptEnabled(true);
        web.addJavascriptInterface(new Bridge(cues), "Android");
        web.loadUrl("file:///android_asset/bouncer.html#" + topDp);
        return web;
    }

    /** What the page can call. It hands each cue over to the main thread. */
    public static final class Bridge {
        private final Handler main = new Handler(Looper.getMainLooper());
        private final Cues cues;

        Bridge(Cues cues) {
            this.cues = cues;
        }

        @JavascriptInterface
        public void dark() {
            main.post(cues::dark);
        }

        @JavascriptInterface
        public void done() {
            main.post(cues::done);
        }
    }
}
