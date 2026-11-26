package ch.duartesantos.opengym;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.widget.RemoteViews;

/**
 * A stop action for the cardio count-up clock (store/useCardioClock.js). The page starts this
 * while a cardio set is being timed. The action stays on the Lock Screen even when the app is
 * gone: tapping Stop writes the stop instant to a tiny preference and updates the notification,
 * and the page reads it when it comes back and writes the minutes to the row.
 *
 * No foreground service: the notification is ongoing, the stop is one broadcast, and the page
 * already keeps the run across a reload. The preference is device-only and is cleared by the
 * page once it has consumed the stop.
 */
final class CardioTimer {
    private static final String PREFS = "opengym_cardio_timer";
    private static final String STARTED = "startedAt";
    private static final String STOPPED = "stopAt";
    private static final String LABEL = "label";
    private static final int NOTIFICATION_ID = 3100;
    private static final String CHANNEL_ID = "cardio-timer-v2";
    static final String ACTION_STOP = "ch.duartesantos.opengym.cardio.STOP";
    private static final int FLAGS = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static void channel(Context ctx) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm.getNotificationChannel(CHANNEL_ID) != null) return;
        NotificationChannel ch = new NotificationChannel(CHANNEL_ID, "Cardio timer", NotificationManager.IMPORTANCE_DEFAULT);
        ch.setDescription("Stop a running cardio set from the Lock Screen");
        ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        ch.setSound(null, null);
        ch.enableVibration(false);
        nm.createNotificationChannel(ch);
    }

    private static PendingIntent open(Context ctx) {
        Intent i = new Intent(ctx, MainActivity.class);
        i.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(ctx, NOTIFICATION_ID + 1, i, FLAGS);
    }

    private static PendingIntent stop(Context ctx) {
        Intent i = new Intent(ctx, CardioTimerReceiver.class);
        i.setAction(ACTION_STOP);
        return PendingIntent.getBroadcast(ctx, NOTIFICATION_ID + 2, i, FLAGS);
    }

    @SuppressWarnings("deprecation")
    private static void post(Context ctx, long startedAt, String label, long stopAt) {
        channel(ctx);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26
                ? new Notification.Builder(ctx, CHANNEL_ID)
                : new Notification.Builder(ctx);
        String text = stopAt > 0
                ? ctx.getString(R.string.cardio_timer_stopped_at, java.text.DateFormat.getTimeInstance(java.text.DateFormat.SHORT).format(new java.util.Date(stopAt)))
                : (label == null || label.isEmpty() ? ctx.getString(R.string.cardio_timer_running) : label);
        b.setSmallIcon(R.drawable.ic_stat_dumbbell)
                .setContentTitle(stopAt > 0 ? ctx.getString(R.string.cardio_timer_stopped) : ctx.getString(R.string.cardio_timer_title))
                .setContentText(text)
                .setShowWhen(stopAt <= 0)
                .setWhen(stopAt > 0 ? stopAt : startedAt)
                .setOngoing(stopAt <= 0)
                .setAutoCancel(stopAt > 0)
                .setCategory(Notification.CATEGORY_PROGRESS)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setContentIntent(open(ctx));

        // A custom content view: some OEM lock screens (MIUI here) hid the standard notification
        // action on a low-importance ongoing card. The button is part of the card itself, so it
        // is visible wherever the card is.
        RemoteViews rv = new RemoteViews(ctx.getPackageName(), R.layout.cardio_timer_notification);
        rv.setTextViewText(R.id.cardio_title, stopAt > 0 ? ctx.getString(R.string.cardio_timer_stopped) : ctx.getString(R.string.cardio_timer_title));
        if (stopAt <= 0) {
            // The system chronometer ticks on the Lock Screen without the page having to post
            // every second. Its base is elapsedRealtime, not the wall-clock start.
            long base = android.os.SystemClock.elapsedRealtime() - Math.max(0, System.currentTimeMillis() - startedAt);
            rv.setChronometer(R.id.cardio_elapsed, base, null, true);
            rv.setViewVisibility(R.id.cardio_elapsed, android.view.View.VISIBLE);
        } else {
            rv.setViewVisibility(R.id.cardio_elapsed, android.view.View.GONE);
        }
        rv.setViewVisibility(R.id.cardio_stop, stopAt > 0 ? android.view.View.GONE : android.view.View.VISIBLE);
        if (stopAt <= 0) rv.setOnClickPendingIntent(R.id.cardio_stop, stop(ctx));
        if (Build.VERSION.SDK_INT >= 24) {
            b.setCustomContentView(rv);
            b.setCustomBigContentView(rv);
        }
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        nm.notify(NOTIFICATION_ID, b.build());
    }

    static void start(Context ctx, long startedAt, String label) {
        prefs(ctx).edit().putLong(STARTED, startedAt).putString(LABEL, label == null ? "" : label).remove(STOPPED).apply();
        post(ctx, startedAt, label, 0);
    }

    static void recordStop(Context ctx) {
        long startedAt = prefs(ctx).getLong(STARTED, 0);
        if (startedAt <= 0) return;
        long stopAt = System.currentTimeMillis();
        prefs(ctx).edit().putLong(STOPPED, stopAt).apply();
        post(ctx, startedAt, prefs(ctx).getString(LABEL, ""), stopAt);
    }

    static long startedAt(Context ctx) { return prefs(ctx).getLong(STARTED, 0); }
    static long stopAt(Context ctx) { return prefs(ctx).getLong(STOPPED, 0); }
    static String label(Context ctx) { return prefs(ctx).getString(LABEL, ""); }

    static void consume(Context ctx) { prefs(ctx).edit().remove(STOPPED).apply(); }

    static void clear(Context ctx) {
        prefs(ctx).edit().clear().apply();
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        nm.cancel(NOTIFICATION_ID);
    }

    private CardioTimer() { }
}
