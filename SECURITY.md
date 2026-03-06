# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| latest  | ✅        |

## Reporting a Vulnerability

**Please do not report security vulnerabilities via public GitHub issues.**

If you discover a security vulnerability, please report it by:

1. **Email**: Send details to the repository maintainers via GitHub's private vulnerability reporting feature (Security tab → "Report a vulnerability")
2. **Include**:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if you have one)

## What to Expect

- **Acknowledgment**: Within 48 hours
- **Initial assessment**: Within 5 business days
- **Fix timeline**: Depends on severity; critical issues are prioritized
- **Credit**: Reporters will be credited in the release notes (unless they prefer anonymity)

## Scope

The following are in scope:
- Authentication and authorization bypass
- Remote code execution
- SQL injection / data exfiltration
- XSS in the web UI
- Sensitive data exposure (API keys, PATs, user data)
- Security header misconfiguration

The following are out of scope:
- Vulnerabilities requiring physical access to the server
- Social engineering attacks
- Vulnerabilities in third-party dependencies (report those upstream)

## Security Hardening Notes

For production deployments, refer to the deployment guide in [README.md](README.md):
- Always rotate `JWT_SECRET` and `ENCRYPTION_KEY` from the defaults
- Run behind HTTPS (TLS termination at the reverse proxy level)
- Keep Docker images and npm dependencies updated
