package com.scrollbouncer.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Puts him back on duty when the phone has been restarted, or the app updated. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String what = intent.getAction();
        if (!Intent.ACTION_BOOT_COMPLETED.equals(what) && !Intent.ACTION_MY_PACKAGE_REPLACED.equals(what)) return;
        if (new Prefs(context).enabled() && Access.ready(context)) BouncerService.start(context);
    }
}
