# TASK-0029C: Linux CPython 3.12 wheel availability / offline resolution — evidence (2026-08-13)

- Status: **COMPLETED (part C) — awaiting Codex independent review (NOT
  self-accepted)**
- Authority: `DEC-0135` (product-owner authorization, 2026-08-12)
- Approved SPEC: `SPEC-0012 v0.2.0` (hash verified in part A)
- Execution owner: DeepSeek in PI through `opencode-go/deepseek-v4-flash`
  (gateway selector only, upstream identity not asserted)
- Review/acceptance owner: Codex architecture/review owner
- Repository state: `main`, intentionally dirty; all pre-existing work
  preserved.
- Scope: Linux `manylinux_2_17_x86_64` CPython 3.12 binary-artifact
  availability and offline-resolution check for the same fixed declarations.
  **This is NOT a Linux execution, service, or production verification. No
  Linux binary was executed; no production action; no commit/push.**

## 1. Acquisition (network: `https://pypi.org/simple` only)

- Command:
  `venv-a\Scripts\python.exe -m pip download --timeout 600 --retries 10
  --platform manylinux_2_17_x86_64 --implementation cp --python-version 312
  --abi cp312 --only-binary=:all: -r <ws>\requirements.txt -d
  <ws>\linux-wheelhouse` → **exit 0**.
- Note: the first attempt (no `--timeout`) failed with pip's default 15s read
  timeout on this slow link (`ReadTimeoutError`, exit 2, 0 files); with
  `--timeout 600 --retries 10` the acquisition completed (exit 0).
- Result: **39 artifacts** in `linux-wheelhouse` — every resolved package for
  the fixed declarations has a compatible Linux CPython 3.12 wheel (binary
  `manylinux_2_17_x86_64` / `manylinux2014` wheels for compiled packages;
  `py3-none-any` universal wheels for pure-Python packages). No source build
  was used or needed.

## 2. Platform version drift (key finding)

The Linux artifact set resolves **two packages to different versions** than
the native (Windows) set from part A:

