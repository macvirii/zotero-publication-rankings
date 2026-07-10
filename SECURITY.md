# Security checks

Gitea Actions runs SonarQube and Semgrep CE on pushes to the default branch.

## Run Semgrep locally

With Docker:

```bash
docker run --rm -v "$PWD:/src" -w /src semgrep/semgrep:1.168.0 semgrep scan --config auto --error .
```

If the Semgrep CLI is already installed:

```bash
semgrep scan --config auto --error .
```

`--error` returns a non-zero status when findings are present, matching CI.
