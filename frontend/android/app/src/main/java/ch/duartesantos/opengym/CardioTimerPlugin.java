package ch.duartesantos.opengym;

import android.content.Context;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** The page's side of the cardio Lock Screen stop action. See CardioTimer.java. */
@CapacitorPlugin(name = "CardioTimer")
public class CardioTimerPlugin extends Plugin {
    @PluginMethod
    public void start(PluginCall call) {
        Context ctx = getContext();
        Long startedAt = call.getLong("startedAt");
        if (ctx == null || startedAt == null || startedAt <= 0) {
            call.reject("startedAt is required");
            return;
        }
        CardioTimer.start(ctx, startedAt, call.getString("label", ""));
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        Context ctx = getContext();
        if (ctx != null) CardioTimer.clear(ctx);
        call.resolve();
    }

    /** The stop tapped on the Lock Screen, if any. Consuming also takes the notification away. */
    @PluginMethod
    public void consumeStop(PluginCall call) {
        Context ctx = getContext();
        JSObject out = new JSObject();
        if (ctx != null) {
            long startedAt = CardioTimer.startedAt(ctx), stopAt = CardioTimer.stopAt(ctx);
            if (stopAt > 0) {
                out.put("startedAt", startedAt);
                out.put("stopAt", stopAt);
                out.put("label", CardioTimer.label(ctx));
                CardioTimer.clear(ctx);
            }
        }
        call.resolve(out);
    }
}
