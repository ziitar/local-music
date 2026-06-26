package com.localmusic.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Build;
import android.os.IBinder;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;
import android.support.v4.media.MediaMetadataCompat;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Foreground service with MediaSessionCompat for media notification controls.
 *
 * Displays a rich media notification with song title, artist, album art,
 * and playback controls (previous, play/pause, next).
 */
public class AudioService extends Service {

    private static final String CHANNEL_ID = "audio_playback_channel";
    private static final int NOTIFICATION_ID = 1;
    private static final String ACTION_START = "com.localmusic.app.ACTION_START_AUDIO";
    private static final String ACTION_STOP = "com.localmusic.app.ACTION_STOP_AUDIO";
    private static final String MEDIA_SESSION_TAG = "LocalMusicMediaSession";

    // Static reference for plugin access
    private static AudioService sInstance;
    private static MediaActionListener sMediaActionListener;

    private MediaSessionCompat mediaSession;
    private NotificationManager notificationManager;
    private ExecutorService imageExecutor;

    // Cached metadata for notification rebuilds
    private String currentTitle = "Local Music";
    private String currentArtist = "";
    private String currentAlbum = "";
    private Bitmap currentArtwork;
    private boolean isPlaying = false;

    public interface MediaActionListener {
        void onAction(String action);
    }

    public static AudioService getInstance() {
        return sInstance;
    }

    public static void setMediaActionListener(MediaActionListener listener) {
        sMediaActionListener = listener;
    }

