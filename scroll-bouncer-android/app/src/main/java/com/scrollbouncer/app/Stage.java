package com.scrollbouncer.app;

import android.annotation.SuppressLint;
import android.content.Context;
import android.graphics.Color;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.webkit.JavascriptInterface;
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

    private Stage() {
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
