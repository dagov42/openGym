package ch.duartesantos.opengym;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** The Lock Screen Stop action for a running cardio set. It records the instant and does not
 *  open the app; the page applies it when it next comes to the foreground. */
public class CardioTimerReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent != null && CardioTimer.ACTION_STOP.equals(intent.getAction())) CardioTimer.recordStop(context);
    }
}
