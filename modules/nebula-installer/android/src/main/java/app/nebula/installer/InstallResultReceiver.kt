package app.nebula.installer

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.os.Build

/** Recibe el resultado de la sesión de instalación y, si hace falta, abre el diálogo del sistema. */
class InstallResultReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)
    val message = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE)
    when (status) {
      PackageInstaller.STATUS_PENDING_USER_ACTION -> {
        val confirm: Intent? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
          intent.getParcelableExtra(Intent.EXTRA_INTENT, Intent::class.java)
        } else {
          @Suppress("DEPRECATION")
          intent.getParcelableExtra(Intent.EXTRA_INTENT)
        }
        if (confirm != null) {
          confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          runCatching { context.startActivity(confirm) }
            .onFailure { NebulaInstallerModule.notify("failure", it.message) }
        }
        NebulaInstallerModule.notify("pendingUserAction", message)
      }
      PackageInstaller.STATUS_SUCCESS -> NebulaInstallerModule.notify("success", message)
      PackageInstaller.STATUS_FAILURE_ABORTED -> NebulaInstallerModule.notify("aborted", message)
      else -> NebulaInstallerModule.notify("failure", message ?: "estado $status")
    }
  }
}
