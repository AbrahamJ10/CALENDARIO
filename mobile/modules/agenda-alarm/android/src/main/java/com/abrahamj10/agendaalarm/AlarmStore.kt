package com.abrahamj10.agendaalarm

import android.content.Context
import android.os.Bundle
import org.json.JSONArray
import org.json.JSONObject

data class Alarm(
  val id: Int,
  val at: Long,
  val title: String,
  val body: String,
  val eventId: String,
  val date: String,
  val snooze: Boolean = false,
) {
  val key get() = "$eventId|$date"

  fun toJson(): JSONObject = JSONObject()
    .put("id", id).put("at", at).put("title", title).put("body", body)
    .put("eventId", eventId).put("date", date).put("snooze", snooze)

  fun toBundle(): Bundle = Bundle().apply {
    putInt("id", id); putLong("at", at); putString("title", title); putString("body", body)
    putString("eventId", eventId); putString("date", date); putBoolean("snooze", snooze)
  }

  companion object {
    fun fromJson(o: JSONObject, id: Int = o.optInt("id")) = Alarm(
      id = id,
      at = o.getLong("at"),
      title = o.optString("title"),
      body = o.optString("body"),
      eventId = o.optString("eventId"),
      date = o.optString("date"),
      snooze = o.optBoolean("snooze", false),
    )

    fun fromBundle(b: Bundle?): Alarm? {
      if (b == null || !b.containsKey("id")) return null
      return Alarm(
        id = b.getInt("id"),
        at = b.getLong("at"),
        title = b.getString("title") ?: "",
        body = b.getString("body") ?: "",
        eventId = b.getString("eventId") ?: "",
        date = b.getString("date") ?: "",
        snooze = b.getBoolean("snooze", false),
      )
    }
  }
}

/** Guarda las alarmas programadas para poder reprogramarlas tras reiniciar el celular. */
object AlarmStore {
  private const val PREFS = "agenda_alarm"
  private const val KEY_ALARMS = "alarms"
  private const val KEY_NEXT_ID = "next_id"

  private fun prefs(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun load(ctx: Context): MutableList<Alarm> {
    val raw = prefs(ctx).getString(KEY_ALARMS, "[]") ?: "[]"
    val arr = try { JSONArray(raw) } catch (_: Exception) { JSONArray() }
    return (0 until arr.length()).mapNotNull { i ->
      try { Alarm.fromJson(arr.getJSONObject(i)) } catch (_: Exception) { null }
    }.toMutableList()
  }

  fun save(ctx: Context, alarms: List<Alarm>) {
    val arr = JSONArray()
    alarms.forEach { arr.put(it.toJson()) }
    prefs(ctx).edit().putString(KEY_ALARMS, arr.toString()).apply()
  }

  fun remove(ctx: Context, id: Int) = save(ctx, load(ctx).filter { it.id != id })

  /** Ids entre 1 y 900000 para no chocar con los request codes derivados (id + 1M, id + 2M). */
  @Synchronized
  fun nextId(ctx: Context): Int {
    val p = prefs(ctx)
    val id = p.getInt(KEY_NEXT_ID, 0) % 900_000 + 1
    p.edit().putInt(KEY_NEXT_ID, id).apply()
    return id
  }
}
