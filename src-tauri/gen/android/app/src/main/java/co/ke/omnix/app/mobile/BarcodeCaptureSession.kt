package co.ke.omnix.app.mobile

import android.app.Activity
import android.graphics.Color
import android.view.Gravity
import android.view.ViewGroup
import android.widget.Button
import android.widget.FrameLayout
import android.widget.TextView
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import com.google.mlkit.vision.barcode.BarcodeScanner
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import org.json.JSONArray
import java.nio.charset.StandardCharsets
import java.time.Instant
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

internal class BarcodeCaptureSession(private val activity: Activity) {
    private val analysisExecutor: ExecutorService = Executors.newSingleThreadExecutor()
    private var cameraProvider: ProcessCameraProvider? = null
    private var scanner: BarcodeScanner? = null
    private var overlay: FrameLayout? = null
    private var completion: ((ScanCapture?) -> Unit)? = null
    private val analyzing = AtomicBoolean(false)

    data class ScanCapture(val value: String, val format: String, val capturedAt: String)

    fun start(formats: JSONArray?, prompt: String?, onComplete: (ScanCapture?) -> Unit, onError: (String) -> Unit) {
        if (completion != null) {
            onError("A barcode scan is already active")
            return
        }
        val lifecycleOwner = activity as? LifecycleOwner
        if (lifecycleOwner == null) {
            onError("The Android activity cannot own a camera lifecycle")
            return
        }

        val requestedFormats = try {
            parseFormats(formats)
        } catch (error: IllegalArgumentException) {
            onError(error.message ?: "Scanner formats are invalid")
            return
        }
        completion = onComplete
        activity.runOnUiThread {
            try {
                val previewView = showCaptureSurface(prompt) { cancel() }
                val options = BarcodeScannerOptions.Builder()
                    .setBarcodeFormats(requestedFormats.first(), *requestedFormats.drop(1).toIntArray())
                    .build()
                scanner = BarcodeScanning.getClient(options)
                val providerFuture = ProcessCameraProvider.getInstance(activity)
                providerFuture.addListener({
                    if (completion == null) return@addListener
                    try {
                        val provider = providerFuture.get()
                        cameraProvider = provider
                        val preview = Preview.Builder().build().also {
                            it.surfaceProvider = previewView.surfaceProvider
                        }
                        val analysis = ImageAnalysis.Builder()
                            .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                            .build()
                        analysis.setAnalyzer(analysisExecutor) { imageProxy ->
                            if (!analyzing.compareAndSet(false, true)) {
                                imageProxy.close()
                                return@setAnalyzer
                            }
                            val mediaImage = imageProxy.image
                            if (mediaImage == null) {
                                analyzing.set(false)
                                imageProxy.close()
                                return@setAnalyzer
                            }
                            val image = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)
                            scanner?.process(image)
                                ?.addOnSuccessListener { barcodes ->
                                    val capture = barcodes.asSequence().mapNotNull(::toCapture).firstOrNull()
                                    if (capture != null) finish(capture)
                                }
                                ?.addOnFailureListener { /* Keep the live capture open for the next frame. */ }
                                ?.addOnCompleteListener {
                                    analyzing.set(false)
                                    imageProxy.close()
                                } ?: run {
                                analyzing.set(false)
                                imageProxy.close()
                            }
                        }
                        provider.unbindAll()
                        provider.bindToLifecycle(lifecycleOwner, CameraSelector.DEFAULT_BACK_CAMERA, preview, analysis)
                    } catch (error: Exception) {
                        fail(error.message ?: "Camera capture could not start", onError)
                    }
                }, ContextCompat.getMainExecutor(activity))
            } catch (error: Exception) {
                fail(error.message ?: "Camera capture could not start", onError)
            }
        }
    }

    fun cancel() {
        val callback = completion ?: return
        cleanup()
        callback(null)
    }

    fun close() {
        if (completion != null) cancel() else cleanup()
        analysisExecutor.shutdownNow()
    }

    private fun finish(capture: ScanCapture) {
        val callback = completion ?: return
        cleanup()
        callback(capture)
    }

    private fun fail(message: String, onError: (String) -> Unit) {
        if (completion == null) return
        completion = null
        cleanupResources()
        onError(message)
    }

    private fun cleanup() {
        completion = null
        cleanupResources()
    }

    private fun cleanupResources() {
        activity.runOnUiThread {
            cameraProvider?.unbindAll()
            cameraProvider = null
            scanner?.close()
            scanner = null
            overlay?.let { view -> (view.parent as? ViewGroup)?.removeView(view) }
            overlay = null
            analyzing.set(false)
        }
    }

    private fun showCaptureSurface(prompt: String?, cancel: () -> Unit): PreviewView {
        val root = FrameLayout(activity).apply {
            setBackgroundColor(Color.BLACK)
            isFocusableInTouchMode = true
            contentDescription = "Barcode camera scanner"
        }
        val preview = PreviewView(activity).apply {
            implementationMode = PreviewView.ImplementationMode.COMPATIBLE
            scaleType = PreviewView.ScaleType.FILL_CENTER
        }
        root.addView(preview, FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT,
        ))
        val label = TextView(activity).apply {
            text = prompt?.trim()?.take(160)?.ifEmpty { null } ?: "Place the barcode inside the camera view"
            setTextColor(Color.WHITE)
            setBackgroundColor(0x99000000.toInt())
            setPadding(32, 20, 32, 20)
            gravity = Gravity.CENTER
        }
        root.addView(label, FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT,
            Gravity.TOP,
        ))
        val cancelButton = Button(activity).apply {
            text = "Cancel"
            contentDescription = "Cancel barcode scan"
            setOnClickListener { cancel() }
        }
        root.addView(cancelButton, FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT,
            ViewGroup.LayoutParams.WRAP_CONTENT,
            Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL,
        ).apply { bottomMargin = 48 })
        activity.addContentView(root, ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT,
        ))
        overlay = root
        root.requestFocus()
        return preview
    }

    private fun parseFormats(formats: JSONArray?): List<Int> {
        val values = if (formats == null || formats.length() == 0) {
            listOf("code-128", "ean-8", "ean-13", "qr", "data-matrix")
        } else {
            require(formats.length() <= 8) { "Too many scanner formats" }
            (0 until formats.length()).map { formats.getString(it) }.distinct()
        }
        return values.map { value ->
            when (value) {
                "code-128" -> Barcode.FORMAT_CODE_128
                "ean-8" -> Barcode.FORMAT_EAN_8
                "ean-13" -> Barcode.FORMAT_EAN_13
                "qr" -> Barcode.FORMAT_QR_CODE
                "data-matrix" -> Barcode.FORMAT_DATA_MATRIX
                else -> throw IllegalArgumentException("Scanner format is invalid")
            }
        }
    }

    private fun toCapture(barcode: Barcode): ScanCapture? {
        val value = barcode.rawValue?.trim().orEmpty()
        if (value.isEmpty() || value.toByteArray(StandardCharsets.UTF_8).size > 4096) return null
        val format = when (barcode.format) {
            Barcode.FORMAT_CODE_128 -> "code-128"
            Barcode.FORMAT_EAN_8 -> "ean-8"
            Barcode.FORMAT_EAN_13 -> "ean-13"
            Barcode.FORMAT_QR_CODE -> "qr"
            Barcode.FORMAT_DATA_MATRIX -> "data-matrix"
            else -> "unknown"
        }
        return ScanCapture(value, format, Instant.now().toString())
    }
}
