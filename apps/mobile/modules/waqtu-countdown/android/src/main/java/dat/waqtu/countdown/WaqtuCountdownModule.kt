package dat.waqtu.countdown

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Ongoing lock-screen notification that counts down to a moment (iftar, imsak). The countdown is a system
 * chronometer, so it keeps ticking while the app is closed; the notification removes itself at the target time.
 */
class WaqtuCountdownModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val manager: NotificationManager
    get() = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

  override fun definition() = ModuleDefinition {
    Name("WaqtuCountdown")

    Function("show") { title: String, text: String, targetAtMs: Double, channelName: String ->
      show(title, text, targetAtMs.toLong(), channelName)
    }

    Function("cancel") { manager.cancel(NOTIFICATION_ID) }
  }

  /** Posts (or replaces) the countdown. False when notifications are blocked or the target already passed. */
  private fun show(title: String, text: String, targetAtMs: Long, channelName: String): Boolean {
    val remaining = targetAtMs - System.currentTimeMillis()
    if (remaining <= 0 || !manager.areNotificationsEnabled()) return false

    val channel = NotificationChannel(CHANNEL_ID, channelName, NotificationManager.IMPORTANCE_LOW)
    channel.setShowBadge(false)
    channel.lockscreenVisibility = Notification.VISIBILITY_PUBLIC
    manager.createNotificationChannel(channel)

    val builder = Notification.Builder(context, CHANNEL_ID)
      .setSmallIcon(R.drawable.waqtu_countdown_icon)
      .setContentTitle(title)
      .setContentText(text)
      .setCategory(Notification.CATEGORY_STATUS)
      .setVisibility(Notification.VISIBILITY_PUBLIC)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setShowWhen(true)
      .setWhen(targetAtMs)
      .setUsesChronometer(true)
      .setChronometerCountDown(true)
      .setTimeoutAfter(remaining)
    context.packageManager.getLaunchIntentForPackage(context.packageName)?.let { launch ->
      builder.setContentIntent(
        PendingIntent.getActivity(context, 0, launch, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT),
      )
    }
    manager.notify(NOTIFICATION_ID, builder.build())
    return true
  }

  private companion object {
    const val CHANNEL_ID = "waqtu_countdown"
    const val NOTIFICATION_ID = 8201
  }
}
