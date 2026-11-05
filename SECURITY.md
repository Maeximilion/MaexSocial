# Security

Report vulnerabilities privately to the repository owner using GitHub private vulnerability reporting when enabled. If unavailable, request a private contact channel without disclosing the vulnerability in a public issue.

Never include credentials, customer information, account cookies or authenticated captures in issues or pull requests. Revoke exposed credentials promptly and assess history and artifacts separately from the current file contents.

Use GitHub-hosted runners, minimum workflow permissions and SHA-pinned actions. Fork workflows must not receive secrets. Never execute PR code in `pull_request_target` workflows.

The discovery repository has no production service or supported release yet. Future releases must define supported versions, incident ownership and tested recovery in the operations documentation.

Application access requirements and proposed G2 controls are in [access and security](docs/17_ACCESS_SECURITY.md). Repository scans do not prove tenant isolation, login security or safe administration. See [evaluation strategy](docs/08_EVALS.md) for the required behavioral tests.

The [upload-security contract](docs/security/uploads.md) covers future customer media handling. Current foundation CI applies a narrow SVG policy to repository artwork only; it is not an upload sanitizer. Hooks assist local workflow and do not establish a security sandbox. Review changes to the checker, hook scripts and registrations together with the assets they validate.
