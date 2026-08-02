package co.ke.omnix.app.mobile

import android.Manifest
import android.app.Activity
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.VpnService
import android.os.Build
import android.provider.Settings
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyPermanentlyInvalidatedException
import android.security.keystore.KeyProperties
import android.util.Base64
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import app.tauri.annotation.Command
import app.tauri.annotation.Permission
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import co.ke.omnix.app.MainActivity
import org.json.JSONObject
import java.nio.charset.StandardCharsets
import java.security.KeyStore
import java.security.MessageDigest
import java.time.Instant
import java.util.UUID
import java.util.concurrent.atomic.AtomicBoolean
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

private const val STORAGE_NAME = "omnix.mobile.secure.v1"
private const val KEYSTORE_PROVIDER = "AndroidKeyStore"
private const val NOTIFICATION_CHANNEL = "omnix-local"
private val SAFE_KEY_PART = Regex("^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")

@TauriPlugin(
    permissions = [
        Permission(strings = [Manifest.permission.CAMERA], alias = "camera"),
        Permission(strings = [Manifest.permission.POST_NOTIFICATIONS], alias = "notifications"),
    ],
)
class OmnixMobilePlugin(private val activity: Activity) : Plugin(activity) {
    private val preferences = activity.getSharedPreferences(STORAGE_NAME, Context.MODE_PRIVATE)
    private val scannerCapture = BarcodeCaptureSession(activity)
    private val apkUpdater = DirectApkUpdater(activity) { status -> trigger("apk-update-progress", status) }
    private var lifecycleState = "active"

    private fun empty(): JSObject = JSObject()

    private fun availability(state: String, reason: String? = null, permission: String? = null): JSObject =
        JSObject().put("state", state).also {
            if (reason != null) it.put("reason", reason)
            if (permission != null) it.put("permission", permission)
        }

    private fun permissionState(permission: String): String {
        if (Build.VERSION.SDK_INT < 33 && permission == Manifest.permission.POST_NOTIFICATIONS) return "granted"
        return if (ContextCompat.checkSelfPermission(activity, permission) == PackageManager.PERMISSION_GRANTED) {
            "granted"
        } else if (ActivityCompat.shouldShowRequestPermissionRationale(activity, permission)) {
            "denied"
        } else {
            "prompt"
        }
    }

    private fun secureKey(args: JSObject): Triple<String, String, String> {
        val key = args.getJSObject("key") ?: throw IllegalArgumentException("Secure storage key is required")
        val namespace = key.getString("namespace")
        val accountId = key.getString("accountId")
        val name = key.getString("name")
        if (namespace !in setOf("session", "device", "mesh")) throw IllegalArgumentException("Secure storage namespace is invalid")
        if (!SAFE_KEY_PART.matches(accountId) || !SAFE_KEY_PART.matches(name)) throw IllegalArgumentException("Secure storage key is invalid")
        return Triple(namespace, accountId, name)
    }

    private fun storageId(parts: Triple<String, String, String>): String {
        val digest = MessageDigest.getInstance("SHA-256")
            .digest("${parts.first}:${parts.second}:${parts.third}".toByteArray(StandardCharsets.UTF_8))
        return Base64.encodeToString(digest, Base64.NO_WRAP or Base64.URL_SAFE or Base64.NO_PADDING)
    }

    private fun alias(storageId: String) = "omnix.mobile.$storageId"

