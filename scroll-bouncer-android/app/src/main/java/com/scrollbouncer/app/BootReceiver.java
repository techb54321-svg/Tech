package com.scrollbouncer.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Puts him back on duty when the phone has been restarted. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) return;
        if (new Prefs(context).enabled() && Access.ready(context)) BouncerService.start(context);
    }
}
