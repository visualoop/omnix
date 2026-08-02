package co.ke.omnix.app.mobile

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.ConnectivityManager
import android.net.Network
import android.net.VpnService
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import app.tauri.plugin.JSObject
import co.ke.omnix.app.MainActivity
import co.ke.omnix.app.R
import com.wireguard.android.backend.GoBackend
import com.wireguard.android.backend.Tunnel
import com.wireguard.config.Config
import com.wireguard.config.InetNetwork
import com.wireguard.config.Interface
import com.wireguard.config.Peer
import com.wireguard.crypto.Key
import com.wireguard.crypto.KeyPair
import org.json.JSONObject
import java.nio.charset.StandardCharsets
import java.security.KeyStore
import java.security.MessageDigest
import java.time.Instant
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import javax.crypto.KeyGenerator
import javax.crypto.Mac

private const val MESH_CHANNEL = "omnix-private-mesh"
private const val MESH_NOTIFICATION_ID = 7403
private const val MESH_STATE = "omnix.mesh.public-state.v1"
private const val SECURE_STORAGE = "omnix.mobile.secure.v1"
private const val KEYSTORE = "AndroidKeyStore"
private const val ACTION_START = "co.ke.omnix.app.mesh.START"
private const val ACTION_HOLD = "co.ke.omnix.app.mesh.HOLD"
private const val ACTION_STOP = "co.ke.omnix.app.mesh.STOP"
private const val EXTRA_ACCOUNT = "account"
private const val EXTRA_BRANCH = "branch"
private const val EXTRA_ENROLLMENT = "enrollment"
private const val TUNNEL_NAME = "omnix-mesh"
private const val LIFECYCLE_RECHECK_MILLIS = 60_000L
private val SAFE_ID = Regex("^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")
private val HOSTNAME = Regex("^(?=.{1,253}$)(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\\.)*[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$")

/** Public state is the only mesh material returned across Tauri IPC. */
internal data class PublicMeshState(
    val state: String = "disabled",
    val nodeId: String? = null,
    val hubName: String? = null,
    val lastHandshakeAt: String? = null,
) {
    fun json(): JSObject = JSObject()
        .put("state", state)
        .put("nodeId", nodeId ?: JSONObject.NULL)
        .put("hubName", hubName ?: JSONObject.NULL)
        .put("lastHandshakeAt", lastHandshakeAt ?: JSONObject.NULL)
}

private data class Ipv4Cidr(val address: Int, val prefix: Int) {
    private val mask: Int = if (prefix == 0) 0 else -1 shl (32 - prefix)
    val network: Int = address and mask

    fun contains(other: Ipv4Cidr): Boolean = other.prefix >= prefix && (other.network and mask) == network
    fun isPrivate(): Boolean {
        val first = address ushr 24 and 0xff
        val second = address ushr 16 and 0xff
        return first == 10 || (first == 172 && second in 16..31) || (first == 192 && second == 168)
    }

    override fun toString(): String = listOf(24, 16, 8, 0)
        .joinToString(".") { ((address ushr it) and 0xff).toString() } + "/$prefix"

    companion object {
        fun parse(value: String, label: String): Ipv4Cidr {
            val parts = value.split("/", limit = 2)
            require(parts.size == 2) { "$label must be an IPv4 CIDR" }
            val octets = parts[0].split('.')
            require(octets.size == 4) { "$label must be an IPv4 CIDR" }
            var address = 0
            for (octet in octets) {
                require(octet.isNotEmpty() && octet.length <= 3 && octet.all(Char::isDigit)) { "$label is invalid" }
                val number = octet.toInt()
                require(number in 0..255 && (octet == "0" || !octet.startsWith('0'))) { "$label is invalid" }
                address = (address shl 8) or number
            }
            val prefix = parts[1].toIntOrNull()
            require(prefix != null && prefix in 1..32) { "$label prefix is invalid" }
            return Ipv4Cidr(address, prefix)
        }
    }
}