    private fun secretKey(alias: String): SecretKey {
        val keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER).apply { load(null) }
        (keyStore.getKey(alias, null) as? SecretKey)?.let { return it }
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE_PROVIDER)
        generator.init(
            KeyGenParameterSpec.Builder(
                alias,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build(),
        )
        return generator.generateKey()
    }

    @Command
    fun secureStorageAvailability(invoke: Invoke) {
        invoke.resolve(availability("available"))
    }

    @Command
    fun secureStorageGet(invoke: Invoke) {
        try {
            val id = storageId(secureKey(invoke.getArgs()))
            val encoded = preferences.getString(id, null)
            val result = JSObject()
            if (encoded == null) {
                result.put("value", JSONObject.NULL)
            } else {
                val bytes = Base64.decode(encoded, Base64.NO_WRAP)
                require(bytes.size > 12) { "Secure storage ciphertext is invalid" }
                val cipher = Cipher.getInstance("AES/GCM/NoPadding")
                cipher.init(Cipher.DECRYPT_MODE, secretKey(alias(id)), GCMParameterSpec(128, bytes.copyOfRange(0, 12)))
                val plaintext = cipher.doFinal(bytes.copyOfRange(12, bytes.size))
                result.put("value", String(plaintext, StandardCharsets.UTF_8))
                plaintext.fill(0)
            }
            invoke.resolve(result)
        } catch (_: KeyPermanentlyInvalidatedException) {
            val id = runCatching { storageId(secureKey(invoke.getArgs())) }.getOrNull()
            if (id != null) preferences.edit().remove(id).apply()
            invoke.reject("Android Keystore key was invalidated", "KEY_INVALIDATED", null as JSObject?)
        } catch (error: Exception) {
            invoke.reject(error.message ?: "Secure storage read failed")
        }
    }

    @Command
    fun secureStorageSet(invoke: Invoke) {
        try {
            val args = invoke.getArgs()
            val id = storageId(secureKey(args))
            val value = args.getString("value")
            require(value.isNotEmpty() && value.toByteArray(StandardCharsets.UTF_8).size <= 65_536) { "Secure storage value is invalid" }
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.ENCRYPT_MODE, secretKey(alias(id)))
            val plaintext = value.toByteArray(StandardCharsets.UTF_8)
            val encrypted = cipher.doFinal(plaintext)
            val stored = cipher.iv + encrypted
            preferences.edit().putString(id, Base64.encodeToString(stored, Base64.NO_WRAP)).apply()
            plaintext.fill(0)
            encrypted.fill(0)
            stored.fill(0)
            invoke.resolve(empty())
        } catch (error: Exception) {
            invoke.reject(error.message ?: "Secure storage write failed")
        }
    }

    @Command
    fun secureStorageRemove(invoke: Invoke) {
        runCatching {
            val id = storageId(secureKey(invoke.getArgs()))
            preferences.edit().remove(id).apply()
            KeyStore.getInstance(KEYSTORE_PROVIDER).apply { load(null) }.deleteEntry(alias(id))
        }.onSuccess { invoke.resolve(empty()) }
            .onFailure { invoke.reject(it.message ?: "Secure storage removal failed") }
    }

    private fun biometricResult(): Pair<Boolean, String> {
        val authenticators = BiometricManager.Authenticators.BIOMETRIC_STRONG or
            BiometricManager.Authenticators.DEVICE_CREDENTIAL
        val result = BiometricManager.from(activity).canAuthenticate(authenticators)
        return (result == BiometricManager.BIOMETRIC_SUCCESS) to when (result) {
            BiometricManager.BIOMETRIC_SUCCESS -> "available"
            BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED -> "No biometric or device credential is enrolled"
            BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE -> "No biometric hardware is present"
            else -> "Biometric authentication is unavailable"
        }
    }

    @Command
    fun biometricAvailability(invoke: Invoke) {
        val (available, reason) = biometricResult()
        invoke.resolve(JSObject()
            .put("status", if (available) availability("available") else availability("unavailable", reason))
            .put("kinds", if (available) listOf("fingerprint", "device-credential") else emptyList<String>())
            .put("enrolled", available))
    }

    @Command
    fun biometricPermission(invoke: Invoke) {
        invoke.resolveObject(if (biometricResult().first) "granted" else "unavailable")
    }

    @Command
    fun biometricRequestPermission(invoke: Invoke) {
        invoke.resolveObject(if (biometricResult().first) "granted" else "unavailable")
    }

    @Command
    fun biometricAuthenticate(invoke: Invoke) {
        val fragmentActivity = activity as? FragmentActivity
        if (fragmentActivity == null || !biometricResult().first) {
            invoke.resolve(JSObject().put("verified", false))
            return
        }
        val reason = invoke.getArgs().getString("reason").trim().take(160)
        if (reason.isEmpty()) {
            invoke.reject("Biometric reason is required")
            return
        }
        val completed = AtomicBoolean(false)
        val prompt = BiometricPrompt(fragmentActivity, ContextCompat.getMainExecutor(activity),
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    if (completed.compareAndSet(false, true)) invoke.resolve(JSObject().put("verified", true))
                }
                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    if (completed.compareAndSet(false, true)) invoke.resolve(JSObject().put("verified", false))
                }
            })
        val info = BiometricPrompt.PromptInfo.Builder()
            .setTitle("Confirm identity")
            .setSubtitle(reason)
            .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG or BiometricManager.Authenticators.DEVICE_CREDENTIAL)
            .build()
        prompt.authenticate(info)
    }

    @Command
    fun scannerAvailability(invoke: Invoke) {
        val hasCamera = activity.packageManager.hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY)
        val permission = permissionState(Manifest.permission.CAMERA)
        invoke.resolve(when {
            !hasCamera -> availability("unavailable", "No camera is available on this Android device")
            permission != "granted" -> availability("permission-required", permission = "camera")
            else -> availability("available")
        })
    }

    @Command
    fun scannerPermission(invoke: Invoke) = invoke.resolveObject(permissionState(Manifest.permission.CAMERA))

    @Command
    fun scannerRequestPermission(invoke: Invoke) {
        if (permissionState(Manifest.permission.CAMERA) == "granted") {
            invoke.resolveObject("granted")
            return
        }
        val host = activity as? MainActivity
        if (host == null) {
            invoke.reject("Camera permission cannot be requested by this activity")
            return
        }
        host.requestCameraPermission {
            invoke.resolveObject(permissionState(Manifest.permission.CAMERA))
        }
    }

    @Command
    fun scannerScan(invoke: Invoke) {
        if (permissionState(Manifest.permission.CAMERA) != "granted") {
            invoke.reject("Camera permission is not granted")
            return
        }
        val options = invoke.getArgs().getJSObject("options")
        scannerCapture.start(
            options?.optJSONArray("formats"),
            if (options?.has("prompt") == true) options.getString("prompt") else null,
            onComplete = { capture ->
                if (capture == null) {
                    invoke.resolve(null)
                } else {
                    invoke.resolve(JSObject()
                        .put("value", capture.value)
                        .put("format", capture.format)
                        .put("capturedAt", capture.capturedAt))
                }
            },
            onError = { message -> invoke.reject(message) },
        )
    }

    @Command
    fun scannerCancel(invoke: Invoke) {
        scannerCapture.cancel()
        invoke.resolve(empty())
    }

    private fun shareAvailable(): Boolean = Intent(Intent.ACTION_SEND).setType("text/plain")
        .resolveActivity(activity.packageManager) != null

    @Command
    fun shareAvailability(invoke: Invoke) {
        invoke.resolve(if (shareAvailable()) availability("available") else availability("unavailable", "No Android share target is installed"))
    }

    @Command
    fun sharePermission(invoke: Invoke) = invoke.resolveObject(if (shareAvailable()) "granted" else "unavailable")

    @Command
    fun shareRequestPermission(invoke: Invoke) = sharePermission(invoke)

    @Command
    fun share(invoke: Invoke) {
        try {
            val payload = invoke.getArgs().getJSObject("payload") ?: throw IllegalArgumentException("Share payload is required")
            val attachments = payload.optJSONArray("attachments")
            require(attachments == null || attachments.length() == 0) { "Attachment ids are not available in this build" }
            val text = listOf(payload.optString("text"), payload.optString("url")).filter { it.isNotBlank() }.joinToString("\n")
            require(text.isNotBlank()) { "Share payload has no content" }
            val intent = Intent(Intent.ACTION_SEND)
                .setType("text/plain")
                .putExtra(Intent.EXTRA_SUBJECT, payload.getString("title").take(160))
                .putExtra(Intent.EXTRA_TEXT, text)
            activity.startActivity(Intent.createChooser(intent, payload.getString("title").take(160)))
            invoke.resolve(JSObject().put("completed", true))
        } catch (error: Exception) {
            invoke.reject(error.message ?: "Share failed")
        }
    }

    @Command
    fun notificationAvailability(invoke: Invoke) {
        val state = permissionState(Manifest.permission.POST_NOTIFICATIONS)
        invoke.resolve(if (state == "granted") availability("available") else availability("permission-required", permission = "notifications"))
    }

    @Command
    fun notificationPermission(invoke: Invoke) = invoke.resolveObject(permissionState(Manifest.permission.POST_NOTIFICATIONS))

    @Command
    fun notificationRequestPermission(invoke: Invoke) {
        if (Build.VERSION.SDK_INT >= 33 && permissionState(Manifest.permission.POST_NOTIFICATIONS) != "granted") {
            ActivityCompat.requestPermissions(activity, arrayOf(Manifest.permission.POST_NOTIFICATIONS), 4102)
        }
        invoke.resolveObject(permissionState(Manifest.permission.POST_NOTIFICATIONS))
    }

    private fun notificationManager(): NotificationManager = activity.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    @Command
    fun notificationPost(invoke: Invoke) {
        try {
            require(permissionState(Manifest.permission.POST_NOTIFICATIONS) == "granted") { "Notification permission is not granted" }
            val value = invoke.getArgs().getJSObject("notification") ?: throw IllegalArgumentException("Notification is required")
            require(!value.has("scheduledFor") || value.isNull("scheduledFor")) { "Scheduled notifications are not enabled in this build" }
            val route = value.optString("route", "")
            require(route.isEmpty() || (route.startsWith("/") && !route.startsWith("/settings", true))) { "Notification route is invalid" }
            if (Build.VERSION.SDK_INT >= 26) {
                notificationManager().createNotificationChannel(NotificationChannel(NOTIFICATION_CHANNEL, "Omnix", NotificationManager.IMPORTANCE_DEFAULT))
            }
            val intent = Intent(activity, MainActivity::class.java).putExtra("omnixRoute", route)
            val pending = PendingIntent.getActivity(activity, value.getString("id").hashCode(), intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            val notification = NotificationCompat.Builder(activity, NOTIFICATION_CHANNEL)
                .setSmallIcon(co.ke.omnix.app.R.mipmap.ic_launcher)
                .setContentTitle(value.getString("title").take(160))
                .setContentText(value.getString("body").take(4096))
                .setContentIntent(pending)
                .setAutoCancel(true)
                .build()
            notificationManager().notify(value.getString("id").hashCode(), notification)
            invoke.resolve(empty())
        } catch (error: Exception) {
            invoke.reject(error.message ?: "Notification could not be posted")
        }
    }

    @Command
    fun notificationCancel(invoke: Invoke) {
        notificationManager().cancel(invoke.getArgs().getString("notificationId").hashCode())
        invoke.resolve(empty())
    }

    @Command
    fun meshAvailability(invoke: Invoke) {
        try {
            val (granted, permission) = OmnixMeshRuntime.availability(activity)
            invoke.resolve(if (granted) {
                availability("available")
            } else {
                availability("permission-required", permission = permission ?: "vpn")
            })
        } catch (_: Exception) {
            invoke.resolve(availability("unavailable", "The embedded Private Mesh backend is unavailable"))
        }
    }

    @Command
    fun meshStatus(invoke: Invoke) {
        OmnixMeshRuntime.reconcileConsent(activity)
        OmnixMeshRuntime.enforceLifecycle(activity)
        invoke.resolve(OmnixMeshRuntime.status(activity).json())
    }

    @Command
    fun meshStart(invoke: Invoke) {
        val request = invoke.getArgs().getJSObject("request")
        if (request == null) {
            invoke.reject("Private Mesh request is required")
            return
        }
        val accountId = runCatching { request.getString("accountId") }.getOrNull()
        val branchId = runCatching { request.getString("branchId") }.getOrNull()
        val enrollmentId = runCatching { request.getString("enrollmentId") }.getOrNull()
        if (accountId == null || branchId == null || enrollmentId == null ||
            !SAFE_KEY_PART.matches(accountId) || !SAFE_KEY_PART.matches(branchId) || !SAFE_KEY_PART.matches(enrollmentId)) {
            invoke.reject("Private Mesh request identifiers are invalid")
            return
        }

        val begin = {
            OmnixMeshService.ensureForeground(activity)
            OmnixMeshRuntime.start(activity, accountId, branchId, enrollmentId) { result ->
                result.onSuccess { invoke.resolve(it.json()) }
                    .onFailure { invoke.reject(it.message ?: "Private Mesh could not connect") }
            }
        }
        val consent = VpnService.prepare(activity)
        if (consent == null) {
            begin()
            return
        }
        val host = activity as? MainActivity
        if (host == null) {
            invoke.reject("Android VPN permission cannot be requested by this activity")
            return
        }
        host.requestVpnPermission(consent) { granted ->
            if (granted && VpnService.prepare(activity) == null) {
                begin()
            } else {
                invoke.resolve(PublicMeshState("permission-denied").json())
            }
        }
    }

    @Command
    fun meshStop(invoke: Invoke) {
        OmnixMeshRuntime.stop(activity) { result ->
            result.onSuccess { invoke.resolve(empty()) }
                .onFailure { invoke.reject(it.message ?: "Private Mesh could not stop") }
        }
    }

    @Command
    fun lifecycleCurrentState(invoke: Invoke) = invoke.resolveObject(lifecycleState)

    @Command
    fun lifecycleCompleteBack(invoke: Invoke) = invoke.resolve(empty())

    @Command
    fun apkUpdateAvailability(invoke: Invoke) {
        invoke.resolve(if (apkUpdater.isAvailable()) {
            availability("available")
        } else {
            availability("unavailable", "This build uses Play-managed updates")
        })
    }

    @Command
    fun apkUpdateStatus(invoke: Invoke) = invoke.resolve(apkUpdater.status())

    @Command
    fun apkUpdateStage(invoke: Invoke) {
        val request = invoke.getArgs().getJSObject("request")
        if (request == null) {
            invoke.reject("APK update request is required")
            return
        }
        apkUpdater.stage(
            request,
            resolve = { status -> invoke.resolve(status) },
            reject = { message -> invoke.reject(message) },
        )
    }

    @Command
    fun apkUpdateInstall(invoke: Invoke) {
        val releaseId = runCatching { invoke.getArgs().getString("releaseId") }.getOrNull()
        if (releaseId == null) {
            invoke.reject("Release id is required")
            return
        }
        apkUpdater.install(
            releaseId,
            resolve = { status -> invoke.resolve(status) },
            reject = { message -> invoke.reject(message) },
        )
    }

    @Command
    fun apkUpdateCancel(invoke: Invoke) {
        val releaseId = runCatching { invoke.getArgs().getString("releaseId") }.getOrNull()
        if (releaseId == null) {
            invoke.reject("Release id is required")
            return
        }
        apkUpdater.cancel(releaseId)
        invoke.resolve(empty())
    }

    override fun onResume() {
        lifecycleState = "active"
        trigger("lifecycle", JSObject().put("state", lifecycleState))
    }

    override fun onPause() {
        scannerCapture.cancel()
        lifecycleState = "inactive"
        trigger("lifecycle", JSObject().put("state", lifecycleState))
    }

    override fun onStop() {
        lifecycleState = "background"
        trigger("lifecycle", JSObject().put("state", lifecycleState))
    }

    override fun onNewIntent(intent: Intent) {
        val route = intent.getStringExtra("omnixRoute") ?: return
        if (route.startsWith("/") && !route.startsWith("/settings", true)) {
            trigger("notification-opened", JSObject().put("route", route).put("openedAt", Instant.now().toString()))
        }
    }
}
