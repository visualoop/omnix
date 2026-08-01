package co.ke.omnix.app

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat

class MainActivity : TauriActivity() {
  private var cameraPermissionCallback: ((Boolean) -> Unit)? = null
  private val cameraPermissionLauncher = registerForActivityResult(
    ActivityResultContracts.RequestPermission(),
  ) { granted ->
    cameraPermissionCallback?.invoke(granted)
    cameraPermissionCallback = null
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
}
