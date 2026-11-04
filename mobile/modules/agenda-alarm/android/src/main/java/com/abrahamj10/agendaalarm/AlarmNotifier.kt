package com.abrahamj10.agendaalarm

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

object AlarmNotifier {
  const val CHANNEL_ID = "agenda_llamadas"
  private const val TAG = "agenda_alarm"
  // Deja de sonar sola si nadie responde en 5 minutos (la insistencia volverá a llamar después)
  private const val RING_TIMEOUT_MS = 5 * 60_000L
  val VIBRATION = longArrayOf(0, 900, 500, 900, 500, 900, 500, 900)

  fun alarmSound(): Uri =
    RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
      ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
      ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)

  fun ensureChannel(ctx: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val nm = ctx.getSystemService(NotificationManager::class.java)
    if (nm.getNotificationChannel(CHANNEL_ID) != null) return
    val channel = NotificationChannel(CHANNEL_ID, "Alertas tipo llamada", NotificationManager.IMPORTANCE_HIGH).apply {
      description = "Recordatorios a pantalla completa con sonido de alarma"
      // Uso ALARMA: suena aunque el celular esté en silencio
      setSound(
        alarmSound(),
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_ALARM)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .build(),
      )
      enableVibration(true)
      vibrationPattern = VIBRATION
      enableLights(true)
      lightColor = 0xFF4F46E5.toInt()
      lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      setBypassDnd(true)
    }
    nm.createNotificationChannel(channel)
  }

  fun show(ctx: Context, a: Alarm) {
    ensureChannel(ctx)
    val flags = PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
    val fullScreen = PendingIntent.getActivity(ctx, a.id, AlarmActivity.intent(ctx, a, null), flags)
    val done = PendingIntent.getActivity(ctx, a.id + 1_000_000, AlarmActivity.intent(ctx, a, AlarmActivity.ACTION_DONE), flags)
    val details = PendingIntent.getActivity(ctx, a.id + 3_000_000, AlarmActivity.intent(ctx, a, AlarmActivity.ACTION_OPEN), flags)
    val snooze = PendingIntent.getBroadcast(
      ctx, a.id + 2_000_000,
      Intent(ctx, ActionReceiver::class.java).setAction(ActionReceiver.ACTION_SNOOZE).putExtras(a.toBundle()),
      flags,
    )

    val notification = NotificationCompat.Builder(ctx, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
      .setColor(0xFF4F46E5.toInt())
      .setContentTitle(a.title)
      .setContentText(a.body)
      .setStyle(NotificationCompat.BigTextStyle().bigText(a.body))
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setCategory(NotificationCompat.CATEGORY_ALARM)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setOngoing(true)
      .setAutoCancel(false)
      .setFullScreenIntent(fullScreen, true)
      .setContentIntent(fullScreen)
      .addAction(0, "✅ Realizado", done)
      .addAction(0, "⏰ 10 min", snooze)
      .apply { if (a.eventId.isNotEmpty()) addAction(0, "📋 Ver", details) }
      .setTimeoutAfter(RING_TIMEOUT_MS)
      .setSound(alarmSound(), AudioManager.STREAM_ALARM)
      .setVibrate(VIBRATION)
      .build()
    // FLAG_INSISTENT: el sonido se repite en bucle hasta que respondas
    notification.flags = notification.flags or Notification.FLAG_INSISTENT

    try {
      NotificationManagerCompat.from(ctx).notify(TAG, a.id, notification)
    } catch (_: SecurityException) {
      // Sin permiso de notificaciones: no hay nada que mostrar
    }
  }

  fun dismiss(ctx: Context, id: Int) = NotificationManagerCompat.from(ctx).cancel(TAG, id)
}
