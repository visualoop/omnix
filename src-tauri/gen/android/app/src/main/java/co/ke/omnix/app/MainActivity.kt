package co.ke.omnix.app

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat

class MainActivity : TauriActivity() {
  private var cameraPermissionCallback: ((Boolean) -> Unit)? = null
  private var vpnPermissionCallback: ((Boolean) -> Unit)? = null
  private val cameraPermissionLauncher = registerForActivityResult(
    ActivityResultContracts.RequestPermission(),
  ) { granted ->
    cameraPermissionCallback?.invoke(granted)
    cameraPermissionCallback = null
  }
  private val vpnPermissionLauncher = registerForActivityResult(
    ActivityResultContracts.StartActivityForResult(),
  ) { result ->
    vpnPermissionCallback?.invoke(result.resultCode == Activity.RESULT_OK)
    vpnPermissionCallback = null
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
  }

  fun requestCameraPermission(callback: (Boolean) -> Unit) {
    if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
      callback(true)
      return
    }
    if (cameraPermissionCallback != null) {
      callback(false)
      return
    }
    cameraPermissionCallback = callback
    cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
  }

  fun requestVpnPermission(intent: Intent, callback: (Boolean) -> Unit) {
    if (vpnPermissionCallback != null) {
      callback(false)
      return
    }
    vpnPermissionCallback = callback
    vpnPermissionLauncher.launch(intent)
  }
}
