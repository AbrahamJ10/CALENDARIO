package com.abrahamj10.agendaalarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.widget.Toast

/** Llega la hora de la alarma: muestra la alerta tipo llamada. */
class AlarmReceiver : BroadcastReceiver() {
  override fun onReceive(ctx: Context, intent: Intent) {
    val alarm = Alarm.fromBundle(intent.extras) ?: return
    AlarmStore.remove(ctx, alarm.id)
    AlarmNotifier.show(ctx, alarm)
  }
}

/** Botón "⏰ 10 min" de la notificación. */
class ActionReceiver : BroadcastReceiver() {
  companion object {
    const val ACTION_SNOOZE = "com.abrahamj10.agendaalarm.SNOOZE"
  }

  override fun onReceive(ctx: Context, intent: Intent) {
    val alarm = Alarm.fromBundle(intent.extras) ?: return
    if (intent.action == ACTION_SNOOZE) {
      AlarmNotifier.dismiss(ctx, alarm.id)
      AlarmScheduler.snooze(ctx, alarm, 10)
      Toast.makeText(ctx, "Te recordaré en 10 minutos", Toast.LENGTH_SHORT).show()
    }
  }
}

/** Tras reiniciar el celular o actualizar la app, Android borra las alarmas: se reprograman. */
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(ctx: Context, intent: Intent) {
    if (intent.action == Intent.ACTION_BOOT_COMPLETED || intent.action == Intent.ACTION_MY_PACKAGE_REPLACED) {
      AlarmScheduler.restore(ctx)
    }
  }
}
