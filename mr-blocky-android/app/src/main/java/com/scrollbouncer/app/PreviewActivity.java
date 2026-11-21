package com.scrollbouncer.app;

import android.app.Activity;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.webkit.WebView;
import android.widget.FrameLayout;

/** Plays his routine inside the app, so it can be seen without opening anything he closes. */
public class PreviewActivity extends Activity implements Stage.Cues {
    /** Set to true to try the dance deal as well. */
    static final String DEAL = "deal";

    private WebView stage;

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        setContentView(R.layout.preview);
        FrameLayout frame = findViewById(R.id.frame);
        // Wait until the screen is laid out, to know whether it runs under the status bar.
        frame.post(() -> {
            if (isDestroyed()) return;
            stage = Stage.open(this, topInsetDp(frame), this, getIntent().getBooleanExtra(DEAL, false), null);
            frame.addView(stage, new FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        });
    }

    /** Nothing is really being closed here. */
    @Override
    public void dark() {
    }

    /** They will be jumping about, not touching the screen: keep it from going to sleep. */
    @Override
    public void dancing() {
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }

    @Override
    public void done() {
        finish();
    }

    @Override
    protected void onDestroy() {
        if (stage != null) stage.destroy();
        super.onDestroy();
    }

    /** How far the status bar overlaps the top of this screen, if at all. */
    @SuppressWarnings("deprecation") // getStableInsetTop is the only way to ask before Android 11.
    private int topInsetDp(FrameLayout frame) {
        int[] corner = new int[2];
        frame.getLocationOnScreen(corner);
        WindowInsets insets = frame.getRootWindowInsets();
        if (corner[1] > 0 || insets == null) return 0;
        int px;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            px = insets.getInsetsIgnoringVisibility(
                    WindowInsets.Type.statusBars() | WindowInsets.Type.displayCutout()).top;
        } else {
            px = insets.getStableInsetTop();
        }
        return Math.round(px / getResources().getDisplayMetrics().density);
    }
}
