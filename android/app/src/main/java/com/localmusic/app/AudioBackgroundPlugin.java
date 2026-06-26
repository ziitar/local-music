package com.localmusic.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Capacitor plugin to control the background audio foreground service
 * and manage media notification state.
 */
@CapacitorPlugin(name = "AudioBackground")
public class AudioBackgroundPlugin extends Plugin {

    @Override
    public void load() {
        super.load();
        // Register the media action listener to forward notification button presses to JS
        AudioService.setMediaActionListener(action -> {
            JSObject data = new JSObject();
            data.put("action", action);
            notifyListeners("mediaAction", data);
        });
    }

    @PluginMethod
    public void start(PluginCall call) {
        AudioService.start(getContext());
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        AudioService.stop(getContext());
        call.resolve();
    }

    /**
     * Update the media notification with song metadata.
     * Receives title, artist, album, and optional artwork URL.
     */
    @PluginMethod
    public void updateMetadata(PluginCall call) {
        String title = call.getString("title", "");
        String artist = call.getString("artist", "");
        String album = call.getString("album", "");
        String artworkUrl = call.getString("artworkUrl", null);

        AudioService service = AudioService.getInstance();
        if (service != null) {
            service.updateMetadata(title, artist, album, artworkUrl);
        }
        call.resolve();
    }

    /**
     * Update the playback state for the media session and notification.
     * Receives isPlaying, position (ms), and duration (ms).
     */
    @PluginMethod
    public void updatePlaybackState(PluginCall call) {
        Boolean playing = call.getBoolean("isPlaying", false);
        Long position = call.getLong("position", 0L);
        Long duration = call.getLong("duration", 0L);

        AudioService service = AudioService.getInstance();
        if (service != null) {
            service.updatePlaybackState(playing, position, duration);
        }
        call.resolve();
    }
}
