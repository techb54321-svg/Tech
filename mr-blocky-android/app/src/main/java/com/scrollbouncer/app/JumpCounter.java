package com.scrollbouncer.app;

import android.content.Context;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.SystemClock;

/**
 * Counts star jumps with the phone's motion sensor, so the dance deal can tell
 * they are really jumping. Each jump is a moment of near weightlessness in the
 * air followed by the jolt of landing. It needs no permission.
 */
final class JumpCounter implements SensorEventListener {
    private static final float AIR = 5.5f;       // metres per second squared: falling, or in the air
    private static final float LANDING = 15f;    // a landing, or a push off the ground
    private static final long GAP_MS = 350;      // two jumps are never closer together than this

    private final SensorManager sensors;
    private final Sensor motion;
    private final Runnable onJump;
    private boolean listening;
    private boolean inAir;
    private long last;

    static boolean available(Context context) {
        SensorManager sensors = context.getSystemService(SensorManager.class);
        return sensors != null && sensors.getDefaultSensor(Sensor.TYPE_ACCELEROMETER) != null;
    }

    JumpCounter(Context context, Runnable onJump) {
        sensors = context.getSystemService(SensorManager.class);
        motion = sensors.getDefaultSensor(Sensor.TYPE_ACCELEROMETER);
        this.onJump = onJump;
    }

    void start() {
        if (listening) return;
        listening = true;
        inAir = false;
        sensors.registerListener(this, motion, SensorManager.SENSOR_DELAY_GAME);
    }

    void stop() {
        if (!listening) return;
        listening = false;
        sensors.unregisterListener(this);
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        float x = event.values[0], y = event.values[1], z = event.values[2];
        double pull = Math.sqrt(x * x + y * y + z * z);
        if (pull < AIR) {
            inAir = true;
        } else if (pull > LANDING && inAir) {
            long now = SystemClock.uptimeMillis();
            if (now - last >= GAP_MS) {
                last = now;
                inAir = false;
                onJump.run();
            }
        }
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
    }
}
