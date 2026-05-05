# MAGXXIC VOT NO SMTP - System Compatibility

### 💻 Supported Operating Systems
- **Windows Server**: 2016, 2019, 2022 (Highly Recommended)
- **Windows Client**: 10, 11 (Pro/Enterprise recommended)
- **Linux**: Ubuntu 20.04+, Debian 10+, CentOS 7+ (Requires `npm install` and `node magxxic_sender.js`)
- **MacOS**: Catalina or newer

### 🔧 Minimum Hardware Requirements
- **CPU**: 1 vCPU (for up to 5 concurrent threads)
- **RAM**: 2 GB (standard operation)
- **Disk**: 500 MB free space

### 🚀 Recommended Hardware (High Speed)
- **CPU**: 4 vCPU+ (supports `max_threads: 20+`)
- **RAM**: 8 GB+
- **Bandwidth**: 100 Mbps symmetric

### 🌐 Network Requirements
- **Direct Sending**: Outbound Port 25 must be UNBLOCKED by the provider.
- **Proxy Sending**: Port 443/80 and Port 1080 (SOCKS5) must be open.
- **DNS**: Port 53 (UDP/TCP) must be open for MX resolution.

### 📦 Software Prerequisites
- **Node.js**: v16.0.0 or higher.
- **Python**: (Optional) Only needed if using custom scripts from the legacy folder.
- **Permissions**: Administrator/Root access to install dependencies.
