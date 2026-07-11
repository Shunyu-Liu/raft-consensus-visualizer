# GitHub Setup

This repository currently has no configured remote in the local workspace. Do not assume a GitHub URL until a remote is added.

## Recommended Repository Metadata

Description:

```text
Interactive educational visualization of the Raft consensus algorithm.
```

Topics:

```text
raft, consensus, distributed-systems, visualization, simulator, education, react, typescript, vite, leader-election, log-replication, network-partition
```

## GitHub Pages

1. Push the code to `main`.
2. Open the GitHub repository.
3. Go to Settings.
4. Go to Pages.
5. Under Build and deployment, set Source to GitHub Actions.
6. Open Actions.
7. Confirm the CI workflow is green.
8. Confirm the Deploy GitHub Pages workflow is green.
9. Open the deployment URL.
10. Verify `/#/simulator`.
11. Verify `/#/learn`.

The deploy workflow sets `VITE_BASE_PATH` to `/${{ github.event.repository.name }}/`, which matches GitHub Project Pages.

## Social Preview

GitHub social preview cannot be set through repository files. After real screenshots are available:

1. Open Settings.
2. Open General.
3. Find Social preview.
4. Upload the selected image.

## Manual Release

1. Confirm the release checklist.
2. Create a tag such as `v1.0.0`.
3. Draft a GitHub Release.
4. Summarize the educational simulator, Learn page, scenarios, and deployment status.
