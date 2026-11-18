package ch.duartesantos.opengym;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.Intent;
import android.net.Uri;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * "Save to device" for an export: Android's own create-document dialog (Storage Access
 * Framework), so the person picks the folder and the name. The page writes the file into the
 * app cache first and passes its file URL; this copies it to the place the system dialog
 * returned. No storage permission: the picker grants exactly the chosen file.
 *
 *   const SaveFile = registerPlugin('SaveFile')
 *   await SaveFile.save({ path: 'file:///…/cache/opengym-backup.json',
 *                         filename: 'opengym-backup.json',
 *                         mime: 'application/json' })   // { saved: true } / { cancelled: true }
 */
@CapacitorPlugin(name = "SaveFile")
public class SaveFilePlugin extends Plugin {

    // Copying may come from a cloud provider and go to another one: off the main thread.
    private final ExecutorService io = Executors.newSingleThreadExecutor();

    @PluginMethod
    public void save(PluginCall call) {
        String path = call.getString("path");
        String filename = call.getString("filename");
        String mime = call.getString("mime", "application/octet-stream");
        if (path == null || filename == null) {
            call.reject("path and filename are required");
            return;
        }
        Uri source = Uri.parse(path);
        if (!"file".equals(source.getScheme()) && !"content".equals(source.getScheme())) {
            call.reject("path must be a file or content URL");
            return;
        }
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(mime == null || mime.trim().isEmpty() ? "application/octet-stream" : mime);
        intent.putExtra(Intent.EXTRA_TITLE, filename);
        startActivityForResult(call, intent, "saveResult");
    }

    @ActivityCallback
    private void saveResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent data = result.getData();
        if (result.getResultCode() != Activity.RESULT_OK || data == null || data.getData() == null) {
            JSObject ret = new JSObject();
            ret.put("cancelled", true);
            call.resolve(ret);   // cancelled: nothing changes
            return;
        }
        Uri target = data.getData();
        String path = call.getString("path");
        io.execute(() -> {
            try {
                ContentResolver cr = getContext().getContentResolver();
                try (InputStream in = open(cr, Uri.parse(path));
                     OutputStream out = cr.openOutputStream(target, "wt")) {
                    if (in == null || out == null) throw new IllegalStateException("the file cannot be opened");
                    byte[] buffer = new byte[64 * 1024];
                    int n;
                    while ((n = in.read(buffer)) > 0) out.write(buffer, 0, n);
                }
                JSObject ret = new JSObject();
                ret.put("saved", true);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("could not save the file: " + e.getMessage(), e);
            }
        });
    }

    private static InputStream open(ContentResolver cr, Uri source) throws Exception {
        if ("file".equals(source.getScheme())) return new FileInputStream(new File(source.getPath()));
        return cr.openInputStream(source);
    }
}