| Package | Windows (part A) | Linux manylinux_2_17 cp312 | Reason |
|---|---|---|---|
| greenlet | 3.5.5 | **3.2.5** | greenlet 3.5.5 ships no `manylinux_2_17` cp312 wheel; `--only-binary=:all:` selects the newest version that has one (3.2.5 satisfies SQLAlchemy's `greenlet>=1` requirement) |
| argon2-cffi-bindings | 25.1.0 | **21.2.0** | argon2-cffi-bindings 25.1.0 ships no `manylinux_2_17` cp312 wheel; 21.2.0 satisfies argon2-cffi 25.1.0's requirement |

This is the concrete cross-platform reproducibility drift the package exists
to expose: without a resolved lock, the same fixed declarations select
different versions on different target platforms. Both selections are
successful resolutions; neither is a missing-wheel or source-build case.

## 3. Offline resolution checks (network disabled)

Methodology note: on this Windows host, the offline check must carry the same
target-platform flags as acquisition (`--platform manylinux_2_17_x86_64
--implementation cp --python-version 312 --abi cp312 --only-binary=:all:`),
otherwise pip rejects `manylinux` wheels as incompatible with the current
platform. A first attempt without those flags failed with "Could not find a
version that satisfies the requirement sqlalchemy==2.0.51 (from versions:
none)" (exit 1) — a host-platform artifact of the check invocation, not a
wheel-availability failure; the corrected checks below are authoritative.

| Check | Command | Exit | Result |
|---|---|---|---|
| A (fixed declarations) | `pip install --dry-run --ignore-installed --no-index --find-links <linux-wheelhouse> --platform manylinux_2_17_x86_64 --implementation cp --python-version 312 --abi cp312 --only-binary=:all: -r <ws>\requirements.txt` | 0 | "Would install" all 39 packages from the local Linux set only |
| B (hash-enforced lock) | same flags + `--require-hashes -r <ws>\linux-requirements.lock` | 0 | "Would install" all 39 packages; hashes verified against the local Linux files |

## 4. Linux wheel manifest (hash-manifest, 39 rows)

Exact content of the workspace manifest `linux-wheel-manifest.txt`:

| canonical_name | version | wheel_filename | sha256 | size_bytes |
|---|---|---|---|---|
| alembic | 1.18.4 | alembic-1.18.4-py3-none-any.whl | a5ed4adcf6d8a4cb575f3d759f071b03cd6e5c7618eb796cb52497be25bfe19a | 263893 |
| annotated-doc | 0.0.5 | annotated_doc-0.0.5-py3-none-any.whl | 117bac03a25ede5df5440e855b32d556049ca169ead221505badf432fed4b101 | 5302 |
| annotated-types | 0.8.0 | annotated_types-0.8.0-py3-none-any.whl | f072f4d804ea359e4eaf198b1af7a8b0943881a87f31bb764f8bf219bb9419e0 | 13427 |
| anyio | 4.14.2 | anyio-4.14.2-py3-none-any.whl | 9f505dda5ac9f0c8309b5e8bd445a8c2bf7246f3ce950121e45ea15bc41d1494 | 125813 |
| argon2-cffi | 25.1.0 | argon2_cffi-25.1.0-py3-none-any.whl | fdc8b074db390fccb6eb4a3604ae7231f219aa669a2652e0f20e16ba513d5741 | 14657 |
| argon2-cffi-bindings | 21.2.0 | argon2_cffi_bindings-21.2.0-cp36-abi3-manylinux_2_17_x86_64.manylinux2014_x86_64.whl | b746dba803a79238e925d9046a63aa26bf86ab2a2fe74ce6b009a1c3f5c8f2ae | 86168 |
| certifi | 2026.7.22 | certifi-2026.7.22-py3-none-any.whl | 62f22742b58a1a33014a2b6b706588a8d7e2a88ae7bd1a6ebe8c992928483775 | 136983 |
| cffi | 2.1.1 | cffi-2.1.1-cp312-cp312-manylinux2014_x86_64.manylinux_2_17_x86_64.whl | c1453022f490d2459a11819d83ad1d586e9ff65a12ac3e705ffebd46d3685dcf | 221822 |
| click | 8.4.2 | click-8.4.2-py3-none-any.whl | e6f9f66136c816745b9d65817da91d61d957fb16e02e4dcd0552553c5a197b76 | 119243 |
| colorama | 0.4.6 | colorama-0.4.6-py2.py3-none-any.whl | 4f1d9991f5acc0ca119f9d443620b77f9d6b33703e51011c16baf57afb285fc6 | 25335 |
| fastapi | 0.136.3 | fastapi-0.136.3-py3-none-any.whl | 3d2a69bdf04b7e9f3afa292c3bc7a98816bbfafa10bc9b45f3f3700d2f761620 | 117481 |
| greenlet | 3.2.5 | greenlet-3.2.5-cp312-cp312-manylinux2014_x86_64.manylinux_2_17_x86_64.whl | 45fcea7b697b91290b36eafc12fff479aca6ba6500d98ef6f34d5634c7119cbe | 655426 |
| h11 | 0.16.0 | h11-0.16.0-py3-none-any.whl | 63cf8bbe7522de3bf65932fda1d9c2772064ffb3dae62d55932da54b31cb6c86 | 37515 |
| httpcore | 1.0.9 | httpcore-1.0.9-py3-none-any.whl | 2d400746a40668fc9dec9810239072b40b4484b640a8c38fd654a024c7a1bf55 | 78784 |
| httpx | 0.28.1 | httpx-0.28.1-py3-none-any.whl | d909fcccc110f8c7faf814ca82a9a4d816bc5a6dbfea25d6591d6985b8ba59ad | 73517 |
| idna | 3.18 | idna-3.18-py3-none-any.whl | 7f952cbe720b688055e3f87de14f5c3e5fdaa8bc3928985c4077ca689de849a2 | 65455 |
| iniconfig | 2.3.0 | iniconfig-2.3.0-py3-none-any.whl | f631c04d2c48c52b84d0d0549c99ff3859c98df65b3101406327ecc7d53fbf12 | 7484 |
| itsdangerous | 2.2.0 | itsdangerous-2.2.0-py3-none-any.whl | c6242fc49e35958c8b15141343aa660db5fc54d4f13a1db01a3f5891b98700ef | 16234 |
| jinja2 | 3.1.4 | jinja2-3.1.4-py3-none-any.whl | bc5dd2abb727a5319567b7a813e6a2e7318c39f4f487cfe6c89c6f9c7d25197d | 133271 |
| mako | 1.4.1 | mako-1.4.1-py3-none-any.whl | a359d9a94a541213958742b2698d0a7757bb83551767bc468a74b9905aba9617 | 80010 |
| markupsafe | 3.0.3 | markupsafe-3.0.3-cp312-cp312-manylinux2014_x86_64.manylinux_2_17_x86_64.manylinux_2_28_x86_64.whl | d6dd0be5b5b189d31db7cda48b91d7e0a9795f31430b7f271219ab30f1d3ac9d | 22947 |
| packaging | 26.3 | packaging-26.3-py3-none-any.whl | d7193f7c8e4e93f444fde0262bf90af30e16fa0ad0ad44cb553c87339b23cd1c | 129956 |
| pluggy | 1.6.0 | pluggy-1.6.0-py3-none-any.whl | e920276dd6813095e9377c0bc5566d94c932c33b27a3e3945d8389c374dd4746 | 20538 |
| psycopg | 3.3.4 | psycopg-3.3.4-py3-none-any.whl | b6bbc25ccf05c8fad3b061d9db2ef0909a555171b84b07f29458a447253d679a | 213001 |
| psycopg-binary | 3.3.4 | psycopg_binary-3.3.4-cp312-cp312-manylinux2014_x86_64.manylinux_2_17_x86_64.whl | e7510c37550f91a187e3660a8cc50d4b760f8c3b8b2f89ebc5698cd2c7f2c85d | 5152995 |
| pycparser | 3.0 | pycparser-3.0-py3-none-any.whl | b727414169a36b7d524c1c3e31839a521725078d7b2ff038656844266160a992 | 48172 |
| pydantic | 2.12.5 | pydantic-2.12.5-py3-none-any.whl | e561593fccf61e8a20fc46dfc2dfe075b8be7d0188df33f221ad1f0139180f9d | 463580 |
| pydantic-core | 2.41.5 | pydantic_core-2.41.5-cp312-cp312-manylinux_2_17_x86_64.manylinux2014_x86_64.whl | eceb81a8d74f9267ef4081e246ffd6d129da5d87e37a77c9bde550cb04870c1c | 2075366 |
| pydantic-settings | 2.14.2 | pydantic_settings-2.14.2-py3-none-any.whl | a20c97b37910b6550d5ea50fbcc2d4187defe58cd57070b73863d069419c9440 | 61715 |
| pygments | 2.20.0 | pygments-2.20.0-py3-none-any.whl | 81a9e26dd42fd28a23a2d169d86d7ac03b46e2f8b59ed4698fb4785f946d0176 | 1231151 |
| pytest | 9.0.2 | pytest-9.0.2-py3-none-any.whl | 711ffd45bf766d5264d487b917733b453d917afd2b0ad65223959f59089f875b | 374801 |
| python-dotenv | 1.2.2 | python_dotenv-1.2.2-py3-none-any.whl | 1d8214789a24de455a8b8bd8ae6fe3c6b69a5e3d64aa8a8e5d68e694bbcb285a | 22101 |
| python-multipart | 0.0.22 | python_multipart-0.0.22-py3-none-any.whl | 2b2cd894c83d21bf49d702499531c7bafd057d730c201782048f7945d82de155 | 24579 |
| sqlalchemy | 2.0.51 | sqlalchemy-2.0.51-cp312-cp312-manylinux2014_x86_64.manylinux_2_17_x86_64.manylinux_2_28_x86_64.whl | 1d21ce524ab86c23046e992a5b81cb54c21079c6df6e78b8fc77d77cac70a6b9 | 3358470 |
| starlette | 1.6.0 | starlette-1.6.0-py3-none-any.whl | a86dd39d14bb45f85a3d18525215a9ef0cfd1f192ac793220e72598c90335f0c | 75969 |
| typing-extensions | 4.16.0 | typing_extensions-4.16.0-py3-none-any.whl | 481caa481374e813c1b176ada14e97f1f67a4539ce9cfeb3f350d78d6370c2e8 | 45571 |
| typing-inspection | 0.4.4 | typing_inspection-0.4.4-py3-none-any.whl | 65b8397ba37ccbce054456aaccddfc91e6e3083c92824df348d96ca832f3f147 | 14750 |
| tzdata | 2026.3 | tzdata-2026.3-py2.py3-none-any.whl | dc096730c87af6cab1b171c9d532be840741ff5d459015e7f6947bd7d7e54931 | 348168 |
| uvicorn | 0.43.0 | uvicorn-0.43.0-py3-none-any.whl | 46fac64f487fd968cd999e5e49efbbe64bd231b5bd8b4a0b482a23ebce499620 | 68591 |

## 5. No-log / no-secret / no-mutation attestation

- **NO LOG COMMAND RAN** — no `journalctl`, `systemctl status`, `tail`,
  `/var/log`, log file/query, or substitute.
- **NO SECRET WAS READ, PRINTED, COPIED, OR STORED** — no credential, private
  key, runtime-environment value, cookie, session, business row, database
  value, or HTTP body was accessed.
- **NO MUTATION** — no Linux binary was executed (cross-platform download
  only), no production/SSH action, no source/configuration write, no
  repository dependency change, no commit, push, reset, clean, or checkout.
  All Linux artifacts remain in the external workspace.

## 6. Not verified / boundaries

- This is **wheel availability / offline-resolution evidence only**. It is
  NOT a Linux runtime test, service check, production compatibility proof, or
  release-ready claim.
- The two version-drift packages (greenlet, argon2-cffi-bindings) mean a
  Linux environment built from this set differs from a Windows one built from
  the part-A set; any deployment decision must account for this.
- The part does not self-accept; Codex independent review is pending for the
  whole package.
