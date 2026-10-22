# Changelog

All notable changes to AutopilotSnap. Generated on every push to `main` by `scripts/release.mjs`.

## [0.2.1] - 2026-10-22

### Fixes

- Push release tag explicitly; show version in footer

## [0.2.0] - 2026-10-22

### Features

- Version every push to main with changelog, tag and GitHub release

## [0.1.0] - 2026-10-22

First tracked release. Everything up to this point:

### Features

- Scan the Windows Autopilot Device Preparation QR code with the camera, or upload / drop images
- Batch mode: several images and devices in one CSV
- Review screen, send via share sheet (fallback: download plus `mailto:`), send-to-mobile dialog
- FAQ, how-to with screenshots, light/dark theme, msnugget branding and logo
- SEO: static fallback content, canonical, JSON-LD, robots.txt, sitemap.xml, llms.txt, FAQ on the home page
- Security headers and an enforced Content-Security-Policy; immutable caching for hashed assets

### Documentation

- README for end users, CLAUDE.md, credits to AutopilotQR (MIT)