    public static void start(Context context) {
        Intent intent = new Intent(context, AudioService.class);
        intent.setAction(ACTION_START);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent);
        } else {
            context.startService(intent);
        }
    }

    public static void stop(Context context) {
        Intent intent = new Intent(context, AudioService.class);
        intent.setAction(ACTION_STOP);
        context.startService(intent);
    }

    @Override
    public void onCreate() {
        super.onCreate();
        sInstance = this;
        notificationManager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        imageExecutor = Executors.newSingleThreadExecutor();
        createNotificationChannel();
        initMediaSession();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            cleanup();
            stopSelf();
            return START_NOT_STICKY;
        }

        // Show initial notification
        startForeground(NOTIFICATION_ID, buildNotification());
        return START_STICKY;
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        cleanup();
        super.onDestroy();
    }

    private void cleanup() {
        sInstance = null;
        if (mediaSession != null) {
            mediaSession.setActive(false);
            mediaSession.release();
            mediaSession = null;
        }
        if (imageExecutor != null) {
            imageExecutor.shutdown();
            imageExecutor = null;
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Audio Playback",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Media playback controls");
            channel.setShowBadge(false);
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            notificationManager.createNotificationChannel(channel);
        }
    }

    private void initMediaSession() {
        mediaSession = new MediaSessionCompat(this, MEDIA_SESSION_TAG);

        // Allow lock screen transport controls
        mediaSession.setFlags(
                MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS |
                MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS
        );

        mediaSession.setCallback(new MediaSessionCompat.Callback() {
            @Override
            public void onPlay() {
                isPlaying = true;
                notifyMediaAction("play");
                updateNotification();
            }

            @Override
            public void onPause() {
                isPlaying = false;
                notifyMediaAction("pause");
                updateNotification();
            }

            @Override
            public void onSkipToNext() {
                notifyMediaAction("next");
            }

            @Override
            public void onSkipToPrevious() {
                notifyMediaAction("previous");
            }

            @Override
            public void onStop() {
                isPlaying = false;
                notifyMediaAction("stop");
                updateNotification();
            }

            @Override
            public void onSeekTo(long pos) {
                notifyMediaAction("seek:" + pos);
            }
        });

        mediaSession.setActive(true);
    }

    private void notifyMediaAction(String action) {
        if (sMediaActionListener != null) {
            sMediaActionListener.onAction(action);
        }
    }

    /**
     * Update the media session metadata and notification.
     * Called from AudioBackgroundPlugin.
     */
    public void updateMetadata(String title, String artist, String album, String artworkUrl) {
        this.currentTitle = title != null ? title : "Unknown Title";
        this.currentArtist = artist != null ? artist : "Unknown Artist";
        this.currentAlbum = album != null ? album : "";

        // Update MediaSession metadata
        MediaMetadataCompat.Builder metadataBuilder = new MediaMetadataCompat.Builder()
                .putString(MediaMetadataCompat.METADATA_KEY_TITLE, currentTitle)
                .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, currentArtist)
                .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, currentAlbum);

        if (currentArtwork != null) {
            metadataBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, currentArtwork);
        }

        if (mediaSession != null) {
            mediaSession.setMetadata(metadataBuilder.build());
        }

        // Update notification immediately (without artwork)
        updateNotification();

        // Load artwork asynchronously
        if (artworkUrl != null && !artworkUrl.isEmpty()) {
            loadArtworkAsync(artworkUrl);
        } else {
            currentArtwork = null;
        }
    }

    /**
     * Update the playback state for the media session and notification.
     * Called from AudioBackgroundPlugin.
     */
    public void updatePlaybackState(boolean playing, long positionMs, long durationMs) {
        this.isPlaying = playing;

        int state = playing
                ? PlaybackStateCompat.STATE_PLAYING
                : PlaybackStateCompat.STATE_PAUSED;

        PlaybackStateCompat.Builder stateBuilder = new PlaybackStateCompat.Builder()
                .setActions(
                        PlaybackStateCompat.ACTION_PLAY |
                        PlaybackStateCompat.ACTION_PAUSE |
                        PlaybackStateCompat.ACTION_PLAY_PAUSE |
                        PlaybackStateCompat.ACTION_SKIP_TO_NEXT |
                        PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS |
                        PlaybackStateCompat.ACTION_SEEK_TO
                )
                .setState(state, positionMs, 1.0f);

        if (mediaSession != null) {
            mediaSession.setPlaybackState(stateBuilder.build());
        }

        updateNotification();
    }

    private void loadArtworkAsync(String artworkUrl) {
        if (imageExecutor == null || imageExecutor.isShutdown()) return;

        imageExecutor.execute(() -> {
            Bitmap bitmap = fetchBitmap(artworkUrl);
            if (bitmap != null) {
                currentArtwork = bitmap;
                // Update metadata with new artwork
                if (mediaSession != null) {
                    MediaMetadataCompat.Builder metadataBuilder = new MediaMetadataCompat.Builder()
                            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, currentTitle)
                            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, currentArtist)
                            .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, currentAlbum)
                            .putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, currentArtwork);
                    mediaSession.setMetadata(metadataBuilder.build());
                }
                updateNotification();
            }
        });
    }

    @Nullable
    private Bitmap fetchBitmap(String urlStr) {
        HttpURLConnection connection = null;
        try {
            URL url = new URL(urlStr);
            connection = (HttpURLConnection) url.openConnection();
            connection.setConnectTimeout(5000);
            connection.setReadTimeout(10000);
            connection.setDoInput(true);
            connection.connect();

            int responseCode = connection.getResponseCode();
            if (responseCode == HttpURLConnection.HTTP_OK) {
                InputStream inputStream = connection.getInputStream();
                Bitmap bitmap = BitmapFactory.decodeStream(inputStream);
                inputStream.close();

                // Scale down to save memory (notification artwork doesn't need to be huge)
                if (bitmap != null && (bitmap.getWidth() > 512 || bitmap.getHeight() > 512)) {
                    Bitmap scaled = Bitmap.createScaledBitmap(bitmap, 512, 512, true);
                    if (scaled != bitmap) {
                        bitmap.recycle();
                    }
                    return scaled;
                }
                return bitmap;
            }
        } catch (Exception e) {
            // Silently fail — notification will show without artwork
            e.printStackTrace();
        } finally {
            if (connection != null) {
                connection.disconnect();
            }
        }
        return null;
    }

    private void updateNotification() {
        if (notificationManager == null) return;
        notificationManager.notify(NOTIFICATION_ID, buildNotification());
    }

    private Notification buildNotification() {
        // Tap to open app
        Intent openAppIntent = new Intent(this, MainActivity.class);
        openAppIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent openAppPending = PendingIntent.getActivity(
                this, 0, openAppIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Media style with session token
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle(currentTitle)
                .setContentText(currentArtist)
                .setSubText(currentAlbum.isEmpty() ? null : currentAlbum)
                .setSmallIcon(android.R.drawable.ic_media_play)
                .setContentIntent(openAppPending)
                .setOngoing(isPlaying)
                .setSilent(true)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setPriority(NotificationCompat.PRIORITY_LOW);

        // Album art as large icon
        if (currentArtwork != null) {
            builder.setLargeIcon(currentArtwork);
        }

        // Media transport actions: previous, play/pause, next
        builder.addAction(buildAction(
                android.R.drawable.ic_media_previous, "Previous",
                PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS));

        if (isPlaying) {
            builder.addAction(buildAction(
                    android.R.drawable.ic_media_pause, "Pause",
                    PlaybackStateCompat.ACTION_PAUSE));
        } else {
            builder.addAction(buildAction(
                    android.R.drawable.ic_media_play, "Play",
                    PlaybackStateCompat.ACTION_PLAY));
        }

        builder.addAction(buildAction(
                android.R.drawable.ic_media_next, "Next",
                PlaybackStateCompat.ACTION_SKIP_TO_NEXT));

        // MediaStyle configuration
        builder.setStyle(new androidx.media.app.NotificationCompat.MediaStyle()
                .setMediaSession(mediaSession.getSessionToken())
                .setShowActionsInCompactView(0, 1, 2)  // Show all 3 actions in compact view
                .setShowCancelButton(true)
                .setCancelButtonIntent(buildActionIntent(PlaybackStateCompat.ACTION_STOP)));

        return builder.build();
    }

    private NotificationCompat.Action buildAction(int iconRes, String title, long action) {
        return new NotificationCompat.Action(iconRes, title, buildActionIntent(action));
    }

    private PendingIntent buildActionIntent(long action) {
        Intent intent = new Intent(this, AudioService.class);
        intent.setAction(Intent.ACTION_MEDIA_BUTTON);
        intent.putExtra("action", action);
        return PendingIntent.getService(
                this, (int) action, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }
}