private data class Enrollment(
    val accountId: String,
    val branchId: String,
    val enrollmentId: String,
    val nodeId: String,
    val hubName: String,
    val keyId: String,
    val expectedDevicePublicKey: String?,
    val interfaceAddress: String,
    val peerPublicKey: String,
    val endpoint: String,
    val allowedIps: List<String>,
    val keepaliveSeconds: Int,
    val retiredKeyId: String?,
) {
    companion object {
        fun read(context: Context, accountId: String, branchId: String, enrollmentId: String): Enrollment {
            require(SAFE_ID.matches(accountId) && SAFE_ID.matches(branchId) && SAFE_ID.matches(enrollmentId)) {
                "Private Mesh request identifiers are invalid"
            }
            val token = MeshSecureTokenStore.read(context, accountId, enrollmentId)
            val version = token.optInt("version", 0)
            require(version == 1) { "Private Mesh enrollment version is unsupported" }
            require(token.getString("accountId") == accountId) { "Private Mesh account does not match enrollment" }
            require(token.getString("branchId") == branchId) { "Private Mesh branch does not match enrollment" }

            val lifecycle = token.getString("status")
            if (lifecycle == "revoked") {
                MeshKeyCustody.revoke(token, accountId)
                throw SecurityException("Private Mesh credential is revoked")
            }
            require(lifecycle in setOf("approved", "active", "rotation_pending")) {
                "Private Mesh enrollment is not approved"
            }
            val expiresAt = token.optString("expiresAt").takeIf(String::isNotBlank)?.let(Instant::parse)
            require(expiresAt == null || !Instant.now().isAfter(expiresAt)) { "Private Mesh enrollment has expired" }

            val currentKeyId = requiredId(token, "keyId")
            var keyId = currentKeyId
            var retiredKeyId: String? = null
            var expectedPublicKey = token.optString("devicePublicKey").takeIf(String::isNotBlank)
            if (lifecycle == "rotation_pending") {
                val deadline = Instant.parse(token.getString("rotationDeadline"))
                val activateNext = token.optBoolean("activateNextKey", false)
                if (activateNext) {
                    keyId = requiredId(token, "nextKeyId")
                    retiredKeyId = currentKeyId
                    expectedPublicKey = token.optString("nextDevicePublicKey").takeIf(String::isNotBlank)
                } else {
                    require(!Instant.now().isAfter(deadline)) { "Private Mesh key rotation is required" }
                }
            }

            val pool = Ipv4Cidr.parse(token.getString("meshSubnet"), "Mesh subnet")
            require(pool.isPrivate() && pool.prefix in 8..30) { "Mesh subnet must be a private IPv4 pool" }
            val address = Ipv4Cidr.parse(token.getString("interfaceAddress"), "Mesh interface address")
            require(address.prefix == 32 && pool.contains(address)) { "Mesh interface address is outside the approved pool" }

            val routes = token.getJSONArray("allowedIps")
            require(routes.length() in 1..32) { "Private Mesh must have bounded approved routes" }
            val allowedIps = (0 until routes.length()).map { index ->
                val route = Ipv4Cidr.parse(routes.getString(index), "Allowed route")
                require(route.isPrivate() && pool.contains(route)) { "Allowed route is outside the approved private mesh subnet" }
                require(route.prefix != 0) { "A default route is forbidden" }
                route.toString()
            }.distinct()
            require(allowedIps.none { it == "0.0.0.0/0" || it == "::/0" }) { "A default route is forbidden" }

            val peerPublicKey = token.getString("peerPublicKey")
            Key.fromBase64(peerPublicKey)
            expectedPublicKey?.let { Key.fromBase64(it) }
            val endpoint = validateEndpoint(token.getString("endpoint"))
            val keepalive = token.optInt("persistentKeepaliveSeconds", 25)
            require(keepalive in 1..120) { "Private Mesh keepalive is invalid" }
            return Enrollment(
                accountId = accountId,
                branchId = branchId,
                enrollmentId = enrollmentId,
                nodeId = requiredId(token, "nodeId"),
                hubName = token.getString("hubName").trim().also { require(it.isNotEmpty() && it.length <= 256) },
                keyId = keyId,
                expectedDevicePublicKey = expectedPublicKey,
                interfaceAddress = address.toString(),
                peerPublicKey = peerPublicKey,
                endpoint = endpoint,
                allowedIps = allowedIps,
                keepaliveSeconds = keepalive,
                retiredKeyId = retiredKeyId,
            )
        }

        private fun requiredId(value: JSONObject, name: String): String = value.getString(name).also {
            require(SAFE_ID.matches(it)) { "Private Mesh $name is invalid" }
        }

        private fun validateEndpoint(value: String): String {
            require(value.length in 3..320 && !value.contains('/') && !value.contains('@')) { "Private Mesh endpoint is invalid" }
            val host: String
            val portText: String
            if (value.startsWith('[')) {
                val closing = value.indexOf(']')
                require(closing > 1 && closing + 2 < value.length && value[closing + 1] == ':') { "Private Mesh endpoint is invalid" }
                host = value.substring(1, closing)
                portText = value.substring(closing + 2)
                require(host.contains(':')) { "Private Mesh endpoint is invalid" }
            } else {
                val colon = value.lastIndexOf(':')
                require(colon > 0 && value.indexOf(':') == colon) { "Private Mesh endpoint is invalid" }
                host = value.substring(0, colon)
                portText = value.substring(colon + 1)
                val ipv4 = runCatching { Ipv4Cidr.parse("$host/32", "Endpoint") }.isSuccess
                require(ipv4 || HOSTNAME.matches(host)) { "Private Mesh endpoint host is invalid" }
            }
            val port = portText.toIntOrNull()
            require(port != null && port in 1..65535) { "Private Mesh endpoint port is invalid" }
            return value
        }
    }
}

