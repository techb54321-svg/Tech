package com.scrollbouncer.app;

import android.annotation.SuppressLint;
import android.content.Context;
import android.graphics.Color;
import android.net.Uri;
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
    /** Told as the performance goes along. All arrive on the main thread. */
    interface Cues {
        /** The screen has just gone fully dark. */
        void dark();

        /** He has finished and faded away. */
        void done();

        /** They said yes to the dance deal. */
        default void dancing() {
        }

        /** They danced to the end, and he is booping the way back in. */
        default void letIn() {
        }
    }

    private Stage() {
    }

    /**
     * Starts a performance and returns the view to put on screen.
     *
     * @param topDp where the status bar ends, so he walks just underneath it
     * @param deal  whether he offers the dance deal after "Nope not now"
     * @param line  what he says, or null for "Nope not now"
     */
    @SuppressLint("SetJavaScriptEnabled") // It only ever loads the page shipped inside the app.
    static WebView open(Context context, int topDp, Cues cues, boolean deal, String line) {
        WebView web = new WebView(context);
        web.setBackgroundColor(Color.TRANSPARENT);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.getSettings().setJavaScriptEnabled(true);
        // The dance music starts a moment after the tap on "Let's dance!", once it has loaded.
        web.getSettings().setMediaPlaybackRequiresUserGesture(false);
        web.addJavascriptInterface(new Bridge(context, web, cues), "Android");
        Uri.Builder hash = new Uri.Builder().appendQueryParameter("top", String.valueOf(topDp));
        if (deal) hash.appendQueryParameter("deal", "1");
        if (line != null) hash.appendQueryParameter("line", line);
        web.loadUrl("file:///android_asset/bouncer.html#" + hash.build().getEncodedQuery());
        return web;
    }

    /** What the page can call. It hands each cue over to the main thread. */
    public static final class Bridge {
        private final Handler main = new Handler(Looper.getMainLooper());
        private final Cues cues;
        private final MoveCounter moves;

        Bridge(Context context, WebView web, Cues cues) {
            this.cues = cues;
            moves = MoveCounter.available(context)
                    ? new MoveCounter(context, () -> web.evaluateJavascript("window.mrBlockyMove && window.mrBlockyMove()", null))
                    : null;
            // However the page ends, stop listening to the sensor once it is off screen.
            web.addOnAttachStateChangeListener(new View.OnAttachStateChangeListener() {
                @Override
                public void onViewAttachedToWindow(View view) {
                }

                @Override
                public void onViewDetachedFromWindow(View view) {
                    if (moves != null) moves.stop();
                }
            });
        }

        @JavascriptInterface
        public void dark() {
            main.post(cues::dark);
        }

        @JavascriptInterface
        public void done() {
            main.post(cues::done);
        }

        @JavascriptInterface
        public void dancing() {
            main.post(cues::dancing);
        }

        @JavascriptInterface
        public void letIn() {
            main.post(cues::letIn);
        }

        /** Whether the phone can feel the exercises being done. */
        @JavascriptInterface
        public boolean hasMotion() {
            return moves != null;
        }

        /**
         * Starts counting one kind of exercise ("jump", "squat" or "knee"), or stops counting.
         * Each one counted calls window.mrBlockyMove() in the page.
         */
        @JavascriptInterface
        public void countMoves(String kind, boolean on) {
            if (moves == null) return;
            main.post(on ? () -> moves.start(kind) : moves::stop);
        }
    }
}
