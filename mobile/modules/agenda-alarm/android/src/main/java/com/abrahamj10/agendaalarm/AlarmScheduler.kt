package com.abrahamj10.agendaalarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build

object AlarmScheduler {
  const val ACTION_FIRE = "com.abrahamj10.agendaalarm.FIRE"

  private fun alarmManager(ctx: Context) = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager

  private fun firePendingIntent(ctx: Context, a: Alarm, flags: Int): PendingIntent? {
    val intent = Intent(ctx, AlarmReceiver::class.java).setAction(ACTION_FIRE).putExtras(a.toBundle())
    return PendingIntent.getBroadcast(ctx, a.id, intent, flags or PendingIntent.FLAG_IMMUTABLE)
  }

  fun canScheduleExact(ctx: Context): Boolean =
    Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarmManager(ctx).canScheduleExactAlarms()

  fun schedule(ctx: Context, a: Alarm) {
    val am = alarmManager(ctx)
    val pi = firePendingIntent(ctx, a, PendingIntent.FLAG_UPDATE_CURRENT) ?: return
    if (canScheduleExact(ctx)) {
      // setAlarmClock: Android no lo retrasa por ahorro de batería
      val launch = ctx.packageManager.getLaunchIntentForPackage(ctx.packageName) ?: Intent()
      val show = PendingIntent.getActivity(ctx, a.id, launch, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
      am.setAlarmClock(AlarmManager.AlarmClockInfo(a.at, show), pi)
    } else {
      am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, a.at, pi)
    }
  }

  fun cancel(ctx: Context, a: Alarm) {
    firePendingIntent(ctx, a, PendingIntent.FLAG_NO_CREATE)?.let {
      alarmManager(ctx).cancel(it)
      it.cancel()
    }
  }

  /**
   * Reemplaza todas las alarmas por las nuevas. Conserva las alarmas pospuestas
   * cuya actividad sigue pendiente (su clave está en activeKeys).
   */
  @Synchronized
  fun replaceAll(ctx: Context, incoming: List<Alarm>, activeKeys: Set<String>): Int {
    val now = System.currentTimeMillis()
    val old = AlarmStore.load(ctx)
    // eventId vacío = alerta de prueba
    val keptSnoozes = old.filter { it.snooze && it.at > now && (it.key in activeKeys || it.eventId.isEmpty()) }
    old.filter { it !in keptSnoozes }.forEach { cancel(ctx, it) }

    val fresh = incoming.filter { it.at > now }.map { it.copy(id = AlarmStore.nextId(ctx)) }
    fresh.forEach { schedule(ctx, it) }
    val all = keptSnoozes + fresh
    AlarmStore.save(ctx, all)
    return all.size
  }

  fun cancelAll(ctx: Context) {
    AlarmStore.load(ctx).forEach { cancel(ctx, it) }
    AlarmStore.save(ctx, emptyList())
  }

  fun snooze(ctx: Context, a: Alarm, minutes: Int) {
    val next = a.copy(id = AlarmStore.nextId(ctx), at = System.currentTimeMillis() + minutes * 60_000L, snooze = true)
    schedule(ctx, next)
    AlarmStore.save(ctx, AlarmStore.load(ctx) + next)
  }

  /** Vuelve a programar las alarmas guardadas (tras reiniciar o actualizar la app). */
  fun restore(ctx: Context) {
    val now = System.currentTimeMillis()
    val alive = AlarmStore.load(ctx).filter { it.at > now }
    alive.forEach { schedule(ctx, it) }
    AlarmStore.save(ctx, alive)
  }
}