/** Reads only an AES-GCM encrypted enrollment token from app-private preferences. */
private object MeshSecureTokenStore {
    fun read(context: Context, accountId: String, enrollmentId: String): JSONObject {
        val digest = MessageDigest.getInstance("SHA-256").digest("mesh:$accountId:$enrollmentId".toByteArray(StandardCharsets.UTF_8))
        val id = Base64.encodeToString(digest, Base64.NO_WRAP or Base64.URL_SAFE or Base64.NO_PADDING)
        digest.fill(0)
        val encoded = context.getSharedPreferences(SECURE_STORAGE, Context.MODE_PRIVATE).getString(id, null)
            ?: throw IllegalStateException("Private Mesh enrollment token is missing")
        val encrypted = Base64.decode(encoded, Base64.NO_WRAP)
        require(encrypted.size > 28) { "Private Mesh enrollment token is invalid" }
        val store = KeyStore.getInstance(KEYSTORE).apply { load(null) }
        val wrappingKey = store.getKey("omnix.mobile.$id", null) as? javax.crypto.SecretKey
            ?: throw IllegalStateException("Private Mesh enrollment key is missing")
        val cipher = javax.crypto.Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(javax.crypto.Cipher.DECRYPT_MODE, wrappingKey, javax.crypto.spec.GCMParameterSpec(128, encrypted.copyOfRange(0, 12)))
        val clear = cipher.doFinal(encrypted.copyOfRange(12, encrypted.size))
        encrypted.fill(0)
        return try {
            JSONObject(String(clear, StandardCharsets.UTF_8))
        } finally {
            clear.fill(0)
        }
    }
}

/** The only durable private credential is a non-exportable Android Keystore HMAC key. */
private object MeshKeyCustody {
    private fun alias(accountId: String, keyId: String): String {
        val digest = MessageDigest.getInstance("SHA-256").digest("$accountId:$keyId".toByteArray(StandardCharsets.UTF_8))
        return "omnix.mesh.wg." + Base64.encodeToString(digest, Base64.NO_WRAP or Base64.URL_SAFE or Base64.NO_PADDING)
            .also { digest.fill(0) }
    }

    fun keyPair(accountId: String, keyId: String): KeyPair {
        val keyAlias = alias(accountId, keyId)
        val store = KeyStore.getInstance(KEYSTORE).apply { load(null) }
        var key = store.getKey(keyAlias, null) as? javax.crypto.SecretKey
        if (key == null) {
            val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_HMAC_SHA256, KEYSTORE)
            generator.init(
                KeyGenParameterSpec.Builder(keyAlias, KeyProperties.PURPOSE_SIGN)
                    .setDigests(KeyProperties.DIGEST_SHA256)
                    .setKeySize(256)
                    .build(),
            )
            key = generator.generateKey()
        }
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(key)
        val seed = mac.doFinal("omnix-wireguard-device-key-v1:$accountId:$keyId".toByteArray(StandardCharsets.UTF_8))
        seed[0] = (seed[0].toInt() and 248).toByte()
        seed[31] = ((seed[31].toInt() and 127) or 64).toByte()
        return try {
            KeyPair(Key.fromBytes(seed))
        } finally {
            seed.fill(0)
        }
    }

    fun revoke(token: JSONObject, accountId: String) {
        val store = KeyStore.getInstance(KEYSTORE).apply { load(null) }
        for (field in listOf("keyId", "nextKeyId")) {
            token.optString(field).takeIf(SAFE_ID::matches)?.let { store.deleteEntry(alias(accountId, it)) }
        }
    }

    fun retire(accountId: String, keyId: String?) {
        if (keyId == null) return
        KeyStore.getInstance(KEYSTORE).apply { load(null) }.deleteEntry(alias(accountId, keyId))
    }
}

