package app.nebula.installer

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.lang.ref.WeakReference

/**
 * Instala actualizaciones de Nebula con la API de sesiones de PackageInstaller.
 *
 * A diferencia del intent VIEW de un APK, la sesión deja a Nebula como «instaladora» de sí misma.
 * Desde Android 12, si la versión instalada la instaló Nebula, las siguientes actualizaciones se
 * aplican sin ningún diálogo (USER_ACTION_NOT_REQUIRED). Si el sistema aun así pide confirmación,
 * [InstallResultReceiver] abre su diálogo.
 */
class NebulaInstallerModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("NebulaInstaller")
    Events(STATUS_EVENT)

    OnCreate { current = WeakReference(this@NebulaInstallerModule) }
    OnDestroy { if (current?.get() === this@NebulaInstallerModule) current = null }

    /** Paquete que instaló esta copia de Nebula (null si fue adb o no se sabe). */
    Function("installerOfRecord") { installerOf(context) }

    /** true si la próxima actualización puede instalarse sin que la persona confirme nada. */
    Function("canInstallSilently") {
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && installerOf(context) == context.packageName
    }

    /**
     * Copia el APK en una sesión y la confirma. Resuelve al entregar la sesión al sistema; el
     * resultado llega después como evento `onStatus` ({ status, message }).
     */
    AsyncFunction("install") { path: String ->
      val ctx = context
      val apk = File(Uri.parse(path).path ?: path)
      if (!apk.isFile) throw IllegalArgumentException("No existe el APK: $path")
      val installer = ctx.packageManager.packageInstaller
      val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL).apply {
        setAppPackageName(ctx.packageName)
        setSize(apk.length())
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) setInstallReason(PackageManager.INSTALL_REASON_USER)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED)
      }
      val id = installer.createSession(params)
      try {
        installer.openSession(id).use { session ->
          session.openWrite("nebula.apk", 0, apk.length()).use { out ->
            apk.inputStream().use { it.copyTo(out, 1 shl 16) }
            session.fsync(out)
          }
          val intent = Intent(ctx, InstallResultReceiver::class.java).setPackage(ctx.packageName)
          var flags = PendingIntent.FLAG_UPDATE_CURRENT
          // El sistema añade el estado como extra: el PendingIntent (explícito) tiene que ser mutable.
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) flags = flags or PendingIntent.FLAG_MUTABLE
          session.commit(PendingIntent.getBroadcast(ctx, id, intent, flags).intentSender)
        }
      } catch (e: Exception) {
        installer.abandonSession(id)
        throw e
      }
    }
  }

  internal fun emit(status: String, message: String?) {
    sendEvent(STATUS_EVENT, mapOf("status" to status, "message" to message))
  }

  companion object {
    private const val STATUS_EVENT = "onStatus"
    private var current: WeakReference<NebulaInstallerModule>? = null

    internal fun notify(status: String, message: String?) {
      current?.get()?.let { runCatching { it.emit(status, message) } }
    }

    private fun installerOf(ctx: Context): String? = runCatching {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        ctx.packageManager.getInstallSourceInfo(ctx.packageName).installingPackageName
      } else {
        @Suppress("DEPRECATION")
        ctx.packageManager.getInstallerPackageName(ctx.packageName)
      }
    }.getOrNull()
  }
}
