package com.scrollbouncer.app;

import android.content.Context;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.SystemClock;

/**
 * Counts the exercises in the dance deal with the phone's motion sensor, so he can tell
 * they are really doing them. Held in the hand, each star jump or step of knees up feels
 * the same way to the phone: a moment of feeling lighter, going up into the air, and then
 * a moment of feeling heavier, landing. What changes is how much lighter and heavier, and
 * how quickly they come round. It needs no permission.
 */
final class MoveCounter implements SensorEventListener {
    /** An exercise, as the sensor feels it. Still, it feels 9.8 metres per second squared. */
    private enum Move {
        // Lighter than `light`, then heavier than `heavy`, in metres per second squared;
        // and two of them are never closer together than `gapMs`.
        JUMP("jump", 5.5f, 15f, 350),  // up in the air, then the jolt of landing
        KNEE("knee", 8f, 11.8f, 220);   // a little hop up on every step, then landing

        final String kind;
        final float light, heavy;
        final long gapMs;

        Move(String kind, float light, float heavy, long gapMs) {
            this.kind = kind;
            this.light = light;
            this.heavy = heavy;
            this.gapMs = gapMs;
        }

        static Move of(String kind) {
            for (Move move : values()) if (move.kind.equals(kind)) return move;
            return null;
        }
    }

    private final SensorManager sensors;
    private final Sensor motion;
    private final Runnable onCount;
    private Move counting;
    private boolean lighter;
    private long last;

    static boolean available(Context context) {
        SensorManager sensors = context.getSystemService(SensorManager.class);
        return sensors != null && sensors.getDefaultSensor(Sensor.TYPE_ACCELEROMETER) != null;
    }

    MoveCounter(Context context, Runnable onCount) {
        sensors = context.getSystemService(SensorManager.class);
        motion = sensors.getDefaultSensor(Sensor.TYPE_ACCELEROMETER);
        this.onCount = onCount;
    }

    /** Starts counting one kind of exercise: "jump" or "knee". */
    void start(String kind) {
        Move move = Move.of(kind);
        if (move == null) return;
        if (counting == null) sensors.registerListener(this, motion, SensorManager.SENSOR_DELAY_GAME);
        counting = move;
        lighter = false;
        last = 0;
    }

    void stop() {
        if (counting == null) return;
        counting = null;
        sensors.unregisterListener(this);
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        Move move = counting;
        if (move == null) return;
        float x = event.values[0], y = event.values[1], z = event.values[2];
        double pull = Math.sqrt(x * x + y * y + z * z);
        if (pull < move.light) {
            lighter = true;
        } else if (pull > move.heavy && lighter) {
            long now = SystemClock.uptimeMillis();
            if (now - last >= move.gapMs) {
                last = now;
                lighter = false;
                onCount.run();
            }
        }
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
    }
}