private class OmnixTunnel : Tunnel {
    override fun getName(): String = TUNNEL_NAME
    override fun onStateChange(newState: Tunnel.State) {
        OmnixMeshRuntime.onBackendState(newState)
    }
}

internal object OmnixMeshRuntime {
    private val executor = Executors.newSingleThreadExecutor()
    private val reconnecting = AtomicBoolean(false)
    private val tunnel = OmnixTunnel()
    @Volatile private var backend: GoBackend? = null
    @Volatile private var active: Enrollment? = null
    @Volatile private var publicState = PublicMeshState()
    @Volatile private var applicationContext: Context? = null

    fun availability(context: Context): Pair<Boolean, String?> = try {
        if (VpnService.prepare(context) == null) true to null else false to "vpn"
    } catch (_: Exception) {
        false to "vpn"
    }

    fun status(context: Context): PublicMeshState {
        applicationContext = context.applicationContext
        if (active == null && publicState == PublicMeshState()) {
            publicState = readPublic(context)
        }
        val enrollment = active
        val currentBackend = backend
        if (enrollment != null && currentBackend != null && currentBackend.getState(tunnel) == Tunnel.State.UP) {
            val latest = runCatching {
                currentBackend.getStatistics(tunnel).peers().mapNotNull { peer ->
                    currentBackend.getStatistics(tunnel).peer(peer)?.latestHandshakeEpochMillis()?.takeIf { it > 0 }
                }.maxOrNull()
            }.getOrNull()
            if (latest != null) {
                publicState = publicState.copy(state = if (System.currentTimeMillis() - latest <= 180_000) "connected" else "degraded", lastHandshakeAt = Instant.ofEpochMilli(latest).toString())
                persistPublic(context, publicState)
            }
        } else if (desired(context) && VpnService.prepare(context) != null) {
            publicState = publicState.copy(state = "disabled")
            persistPublic(context, publicState)
        }
        return publicState
    }

    fun start(context: Context, accountId: String, branchId: String, enrollmentId: String, complete: (Result<PublicMeshState>) -> Unit = {}) {
        publicState = PublicMeshState("starting")
        persistPublic(context, publicState)
        executor.execute {
            complete(runCatching {
                require(VpnService.prepare(context) == null) { "Android VPN permission is required" }
                val enrollment = Enrollment.read(context, accountId, branchId, enrollmentId)
                val old = active
                if (old != null && (old.accountId != accountId || old.branchId != branchId || old.enrollmentId != enrollmentId)) {
                    backend?.setState(tunnel, Tunnel.State.DOWN, null)
                    active = null
                }
                val keyPair = MeshKeyCustody.keyPair(accountId, enrollment.keyId)
                val actualPublicKey = keyPair.publicKey.toBase64()
                require(enrollment.expectedDevicePublicKey == null || MessageDigest.isEqual(
                    actualPublicKey.toByteArray(StandardCharsets.US_ASCII),
                    enrollment.expectedDevicePublicKey.toByteArray(StandardCharsets.US_ASCII),
                )) { "Private Mesh enrollment is bound to another device key" }
                val config = buildConfig(enrollment, keyPair)
                val currentBackend = backend ?: GoBackend(context.applicationContext).also { backend = it }
                active = enrollment
                rememberDesired(context, enrollment)
                currentBackend.setState(tunnel, Tunnel.State.UP, config)
                MeshKeyCustody.retire(accountId, enrollment.retiredKeyId)
                publicState = PublicMeshState("connected", enrollment.nodeId, enrollment.hubName, null)
                persistPublic(context, publicState)
                publicState
            }.onFailure {
                active = null
                publicState = PublicMeshState("disabled")
                persistPublic(context, publicState)
                forgetDesired(context)
                context.stopService(Intent(context, OmnixMeshService::class.java))
            })
        }
    }

    fun stop(context: Context, forget: Boolean = true, complete: (Result<Unit>) -> Unit = {}) {
        executor.execute {
            complete(runCatching {
                backend?.let { if (it.getState(tunnel) == Tunnel.State.UP) it.setState(tunnel, Tunnel.State.DOWN, null) }
                active = null
                publicState = PublicMeshState()
                persistPublic(context, publicState)
                if (forget) forgetDesired(context)
                context.stopService(Intent(context, OmnixMeshService::class.java))
                Unit
            })
        }
    }

