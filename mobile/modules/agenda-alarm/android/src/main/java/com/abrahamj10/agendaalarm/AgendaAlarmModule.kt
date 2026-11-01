package com.abrahamj10.agendaalarm

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray

class AgendaAlarmModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("AgendaAlarm")

    /** alarmsJson: [{ at, title, body, eventId, date }]. Devuelve cuántas alarmas quedaron programadas. */
    Function("scheduleAll") { alarmsJson: String, activeKeys: List<String> ->
      val arr = JSONArray(alarmsJson)
      val alarms = (0 until arr.length()).map { Alarm.fromJson(arr.getJSONObject(it), id = 0) }
      AlarmScheduler.replaceAll(context, alarms, activeKeys.toSet())
    }

    Function("cancelAll") {
      AlarmScheduler.cancelAll(context)
    }

    Function("count") {
      AlarmStore.load(context).size
    }

    Function("canScheduleExact") {
      AlarmScheduler.canScheduleExact(context)
    }

    /** En Android 14+ el usuario debe permitir las alertas a pantalla completa. */
    Function("canUseFullScreen") {
      if (Build.VERSION.SDK_INT >= 34) {
        context.getSystemService(NotificationManager::class.java).canUseFullScreenIntent()
      } else {
        true
      }
    }

    Function("openFullScreenSettings") {
      val intent = if (Build.VERSION.SDK_INT >= 34) {
        Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:${context.packageName}"))
      } else {
        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${context.packageName}"))
      }
      context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    /** Alerta de prueba dentro de `seconds` segundos. */
    Function("test") { seconds: Int ->
      val alarm = Alarm(
        id = AlarmStore.nextId(context),
        at = System.currentTimeMillis() + seconds * 1000L,
        title = "🔔 Prueba de alerta",
        body = "Así te avisará Agenda Pro, aunque el celular esté bloqueado.",
        eventId = "",
        date = "",
        snooze = true,
      )
      AlarmNotifier.ensureChannel(context)
      AlarmScheduler.schedule(context, alarm)
      AlarmStore.save(context, AlarmStore.load(context) + alarm)
    }
  }
}
