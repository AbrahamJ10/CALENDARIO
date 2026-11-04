package com.abrahamj10.agendaalarm

import android.animation.ObjectAnimator
import android.animation.PropertyValuesHolder
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** Pantalla completa tipo "llamada entrante" que aparece aunque el celular esté bloqueado. */
class AlarmActivity : Activity() {
  companion object {
    const val ACTION_SHOW = "com.abrahamj10.agendaalarm.SHOW"
    const val ACTION_DONE = "com.abrahamj10.agendaalarm.DONE"
    const val ACTION_OPEN = "com.abrahamj10.agendaalarm.OPEN"

    fun intent(ctx: Context, a: Alarm, action: String?): Intent =
      Intent(ctx, AlarmActivity::class.java)
        .setAction(action ?: ACTION_SHOW)
        .putExtras(a.toBundle())
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_USER_ACTION)
  }

  private var alarm: Alarm? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    handle(intent)
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    handle(intent)
  }

  private fun handle(intent: Intent) {
    val a = Alarm.fromBundle(intent.extras) ?: return finish()
    alarm = a
    if (intent.action == ACTION_DONE) return done(a)
    if (intent.action == ACTION_OPEN) return openDetails(a)
    showOverLockScreen()
    setContentView(buildUi(a))
  }

  private fun showOverLockScreen() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
    } else {
      @Suppress("DEPRECATION")
      window.addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON)
    }
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
  }

  /** Marca como realizada abriendo la app con agendapro://done (la app guarda el cambio en la base de datos). */
  private fun done(a: Alarm) {
    AlarmNotifier.dismiss(this, a.id)
    val uri = Uri.parse("agendapro://done?eventId=${Uri.encode(a.eventId)}&date=${Uri.encode(a.date)}")
    startActivity(Intent(Intent.ACTION_VIEW, uri).setPackage(packageName).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    finish()
  }

  /** Abre directamente el detalle de lo agendado en la app (agendapro://open). */
  private fun openDetails(a: Alarm) {
    AlarmNotifier.dismiss(this, a.id)
    if (a.eventId.isNotEmpty()) {
      val uri = Uri.parse("agendapro://open?eventId=${Uri.encode(a.eventId)}&date=${Uri.encode(a.date)}")
      startActivity(Intent(Intent.ACTION_VIEW, uri).setPackage(packageName).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
    finish()
  }

  private fun snooze(a: Alarm) {
    AlarmNotifier.dismiss(this, a.id)
    AlarmScheduler.snooze(this, a, 10)
    Toast.makeText(this, "Te recordaré en 10 minutos", Toast.LENGTH_SHORT).show()
    finish()
  }

  private fun silence(a: Alarm) {
    AlarmNotifier.dismiss(this, a.id)
    finish()
  }

  @Deprecated("Deprecated in Java")
  override fun onBackPressed() {
    // Atrás no debe silenciar por accidente: se trata como posponer
    alarm?.let { snooze(it) } ?: super.onBackPressed()
  }

  // Misma tipografía que la app (Inter), para no depender de la fuente del sistema
  private fun inter(weight: String): Typeface =
    try { Typeface.createFromAsset(assets, "fonts/inter_$weight.ttf") } catch (_: Exception) { Typeface.DEFAULT_BOLD }

  private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()

  private fun text(value: String, sizeSp: Float, bold: Boolean = false, alpha: Float = 1f) = TextView(this).apply {
    text = value
    textSize = sizeSp
    setTextColor(Color.WHITE)
    this.alpha = alpha
    gravity = Gravity.CENTER
    typeface = inter(if (bold) "extrabold" else "regular")
  }

  private fun button(label: String, bg: Int, fg: Int, onClick: () -> Unit) = TextView(this).apply {
    text = label
    textSize = 19f
    typeface = inter("extrabold")
    setTextColor(fg)
    gravity = Gravity.CENTER
    background = GradientDrawable().apply { cornerRadius = dp(22).toFloat(); setColor(bg) }
    setPadding(dp(16), dp(20), dp(16), dp(20))
    setOnClickListener { onClick() }
  }

  private fun buildUi(a: Alarm): View {
    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER_HORIZONTAL
      background = GradientDrawable(GradientDrawable.Orientation.TL_BR, intArrayOf(0xFF4F46E5.toInt(), 0xFF7C3AED.toInt(), 0xFF5B21B6.toInt()))
      setPadding(dp(28), dp(56), dp(28), dp(40))
    }

    root.addView(text("AGENDA PRO · RECORDATORIO", 13f, bold = true, alpha = 0.8f))
    root.addView(text(SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date()), 64f, bold = true).apply {
      setPadding(0, dp(8), 0, 0)
    })

    // Campana que "late" como una llamada entrante
    val bell = text("🔔", 64f).apply {
      background = GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(0x33FFFFFF) }
      layoutParams = LinearLayout.LayoutParams(dp(150), dp(150)).apply { topMargin = dp(32); bottomMargin = dp(28) }
    }
    root.addView(bell)
    ObjectAnimator.ofPropertyValuesHolder(
      bell,
      PropertyValuesHolder.ofFloat(View.SCALE_X, 1f, 1.15f),
      PropertyValuesHolder.ofFloat(View.SCALE_Y, 1f, 1.15f),
    ).apply {
      duration = 550
      repeatCount = ObjectAnimator.INFINITE
      repeatMode = ObjectAnimator.REVERSE
      start()
    }

    root.addView(text(a.title, 30f, bold = true))
    root.addView(text(a.body, 17f, alpha = 0.88f).apply { setPadding(0, dp(12), 0, 0) })

    root.addView(View(this), LinearLayout.LayoutParams(0, 0, 1f))

    val full = { LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(12) } }
    root.addView(button("✅  Ya lo realicé", 0xFF10B981.toInt(), Color.WHITE) { done(a) }, full())
    if (a.eventId.isNotEmpty()) {
      root.addView(button("📋  Ver detalles", 0x33FFFFFF, Color.WHITE) { openDetails(a) }, full())
    }
    root.addView(button("⏰  Posponer 10 min", Color.WHITE, 0xFF4F46E5.toInt()) { snooze(a) }, full())
    root.addView(text("Silenciar", 16f, bold = true, alpha = 0.85f).apply {
      setPadding(0, dp(20), 0, dp(4))
      setOnClickListener { silence(a) }
    }, full())
    return root
  }
}