    fun restore(context: Context) {
        val state = context.getSharedPreferences(MESH_STATE, Context.MODE_PRIVATE)
        if (!state.getBoolean("desired", false) || VpnService.prepare(context) != null) return
        val accountId = state.getString(EXTRA_ACCOUNT, null) ?: return
        val branchId = state.getString(EXTRA_BRANCH, null) ?: return
        val enrollmentId = state.getString(EXTRA_ENROLLMENT, null) ?: return
        start(context, accountId, branchId, enrollmentId)
    }

    fun networkChanged(context: Context) {
        if (!desired(context) || !reconnecting.compareAndSet(false, true)) return
        executor.execute {
            try {
                val enrollment = active ?: return@execute
                val currentBackend = backend ?: return@execute
                if (currentBackend.getState(tunnel) == Tunnel.State.UP) currentBackend.setState(tunnel, Tunnel.State.DOWN, null)
                val config = buildConfig(enrollment, MeshKeyCustody.keyPair(enrollment.accountId, enrollment.keyId))
                currentBackend.setState(tunnel, Tunnel.State.UP, config)
                MeshKeyCustody.retire(enrollment.accountId, enrollment.retiredKeyId)
            } catch (_: Exception) {
                publicState = publicState.copy(state = "degraded")
                persistPublic(context, publicState)
            } finally {
                reconnecting.set(false)
            }
        }
    }

    fun enforceLifecycle(context: Context) {
        val current = active ?: return
        executor.execute {
            runCatching { Enrollment.read(context, current.accountId, current.branchId, current.enrollmentId) }
                .onSuccess { updated ->
                    if (updated.keyId != current.keyId) {
                        active = updated
                        networkChanged(context)
                    }
                }
                .onFailure { stop(context, forget = true) }
        }
    }

    fun reconcileConsent(context: Context) {
        applicationContext = context.applicationContext
        if (desired(context) && VpnService.prepare(context) != null) {
            stop(context, forget = false)
        }
    }

    fun onBackendState(state: Tunnel.State) {
        if (state == Tunnel.State.DOWN && active != null) {
            publicState = publicState.copy(state = "degraded")
            applicationContext?.let { persistPublic(it, publicState) }
        }
    }

    private fun buildConfig(enrollment: Enrollment, keyPair: KeyPair): Config {
        val iface = Interface.Builder()
            .setKeyPair(keyPair)
            .addAddress(InetNetwork.parse(enrollment.interfaceAddress))
            .build()
        val peerBuilder = Peer.Builder()
            .setPublicKey(Key.fromBase64(enrollment.peerPublicKey))
            .parseEndpoint(enrollment.endpoint)
            .setPersistentKeepalive(enrollment.keepaliveSeconds)
        enrollment.allowedIps.forEach { peerBuilder.addAllowedIp(InetNetwork.parse(it)) }
        return Config.Builder().setInterface(iface).addPeer(peerBuilder.build()).build()
    }

    private fun desired(context: Context): Boolean = context.getSharedPreferences(MESH_STATE, Context.MODE_PRIVATE).getBoolean("desired", false)

    private fun rememberDesired(context: Context, enrollment: Enrollment) {
        context.getSharedPreferences(MESH_STATE, Context.MODE_PRIVATE).edit()
            .putBoolean("desired", true)
            .putString(EXTRA_ACCOUNT, enrollment.accountId)
            .putString(EXTRA_BRANCH, enrollment.branchId)
            .putString(EXTRA_ENROLLMENT, enrollment.enrollmentId)
            .apply()
    }

    private fun forgetDesired(context: Context) {
        context.getSharedPreferences(MESH_STATE, Context.MODE_PRIVATE).edit().clear().apply()
    }

    private fun persistPublic(context: Context, state: PublicMeshState) {
        publicState = state
        context.getSharedPreferences(MESH_STATE, Context.MODE_PRIVATE).edit()
            .putString("publicState", state.state)
            .putString("nodeId", state.nodeId)
            .putString("hubName", state.hubName)
            .putString("lastHandshakeAt", state.lastHandshakeAt)
            .apply()
    }

    private fun readPublic(context: Context): PublicMeshState {
        val state = context.getSharedPreferences(MESH_STATE, Context.MODE_PRIVATE)
        return PublicMeshState(
            state = state.getString("publicState", null) ?: "disabled",
            nodeId = state.getString("nodeId", null),
            hubName = state.getString("hubName", null),
            lastHandshakeAt = state.getString("lastHandshakeAt", null),
        )
    }
}

