package com.localmusic.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Capacitor plugin to control the background audio foreground service.
 */
@CapacitorPlugin(name = "AudioBackground")
public class AudioBackgroundPlugin extends Plugin {

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
}
