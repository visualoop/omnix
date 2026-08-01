package co.ke.omnix.app.mobile

import android.Manifest
import android.app.Activity
import android.content.ComponentName
import android.content.Intent
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import app.tauri.plugin.JSObject
import org.json.JSONObject
import java.io.BufferedInputStream
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URI
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.util.Locale
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

internal const val PINNED_RELEASE_CERTIFICATE_SHA256 = "c7f91eb28f7b6c6b23781382dc30b8c360cb2780d8c6b74db9ff07013fcd08bb"
private const val RELEASE_ENDPOINT = "https://omnix.co.ke/api/releases/latest"
private const val UPDATE_PREFERENCES = "omnix.mobile.updates.v1"
private val SAFE_RELEASE_ID = Regex("^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")
private val SHA256 = Regex("^[a-f0-9]{64}$")
private val UPDATE_HOSTS = setOf("omnix.co.ke", "media.omnix.co.ke")

internal class DirectApkUpdater(
    private val activity: Activity,
    private val emitProgress: (JSObject) -> Unit,
) {
    private val executor: ExecutorService = Executors.newSingleThreadExecutor()
    private val preferences = activity.getSharedPreferences(UPDATE_PREFERENCES, Activity.MODE_PRIVATE)
    private val cancelled = AtomicBoolean(false)
    private val lock = Any()
    private var activeConnection: HttpURLConnection? = null
    private var state = "idle"
    private var releaseId: String? = null
    private var downloadedBytes = 0L
    private var totalBytes = 0L
    private var errorCode: String? = null

    data class ReleaseManifest(
        val releaseId: String,
        val versionName: String,
        val versionCode: Long,
        val downloadUrl: String,
        val sha256: String,
        val signingCertificateSha256: String,
        val sizeBytes: Long,
    )

    init {
        val storedId = preferences.getString("releaseId", null)
        val storedSize = preferences.getLong("sizeBytes", 0L)
        if (storedId != null && SAFE_RELEASE_ID.matches(storedId) && verifiedApk(storedId).isFile && storedSize > 0L) {
            state = "ready"
            releaseId = storedId
            downloadedBytes = storedSize
            totalBytes = storedSize
        }
    }

    fun isAvailable(): Boolean {
        val requested = runCatching {
            activity.packageManager.getPackageInfo(activity.packageName, PackageManager.GET_PERMISSIONS)
                .requestedPermissions
                ?.contains(Manifest.permission.REQUEST_INSTALL_PACKAGES) == true
        }.getOrDefault(false)
        return requested
    }

    fun status(): JSObject = synchronized(lock) { statusLocked() }

    fun stage(request: JSObject, resolve: (JSObject) -> Unit, reject: (String) -> Unit) {
        if (!isAvailable()) {
            reject("Direct APK updates are unavailable in this build")
            return
        }
        val supplied = try {
            parseManifest(request)
        } catch (error: Exception) {
            reject(error.message ?: "APK update request is invalid")
            return
        }
        if (supplied.signingCertificateSha256 != PINNED_RELEASE_CERTIFICATE_SHA256) {
            reject("APK release signer is not trusted")
            return
        }
        val installedVersion = installedVersionCode()
        if (supplied.versionCode <= installedVersion) {
            reject("APK version code must be newer than the installed app")
            return
        }
        synchronized(lock) {
            if (state == "downloading") {
                reject("Another APK update is already downloading")
                return
            }
            state = "downloading"
            releaseId = supplied.releaseId
            downloadedBytes = 0L
            totalBytes = supplied.sizeBytes
            errorCode = null
            cancelled.set(false)
            emitProgress(statusLocked())
        }
        executor.execute {
            val outcome = runCatching {
                verifyInstalledSigner()
                val published = fetchPublishedManifest(supplied.releaseId, installedVersion)
                require(published == supplied) { "Release metadata does not match the Omnix version endpoint" }
                val staged = downloadAndVerify(published)
                persistVerified(published, staged)
                synchronized(lock) {
                    state = "ready"
                    downloadedBytes = published.sizeBytes
                    totalBytes = published.sizeBytes
                    errorCode = null
                    statusLocked().also(emitProgress)
                }
            }
            outcome.onSuccess(resolve).onFailure { error ->
                val code = when {
                    cancelled.get() -> "CANCELLED"
                    error.message?.contains("sign", true) == true || error.message?.contains("certificate", true) == true -> "SIGNER_MISMATCH"
                    error.message?.contains("version", true) == true -> "VERSION_MISMATCH"
                    error.message?.contains("SHA-256", true) == true -> "HASH_MISMATCH"
                    error.message?.contains("size", true) == true || error.message?.contains("length", true) == true -> "SIZE_MISMATCH"
                    error.message?.contains("endpoint", true) == true || error.message?.contains("metadata", true) == true -> "MANIFEST_MISMATCH"
                    else -> "DOWNLOAD_FAILED"
                }
                synchronized(lock) {
                    state = "failed"
                    errorCode = code
                    statusLocked().also(emitProgress)
                }.also(resolve)
                pendingApk(supplied.releaseId).delete()
            }
        }
    }

    fun install(requestedReleaseId: String, resolve: (JSObject) -> Unit, reject: (String) -> Unit) {
        if (!isAvailable()) {
            reject("Direct APK updates are unavailable in this build")
            return
        }
        if (!SAFE_RELEASE_ID.matches(requestedReleaseId)) {
            reject("Release id is invalid")
            return
        }
        val manifest = try {
            storedManifest(requestedReleaseId)
        } catch (error: Exception) {
            reject(error.message ?: "Verified APK metadata is unavailable")
            return
        }
        executor.execute {
            val outcome = runCatching {
                verifyInstalledSigner()
                verifyArchive(verifiedApk(requestedReleaseId), manifest)
                if (Build.VERSION.SDK_INT >= 26 && !activity.packageManager.canRequestPackageInstalls()) {
                    synchronized(lock) {
                        state = "awaiting-user-consent"
                        releaseId = requestedReleaseId
                        downloadedBytes = manifest.sizeBytes
                        totalBytes = manifest.sizeBytes
                        errorCode = null
                    }
                    activity.runOnUiThread {
                        activity.startActivity(Intent(
                            Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                            Uri.parse("package:${activity.packageName}"),
                        ))
                    }
                    return@runCatching status()
                }

                val apk = verifiedApk(requestedReleaseId)
                val uri = FileProvider.getUriForFile(activity, "${activity.packageName}.files", apk)
                val installer = Intent(Intent.ACTION_VIEW)
                    .setDataAndType(uri, "application/vnd.android.package-archive")
                    .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
                val target = activity.packageManager.resolveActivity(installer, PackageManager.MATCH_DEFAULT_ONLY)
                    ?: throw IllegalStateException("Android package installer is unavailable")
                installer.component = ComponentName(target.activityInfo.packageName, target.activityInfo.name)
                activity.grantUriPermission(target.activityInfo.packageName, uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
                synchronized(lock) {
                    state = "installing"
                    releaseId = requestedReleaseId
                    downloadedBytes = manifest.sizeBytes
                    totalBytes = manifest.sizeBytes
                    errorCode = null
                }
                activity.runOnUiThread { activity.startActivity(installer) }
                status().also(emitProgress)
            }
            outcome.onSuccess(resolve).onFailure {
                synchronized(lock) {
                    state = "failed"
                    errorCode = "INSTALL_FAILED"
                    statusLocked().also(emitProgress)
                }.also(resolve)
            }
        }
    }

    fun cancel(requestedReleaseId: String) {
        if (!SAFE_RELEASE_ID.matches(requestedReleaseId)) return
        cancelled.set(true)
        synchronized(lock) {
            if (releaseId == requestedReleaseId) {
                activeConnection?.disconnect()
                activeConnection = null
                state = "idle"
                releaseId = null
                downloadedBytes = 0L
                totalBytes = 0L
                errorCode = null
                emitProgress(statusLocked())
            }
        }
        pendingApk(requestedReleaseId).delete()
        verifiedApk(requestedReleaseId).delete()
        if (preferences.getString("releaseId", null) == requestedReleaseId) preferences.edit().clear().apply()
    }

    fun close() {
        cancelled.set(true)
        synchronized(lock) { activeConnection?.disconnect() }
        executor.shutdownNow()
    }

    private fun parseManifest(value: JSObject): ReleaseManifest {
        val expected = setOf(
            "releaseId", "versionName", "versionCode", "downloadUrl", "sha256",
            "signingCertificateSha256", "sizeBytes",
        )
        require(value.keys().asSequence().toSet() == expected) { "APK update request contains unknown or missing fields" }
        val releaseId = value.getString("releaseId").trim()
        val versionName = value.getString("versionName").trim()
        val versionCode = value.getLong("versionCode")
        val downloadUrl = value.getString("downloadUrl").trim()
        val sha256 = value.getString("sha256").lowercase(Locale.ROOT)
        val signer = value.getString("signingCertificateSha256").lowercase(Locale.ROOT)
        val sizeBytes = value.getLong("sizeBytes")
        require(SAFE_RELEASE_ID.matches(releaseId)) { "Release id is invalid" }
        require(versionName.isNotEmpty() && versionName.length <= 64) { "Release version name is invalid" }
        require(versionCode > 0L) { "Release version code is invalid" }
        require(sizeBytes > 0L) { "APK size is invalid" }
        require(SHA256.matches(sha256) && SHA256.matches(signer)) { "APK verification digest is invalid" }
        validateDownloadUri(downloadUrl)
        return ReleaseManifest(releaseId, versionName, versionCode, downloadUrl, sha256, signer, sizeBytes)
    }

    private fun parsePublishedManifest(value: JSONObject): ReleaseManifest {
        val js = JSObject(value.toString())
        return parseManifest(js)
    }

    private fun validateDownloadUri(value: String) {
        val uri = URI(value)
        require(uri.scheme == "https" && uri.host?.lowercase(Locale.ROOT) in UPDATE_HOSTS) { "APK download host is not allowed" }
        require(uri.userInfo == null && uri.port == -1 && uri.fragment == null && uri.path.lowercase(Locale.ROOT).endsWith(".apk")) {
            "APK download URL is invalid"
        }
    }

    private fun fetchPublishedManifest(requestedReleaseId: String, installedVersion: Long): ReleaseManifest {
        val endpoint = "$RELEASE_ENDPOINT?platform=android&versionCode=$installedVersion&releaseId=${URLEncoder.encode(requestedReleaseId, StandardCharsets.UTF_8.name())}"
        val connection = openConnection(endpoint)
        return connection.useConnection {
            require(it.responseCode == HttpURLConnection.HTTP_OK) { "Omnix version endpoint rejected this release" }
            val body = it.inputStream.bufferedReader(StandardCharsets.UTF_8).use { reader ->
                val text = reader.readText()
                require(text.toByteArray(StandardCharsets.UTF_8).size <= 65_536) { "Release metadata is too large" }
                text
            }
            parsePublishedManifest(JSONObject(body))
        }
    }

    private fun downloadAndVerify(manifest: ReleaseManifest): File {
        val pending = pendingApk(manifest.releaseId)
        pending.parentFile?.mkdirs()
        pending.delete()
        val digest = MessageDigest.getInstance("SHA-256")
        val connection = openConnection(manifest.downloadUrl)
        synchronized(lock) { activeConnection = connection }
        try {
            connection.useConnection {
                require(it.responseCode == HttpURLConnection.HTTP_OK) { "APK download failed with HTTP ${it.responseCode}" }
                val declaredLength = it.contentLengthLong
                require(declaredLength == -1L || declaredLength == manifest.sizeBytes) { "APK content length does not match the release size" }
                BufferedInputStream(it.inputStream).use { input ->
                    FileOutputStream(pending).use { output ->
                        val buffer = ByteArray(64 * 1024)
                        var count = 0L
                        while (true) {
                            if (cancelled.get()) throw IllegalStateException("APK update was cancelled")
                            val read = input.read(buffer)
                            if (read < 0) break
                            count += read
                            require(count <= manifest.sizeBytes) { "APK exceeds the declared size" }
                            digest.update(buffer, 0, read)
                            output.write(buffer, 0, read)
                            synchronized(lock) {
                                downloadedBytes = count
                                if (count == manifest.sizeBytes || count % (256 * 1024) < read) emitProgress(statusLocked())
                            }
                        }
                        output.fd.sync()
                        require(count == manifest.sizeBytes) { "APK size does not match the release manifest" }
                    }
                }
            }
        } finally {
            synchronized(lock) { activeConnection = null }
            connection.disconnect()
        }
        require(digest.digest().toHex() == manifest.sha256) { "APK SHA-256 does not match the release manifest" }
        verifyArchive(pending, manifest)
        return pending
    }

    private fun verifyArchive(apk: File, manifest: ReleaseManifest) {
        require(apk.isFile && apk.length() == manifest.sizeBytes) { "Verified APK size is invalid" }
        val digest = MessageDigest.getInstance("SHA-256")
        apk.inputStream().buffered().use { input ->
            val buffer = ByteArray(64 * 1024)
            while (true) {
                val read = input.read(buffer)
                if (read < 0) break
                digest.update(buffer, 0, read)
            }
        }
        require(digest.digest().toHex() == manifest.sha256) { "Verified APK SHA-256 is invalid" }
        val info = activity.packageManager.getPackageArchiveInfo(apk.absolutePath, PackageManager.GET_SIGNING_CERTIFICATES)
            ?: throw IllegalArgumentException("Downloaded file is not a valid APK")
        require(info.packageName == activity.packageName) { "APK package identity does not match Omnix" }
        require(info.longVersionCode == manifest.versionCode && info.longVersionCode > installedVersionCode()) { "APK version code is invalid" }
        require(info.versionName == manifest.versionName) { "APK version name does not match the release manifest" }
        require(signerDigest(info) == PINNED_RELEASE_CERTIFICATE_SHA256) { "APK signing certificate is not trusted" }
        require(manifest.signingCertificateSha256 == PINNED_RELEASE_CERTIFICATE_SHA256) { "Release signer does not match the pinned certificate" }
    }

    private fun verifyInstalledSigner() {
        val installed = activity.packageManager.getPackageInfo(activity.packageName, PackageManager.GET_SIGNING_CERTIFICATES)
        require(signerDigest(installed) == PINNED_RELEASE_CERTIFICATE_SHA256) { "Installed app signing certificate is not trusted" }
    }

    private fun signerDigest(info: PackageInfo): String {
        val signers = info.signingInfo?.apkContentsSigners ?: emptyArray()
        require(signers.size == 1) { "APK must have exactly one current signer" }
        return MessageDigest.getInstance("SHA-256").digest(signers[0].toByteArray()).toHex()
    }

    private fun installedVersionCode(): Long = activity.packageManager
        .getPackageInfo(activity.packageName, 0)
        .longVersionCode

    private fun persistVerified(manifest: ReleaseManifest, pending: File): File {
        val target = verifiedApk(manifest.releaseId)
        target.parentFile?.mkdirs()
        target.delete()
        require(pending.renameTo(target)) { "Verified APK could not be moved into private staging" }
        preferences.edit()
            .putString("releaseId", manifest.releaseId)
            .putString("versionName", manifest.versionName)
            .putLong("versionCode", manifest.versionCode)
            .putString("downloadUrl", manifest.downloadUrl)
            .putString("sha256", manifest.sha256)
            .putString("signingCertificateSha256", manifest.signingCertificateSha256)
            .putLong("sizeBytes", manifest.sizeBytes)
            .commit()
        return target
    }

    private fun storedManifest(requestedReleaseId: String): ReleaseManifest {
        require(preferences.getString("releaseId", null) == requestedReleaseId) { "No verified APK is staged for this release" }
        return ReleaseManifest(
            requestedReleaseId,
            preferences.getString("versionName", null) ?: throw IllegalStateException("Verified APK version is missing"),
            preferences.getLong("versionCode", 0L),
            preferences.getString("downloadUrl", null) ?: throw IllegalStateException("Verified APK URL is missing"),
            preferences.getString("sha256", null) ?: throw IllegalStateException("Verified APK digest is missing"),
            preferences.getString("signingCertificateSha256", null) ?: throw IllegalStateException("Verified APK signer is missing"),
            preferences.getLong("sizeBytes", 0L),
        ).also {
            require(it.versionCode > 0L && it.sizeBytes > 0L) { "Verified APK metadata is invalid" }
        }
    }

    private fun openConnection(value: String): HttpURLConnection = (URI(value).toURL().openConnection() as HttpURLConnection).apply {
        instanceFollowRedirects = false
        connectTimeout = 15_000
        readTimeout = 30_000
        requestMethod = "GET"
        setRequestProperty("Accept", "application/json, application/vnd.android.package-archive")
        setRequestProperty("User-Agent", "Omnix-Android/${installedVersionCode()}")
    }

    private fun pendingApk(id: String) = File(activity.cacheDir, "updates/pending/$id.apk.part")
    private fun verifiedApk(id: String) = File(activity.cacheDir, "updates/verified/$id.apk")

    private fun statusLocked() = JSObject()
        .put("state", state)
        .put("releaseId", releaseId ?: JSONObject.NULL)
        .put("downloadedBytes", downloadedBytes)
        .put("totalBytes", totalBytes)
        .put("errorCode", errorCode ?: JSONObject.NULL)

    private fun ByteArray.toHex() = joinToString("") { "%02x".format(it) }

    private inline fun <T> HttpURLConnection.useConnection(block: (HttpURLConnection) -> T): T = try {
        block(this)
    } finally {
        disconnect()
    }
}
