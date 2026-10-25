package dat.waqtu.countdown

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.SystemClock
import android.view.View
import android.widget.RemoteViews
import org.json.JSONArray

/**
 * Home-screen widget counting down to the next imsak or maghrib. The app writes the upcoming moments (with their
 * already-translated labels) through `WaqtuCountdown.setWidgetSchedule`; the widget shows the first one still in
 * the future as a system chronometer, so it ticks without the app running, and sets an alarm at that moment to move
 * on to the next entry.
 */
class WaqtuCountdownWidget : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, appWidgetIds: IntArray) {
    render(context, manager, appWidgetIds)
  }

  override fun onReceive(context: Context, intent: Intent) {
    super.onReceive(context, intent)
    when (intent.action) {
      ACTION_REFRESH, Intent.ACTION_TIME_CHANGED, Intent.ACTION_TIMEZONE_CHANGED -> refresh(context)
    }
  }

  override fun onDisabled(context: Context) {
    alarms(context).cancel(refreshIntent(context))
  }

  private data class Entry(val atMs: Long, val title: String, val text: String)

  companion object {
    private const val PREFS = "waqtu_countdown_widget"
    private const val KEY_SCHEDULE = "schedule"
    private const val ACTION_REFRESH = "dat.waqtu.countdown.WIDGET_REFRESH"

    /** Stores the schedule (JSON array of `{at, title, text}`, `at` in epoch ms) and redraws every placed widget. */
    fun setSchedule(context: Context, json: String) {
      context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY_SCHEDULE, json).apply()
      refresh(context)
    }

    private fun refresh(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, WaqtuCountdownWidget::class.java))
      if (ids.isEmpty()) {
        alarms(context).cancel(refreshIntent(context))
        return
      }
      render(context, manager, ids)
    }

    private fun render(context: Context, manager: AppWidgetManager, ids: IntArray) {
      val now = System.currentTimeMillis()
      val next = nextEntry(context, now)
      val views = RemoteViews(context.packageName, R.layout.waqtu_countdown_widget)
      if (next == null) {
        views.setTextViewText(R.id.waqtu_countdown_widget_title, context.getString(R.string.waqtu_countdown_widget_empty))
        views.setViewVisibility(R.id.waqtu_countdown_widget_timer, View.GONE)
        views.setViewVisibility(R.id.waqtu_countdown_widget_text, View.GONE)
        alarms(context).cancel(refreshIntent(context))
      } else {
        views.setTextViewText(R.id.waqtu_countdown_widget_title, next.title)
        views.setTextViewText(R.id.waqtu_countdown_widget_text, next.text)
        views.setViewVisibility(R.id.waqtu_countdown_widget_timer, View.VISIBLE)
        views.setViewVisibility(R.id.waqtu_countdown_widget_text, View.VISIBLE)
        views.setChronometer(R.id.waqtu_countdown_widget_timer, SystemClock.elapsedRealtime() + (next.atMs - now), null, true)
        views.setChronometerCountDown(R.id.waqtu_countdown_widget_timer, true)
        scheduleRefresh(context, next.atMs)
      }
      context.packageManager.getLaunchIntentForPackage(context.packageName)?.let { launch ->
        views.setOnClickPendingIntent(
          R.id.waqtu_countdown_widget_root,
          PendingIntent.getActivity(context, 0, launch, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT),
        )
      }
      manager.updateAppWidget(ids, views)
    }

    /** First stored entry still in the future, or null when the app has not written one (or they all passed). */
    private fun nextEntry(context: Context, now: Long): Entry? {
      val json = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_SCHEDULE, null) ?: return null
      val entries = try {
        JSONArray(json)
      } catch (_: Exception) {
        return null
      }
      var best: Entry? = null
      for (i in 0 until entries.length()) {
        val item = entries.optJSONObject(i) ?: continue
        val at = item.optLong("at")
        if (at > now && (best == null || at < best.atMs)) {
          best = Entry(at, item.optString("title"), item.optString("text"))
        }
      }
      return best
    }

    /**
     * Wakes the widget at the boundary to switch to the next entry. Non-waking: a dark screen shows no widget, so the
     * redraw can wait until the device is in use. Exact when the user allowed exact alarms, otherwise within a minute
     * as far as the system honours the window.
     */
    private fun scheduleRefresh(context: Context, atMs: Long) {
      val alarms = alarms(context)
      val intent = refreshIntent(context)
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarms.canScheduleExactAlarms()) {
        alarms.setExact(AlarmManager.RTC, atMs, intent)
      } else {
        alarms.setWindow(AlarmManager.RTC, atMs, 60_000L, intent)
      }
    }

    private fun alarms(context: Context) = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

    private fun refreshIntent(context: Context): PendingIntent =
      PendingIntent.getBroadcast(
        context,
        0,
        Intent(context, WaqtuCountdownWidget::class.java).setAction(ACTION_REFRESH),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
      )
  }
}