/** Keeps the VPN process foreground and reconnects it after Doze or a default-network handoff. */
class OmnixMeshService : Service() {
    private val connectivity by lazy { getSystemService(ConnectivityManager::class.java) }
    private val power by lazy { getSystemService(PowerManager::class.java) }
    private var networkCallback: ConnectivityManager.NetworkCallback? = null
    private val lifecycleHandler = Handler(Looper.getMainLooper())
    private val lifecycleCheck = object : Runnable {
        override fun run() {
            OmnixMeshRuntime.reconcileConsent(this@OmnixMeshService)
            OmnixMeshRuntime.enforceLifecycle(this@OmnixMeshService)
            lifecycleHandler.postDelayed(this, LIFECYCLE_RECHECK_MILLIS)
        }
    }
    private val idleReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            if (intent.action == PowerManager.ACTION_DEVICE_IDLE_MODE_CHANGED && !power.isDeviceIdleMode) {
                OmnixMeshRuntime.networkChanged(context)
                OmnixMeshRuntime.enforceLifecycle(context)
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        startForeground(MESH_NOTIFICATION_ID, notification())
        registerReceiver(idleReceiver, IntentFilter(PowerManager.ACTION_DEVICE_IDLE_MODE_CHANGED))
        networkCallback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) = OmnixMeshRuntime.networkChanged(this@OmnixMeshService)
            override fun onLost(network: Network) = OmnixMeshRuntime.networkChanged(this@OmnixMeshService)
        }.also { connectivity.registerDefaultNetworkCallback(it) }
        lifecycleHandler.postDelayed(lifecycleCheck, LIFECYCLE_RECHECK_MILLIS)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> OmnixMeshRuntime.stop(this)
            ACTION_HOLD -> Unit
            ACTION_START -> {
                val account = intent.getStringExtra(EXTRA_ACCOUNT)
                val branch = intent.getStringExtra(EXTRA_BRANCH)
                val enrollment = intent.getStringExtra(EXTRA_ENROLLMENT)
                if (account != null && branch != null && enrollment != null) OmnixMeshRuntime.start(this, account, branch, enrollment)
                else OmnixMeshRuntime.restore(this)
            }
            else -> OmnixMeshRuntime.restore(this)
        }
        return START_STICKY
    }

    override fun onDestroy() {
        lifecycleHandler.removeCallbacks(lifecycleCheck)
        networkCallback?.let { runCatching { connectivity.unregisterNetworkCallback(it) } }
        runCatching { unregisterReceiver(idleReceiver) }
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun notification(): Notification {
        val manager = getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= 26) {
            manager.createNotificationChannel(NotificationChannel(MESH_CHANNEL, "Omnix Private Mesh", NotificationManager.IMPORTANCE_LOW).apply {
                description = "Shows while the private branch tunnel is connected"
                setShowBadge(false)
            })
        }
        val open = PendingIntent.getActivity(
            this,
            MESH_NOTIFICATION_ID,
            Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        return NotificationCompat.Builder(this, MESH_CHANNEL)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("Omnix Private Mesh")
            .setContentText("Connected to approved private branch routes")
            .setContentIntent(open)
            .setOngoing(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    companion object {
        fun ensureForeground(context: Context) {
            ContextCompat.startForegroundService(
                context,
                Intent(context, OmnixMeshService::class.java).setAction(ACTION_HOLD),
            )
        }

        fun start(context: Context, accountId: String, branchId: String, enrollmentId: String) {
            val intent = Intent(context, OmnixMeshService::class.java)
                .setAction(ACTION_START)
                .putExtra(EXTRA_ACCOUNT, accountId)
                .putExtra(EXTRA_BRANCH, branchId)
                .putExtra(EXTRA_ENROLLMENT, enrollmentId)
            ContextCompat.startForegroundService(context, intent)
        }
    }
}

/** Reconnects an explicitly enabled tunnel after Android finishes booting or the app is replaced. */
class OmnixMeshBootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED || intent.action == Intent.ACTION_MY_PACKAGE_REPLACED) {
            val state = context.getSharedPreferences(MESH_STATE, Context.MODE_PRIVATE)
            if (state.getBoolean("desired", false) && VpnService.prepare(context) == null) {
                ContextCompat.startForegroundService(context, Intent(context, OmnixMeshService::class.java).setAction(ACTION_START))
            }
        }
    }
}
