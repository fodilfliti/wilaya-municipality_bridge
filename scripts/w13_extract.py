import argparse
import os
import re
from dataclasses import dataclass
from difflib import SequenceMatcher
import json
import csv
from pathlib import Path
import shutil

import numpy as np
import pytesseract
import cv2
from PIL import Image


@dataclass(frozen=True)
class Word:
    text: str
    left: int
    top: int
    width: int
    height: int
    line_key: tuple[int, int, int, int]  # (block, par, line, page)

    @property
    def x_center(self) -> float:
        return self.left + self.width / 2.0


def _clean_filename(name: str) -> str:
    name = re.sub(r"\s+", " ", name).strip()
    name = re.sub(r"[<>:\"/\\\\|?*]", "_", name)
    name = name.strip(" .")
    return name or "_"


def _norm_key(s: str) -> str:
    """Canonical key for fuzzy matching (case/space/punct-insensitive)."""
    s = s.lower().strip()
    s = re.sub(r"\b(commune|daira)\b", "", s, flags=re.IGNORECASE)
    s = re.sub(r"\s+", " ", s).strip()
    # keep only letters/numbers to collapse "BabElAssa" vs "Bab El Assa"
    s = re.sub(r"[^a-z0-9]+", "", s)
    return s


def _similar(a: str, b: str) -> float:
    return SequenceMatcher(None, a, b).ratio()


def _human_name_clean(s: str) -> str:
    """Keep only letters/spaces, collapse spaces, title-case."""
    s = s.replace("_", " ").strip()
    # Remove digits and punctuation; keep latin letters (OCR is mostly latin here)
    s = re.sub(r"[^A-Za-zÀ-ÿ ]+", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s.title()


def _split_order_prefix(name: str) -> tuple[str, str]:
    """Return (prefix, rest). Prefix like '001 - ' if present."""
    m = re.match(r"^(\d{3}\s*-\s*)(.+)$", name.strip())
    if not m:
        return "", name
    return m.group(1), m.group(2)


def _name_key_letters_only(s: str) -> str:
    _, rest = _split_order_prefix(s)
    s = _human_name_clean(rest).lower()
    s = re.sub(r"[^a-zà-ÿ]+", "", s)
    return s


def _merge_text_files(src: Path, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    existing: set[str] = set()
    if dst.exists():
        existing = {ln.strip() for ln in dst.read_text(encoding="utf-8", errors="ignore").splitlines() if ln.strip()}
    lines = [ln.strip() for ln in src.read_text(encoding="utf-8", errors="ignore").splitlines() if ln.strip()]
    if not lines:
        return
    with dst.open("a", encoding="utf-8", newline="") as f:
        for ln in lines:
            if ln not in existing:
                f.write(ln + os.linesep)
                existing.add(ln)


def cleanup_output(out_dir: Path) -> None:
    """Normalize and merge daira/commune folders/files inside out_dir/dairas."""
    dairas_root = out_dir / "dairas"
    if not dairas_root.exists():
        return

    # 1) Normalize daira folder names -> merged target folders
    folders = [p for p in dairas_root.iterdir() if p.is_dir()]

    # Choose canonical folder names by letters-only key, fuzzy merge if close.
    key_to_canon: dict[str, str] = {}
    for p in folders:
        prefix, rest = _split_order_prefix(p.name)
        cleaned = prefix + _human_name_clean(rest)
        key = _name_key_letters_only(cleaned)
        if not key:
            continue
        # Find existing close key (handles chetounne vs che_oune, maghnia vs magnnia)
        best_key = None
        best_score = 0.0
        for k in key_to_canon.keys():
            if key[0] != k[0]:
                continue
            sc = _similar(key, k)
            if sc > best_score:
                best_score = sc
                best_key = k
        if best_key is not None and best_score >= 0.85:
            # keep longer/more informative canonical name
            key_to_canon[key] = key_to_canon[best_key]
        else:
            key_to_canon[key] = cleaned

    def resolve_daira_folder(name: str) -> Path:
        prefix, rest = _split_order_prefix(name)
        cleaned = prefix + _human_name_clean(rest)
        key = _name_key_letters_only(cleaned)
        if not key:
            return dairas_root / _clean_filename(name)
        # find best match among canon keys
        best = None
        best_score = 0.0
        for k, canon in key_to_canon.items():
            if key and k and key[0] != k[0]:
                continue
            sc = _similar(key, k)
            if sc > best_score:
                best_score = sc
                best = canon
        if best is not None and best_score >= 0.85:
            return dairas_root / _clean_filename(best)
        return dairas_root / _clean_filename(cleaned)

    for p in folders:
        target = resolve_daira_folder(p.name)
        if target.resolve() == p.resolve():
            continue
        target.mkdir(parents=True, exist_ok=True)
        # merge files
        for f in p.glob("*.txt"):
            _merge_text_files(f, target / f.name)
        # after merge, remove old folder
        shutil.rmtree(p, ignore_errors=True)

    # 1b) Heuristic merge for known OCR issue:
    # If we have both "Ouled Mimoun" and something containing "Dziira" + "Ouled Mimoun",
    # treat "Dziira ..." as the daira and merge the other into it.
    folders2 = [p for p in dairas_root.iterdir() if p.is_dir()]
    ouled = None
    dziira_ouled = None
    for p in folders2:
        n = _human_name_clean(p.name).lower()
        if n == "ouled mimoun":
            ouled = p
        if "dziira" in n and "ouled mimoun" in n:
            dziira_ouled = p
    if ouled is not None and dziira_ouled is not None and ouled.exists() and dziira_ouled.exists():
        dziira_ouled.mkdir(parents=True, exist_ok=True)
        for f in ouled.glob("*.txt"):
            _merge_text_files(f, dziira_ouled / f.name)
        shutil.rmtree(ouled, ignore_errors=True)

    # 2) Normalize commune file names inside each daira
    for d in [p for p in dairas_root.iterdir() if p.is_dir()]:
        txts = [p for p in d.iterdir() if p.is_file() and p.suffix.lower() == ".txt"]
        # group by letters-only key; merge duplicates
        groups: dict[str, list[Path]] = {}
        for f in txts:
            if f.name.lower() == "daira_accounts.txt":
                groups.setdefault("__daira_accounts__", []).append(f)
                continue
            stem = f.stem
            prefix, rest = _split_order_prefix(stem)
            cleaned = prefix + _human_name_clean(rest)
            key = _name_key_letters_only(cleaned)
            if not key:
                # drop very noisy filenames (contain only punctuation/digits)
                continue
            groups.setdefault(key, []).append(f)

        for key, files in groups.items():
            if key == "__daira_accounts__":
                # merge all daira_accounts into one
                dst = d / "daira_accounts.txt"
                for f in files:
                    if f.resolve() == dst.resolve():
                        continue
                    _merge_text_files(f, dst)
                    try:
                        f.unlink()
                    except Exception:
                        pass
                continue

            # choose canonical filename: shortest (no extra junk) but readable
            pfx0, rest0 = _split_order_prefix(files[0].stem)
            canon_name = pfx0 + _human_name_clean(rest0)
            for f in files[1:]:
                pfx, rest = _split_order_prefix(f.stem)
                canon_name = _choose_better_name(canon_name, pfx + _human_name_clean(rest))
            dst = d / f"{_clean_filename(canon_name)}.txt"
            for f in files:
                if f.resolve() == dst.resolve():
                    continue
                _merge_text_files(f, dst)
                try:
                    f.unlink()
                except Exception:
                    pass

class _NameResolver:
    """Keeps stable folder/file names by fuzzy matching."""

    def __init__(self, daira_threshold: float = 0.85, commune_threshold: float = 0.80) -> None:
        self.daira_threshold = daira_threshold
        self.commune_threshold = commune_threshold
        self._daira_key_to_name: dict[str, str] = {}
        self._commune_key_to_name_by_daira: dict[str, dict[str, str]] = {}

    def resolve_daira(self, daira_raw: str) -> str:
        daira_raw = re.sub(r"^daira\s+", "", daira_raw, flags=re.IGNORECASE).strip()
        key = _norm_key(daira_raw)
        if not key:
            return daira_raw
        if key in self._daira_key_to_name:
            return self._daira_key_to_name[key]
        # fuzzy match existing
        best_key = None
        best_score = 0.0
        for k in self._daira_key_to_name.keys():
            # quick guard: first letter must match
            if key and k and key[0] != k[0]:
                continue
            sc = _similar(key, k)
            if sc > best_score:
                best_score = sc
                best_key = k
        if best_key is not None and best_score >= self.daira_threshold:
            return self._daira_key_to_name[best_key]
        # first time
        self._daira_key_to_name[key] = daira_raw
        self._commune_key_to_name_by_daira.setdefault(key, {})
        return daira_raw

    def resolve_commune(self, daira_resolved: str, commune_raw: str) -> str:
        commune_raw = re.sub(r"^commune\s+", "", commune_raw, flags=re.IGNORECASE).strip()
        dkey = _norm_key(daira_resolved)
        ckey = _norm_key(commune_raw)
        if not dkey or not ckey:
            return commune_raw
        by_daira = self._commune_key_to_name_by_daira.setdefault(dkey, {})
        if ckey in by_daira:
            # If we later see a better/longer version of the same name, keep it.
            by_daira[ckey] = _choose_better_name(by_daira[ckey], commune_raw)
            return by_daira[ckey]
        best_key = None
        best_score = 0.0
        for k in by_daira.keys():
            if ckey and k and ckey[0] != k[0]:
                continue
            sc = _similar(ckey, k)
            if sc > best_score:
                best_score = sc
                best_key = k
        if best_key is not None and best_score >= self.commune_threshold:
            by_daira[best_key] = _choose_better_name(by_daira[best_key], commune_raw)
            return by_daira[best_key]
        by_daira[ckey] = commune_raw
        return commune_raw


def _classify_username(username: str) -> str:
    """Return 'daira' | 'commune' | 'other'."""
    u = username.strip().upper()
    if not u:
        return "other"
    if u.startswith("D-"):
        return "daira"
    if u.startswith("W-"):
        return "other"
    if "CAB-" in u or u.startswith("MICLAT-CAB") or u.startswith("MILCAT-CAB"):
        return "other"
    if u.startswith("MICLAT-AN-") or u.startswith("MILCAT-AN-") or u.startswith("MILC-AN-"):
        return "commune"
    return "other"


def _commune_from_username(username: str) -> str:
    """Best-effort commune label from MICLAT-AN-* usernames."""
    u = username.strip()
    u_up = u.upper()
    m = re.match(r"^(?:MICLAT|MILCAT|MILC)-AN-(.+?)-(?:G|S)$", u_up)
    if not m:
        return ""
    core = m.group(1)
    # preserve original casing poorly available; title-case as a reasonable default
    core = core.replace("_", "-")
    core = core.replace("-", " ").strip()
    core = re.sub(r"\s+", " ", core)
    name = core.title()
    # Canonicalization: treat "* Centre" as the same commune.
    name = re.sub(r"\s+Centre$", "", name, flags=re.IGNORECASE).strip()
    return name


def _choose_better_name(existing: str, candidate: str) -> str:
    """Prefer the more informative/longer name (helps 'Bab El Assa' vs 'Bab El Assa Centre')."""
    if not existing:
        return candidate
    if not candidate:
        return existing
    e = existing.strip()
    c = candidate.strip()
    if len(c) > len(e):
        return c
    return e


def _kmeans_1d(x: np.ndarray, k: int, iters: int = 50) -> np.ndarray:
    # Deterministic init with quantiles.
    x = x.astype(np.float64)
    centers = np.quantile(x, np.linspace(0.05, 0.95, k))
    for _ in range(iters):
        d = np.abs(x[:, None] - centers[None, :])
        labels = np.argmin(d, axis=1)
        new_centers = centers.copy()
        for i in range(k):
            pts = x[labels == i]
            if len(pts) > 0:
                new_centers[i] = float(np.mean(pts))
        if np.allclose(new_centers, centers, atol=0.5):
            break
        centers = new_centers
    return centers


def _assign_columns(words: list[Word], k: int = 5) -> dict[int, int]:
    xs = np.array([w.x_center for w in words], dtype=np.float64)
    centers = _kmeans_1d(xs, k=k)
    centers_sorted = np.sort(centers)
    col_by_word_idx: dict[int, int] = {}
    for idx, w in enumerate(words):
        col = int(np.argmin(np.abs(centers_sorted - w.x_center))) + 1  # 1..k
        col_by_word_idx[idx] = col
    return col_by_word_idx


def _ocr_words(image: Image.Image, page_num: int) -> list[Word]:
    data = pytesseract.image_to_data(image, lang="eng", config="--psm 6", output_type=pytesseract.Output.DICT)
    out: list[Word] = []
    n = len(data["text"])
    for i in range(n):
        txt = (data["text"][i] or "").strip()
        if not txt:
            continue
        try:
            conf = float(data["conf"][i])
        except Exception:
            conf = -1.0
        if conf >= 0 and conf < 30:
            continue
        out.append(
            Word(
                text=txt,
                left=int(data["left"][i]),
                top=int(data["top"][i]),
                width=int(data["width"][i]),
                height=int(data["height"][i]),
                line_key=(int(data["block_num"][i]), int(data["par_num"][i]), int(data["line_num"][i]), page_num),
            )
        )
    return out


def _lines_from_words(words: list[Word]) -> dict[tuple[int, int, int, int], list[Word]]:
    lines: dict[tuple[int, int, int, int], list[Word]] = {}
    for w in words:
        lines.setdefault(w.line_key, []).append(w)
    for k in list(lines.keys()):
        lines[k].sort(key=lambda w: w.left)
    return lines


def _extract_table_rows(words: list[Word]) -> list[dict[int, str]]:
    # Filter out obvious headers by removing lines containing "username" or "entity_completename"
    lines = _lines_from_words(words)
    line_items = []
    for lk, ws in lines.items():
        text = " ".join(w.text for w in ws)
        t = text.lower()
        if "entity_completename" in t or re.fullmatch(r"username", t.strip()):
            continue
        line_items.append((lk, ws))

    # Column assignment based on all remaining words.
    flat_words = [w for _, ws in line_items for w in ws]
    if not flat_words:
        return []
    col_map = _assign_columns(flat_words, k=5)

    # Rebuild each line into 1..5 column strings.
    rows: list[dict[int, str]] = []
    idx = 0
    for _, ws in line_items:
        cols: dict[int, list[str]] = {i: [] for i in range(1, 6)}
        for _w in ws:
            col = col_map[idx]
            cols[col].append(_w.text)
            idx += 1
        row = {c: " ".join(cols[c]).strip() for c in cols}
        # Skip very short/empty lines
        if sum(1 for c in (2, 3, 5) if row.get(c)) == 0:
            continue
        rows.append(row)
    return rows


@dataclass
class ExtractionState:
    resolver: _NameResolver
    last_commune_by_daira_key: dict[str, str]
    daira_order: dict[str, int]
    commune_order_by_daira: dict[str, dict[str, int]]
    next_daira_num: int


def _new_state() -> ExtractionState:
    return ExtractionState(
        resolver=_NameResolver(daira_threshold=0.85, commune_threshold=0.80),
        last_commune_by_daira_key={},
        daira_order={},
        commune_order_by_daira={},
        next_daira_num=1,
    )


def _write_outputs(rows: list[dict[int, str]], out_dir: Path, state: ExtractionState) -> None:
    def _drop_trailing_single_letter(s: str) -> str:
        parts = s.split()
        if len(parts) >= 2 and len(parts[-1]) == 1:
            return " ".join(parts[:-1])
        return s

    def _append_row(path: Path, row_line: str) -> None:
        """Append one unique row line to a txt file."""
        path.parent.mkdir(parents=True, exist_ok=True)
        existing: set[str] = set()
        if path.exists():
            try:
                existing = {
                    ln.strip()
                    for ln in path.read_text(encoding="utf-8", errors="ignore").splitlines()
                    if ln.strip()
                }
            except Exception:
                existing = set()

        row_line = row_line.strip()
        if not row_line:
            return
        if row_line not in existing:
            with path.open("a", encoding="utf-8", newline="") as f:
                f.write(row_line + os.linesep)

    # Stable numbering by first appearance across ALL pages (state is shared).
    for r in rows:
        commune = _drop_trailing_single_letter((r.get(2) or "").strip())
        daira = _drop_trailing_single_letter((r.get(3) or "").strip())
        wilaya = (r.get(4) or "").strip()
        username = (r.get(5) or "").strip()
        page = int(r.get("_page", 0) or 0)
        y0 = r.get("_y0", "")
        y1 = r.get("_y1", "")

        # Some OCR rows incorrectly put the daira label in col 2 and leave col 3 empty.
        if not daira and commune.lower().startswith("daira "):
            daira = commune
            commune = ""

        # Ignore lines where both commune (col 2) and daira (col 3) are empty.
        if not commune and not daira:
            continue

        if not daira:
            continue

        daira_resolved = state.resolver.resolve_daira(daira)
        kind = _classify_username(username)
        daira_key = _norm_key(daira_resolved)

        # If OCR missed commune name for a commune-account row, reuse the last commune seen in this daira.
        # This handles cases where an "S" row has blank commune cell but belongs to the previous commune row.
        if not commune and kind == "commune":
            commune = state.last_commune_by_daira_key.get(daira_key, "") or (_commune_from_username(username) or commune)

        commune_resolved = state.resolver.resolve_commune(daira_resolved, commune) if commune else ""

        # Daira folder numbering
        if daira_key not in state.daira_order:
            state.daira_order[daira_key] = state.next_daira_num
            state.next_daira_num += 1
        daira_num = state.daira_order[daira_key]
        daira_prefix = f"{daira_num:03d} - {daira_resolved}"

        daira_dir = out_dir / "dairas" / _clean_filename(daira_prefix)
        daira_dir.mkdir(parents=True, exist_ok=True)

        if not username:
            continue

        # User-requested format: left side is exactly column 1 data.
        left_data = (r.get(1) or "").strip() or (commune_resolved if commune_resolved else daira_resolved)
        line = f"{left_data} ---> {username}"

        if kind == "daira":
            _append_row(daira_dir / "daira_accounts.txt", line)
            continue

        if kind == "commune" and commune_resolved:
            ckey = _norm_key(commune_resolved)
            cmap = state.commune_order_by_daira.setdefault(daira_key, {})
            if ckey not in cmap:
                cmap[ckey] = len(cmap) + 1
            cnum = cmap[ckey]
            commune_file = daira_dir / f"{_clean_filename(f'{cnum:03d} - {commune_resolved}')}.txt"
            _append_row(commune_file, line)
            state.last_commune_by_daira_key[daira_key] = commune_resolved
            continue

        # Fallback: follow original rule only when confident
        if not commune_resolved and commune == "":
            _append_row(daira_dir / "daira_accounts.txt", line)
            continue

        if commune_resolved:
            ckey = _norm_key(commune_resolved)
            cmap = state.commune_order_by_daira.setdefault(daira_key, {})
            if ckey not in cmap:
                cmap[ckey] = len(cmap) + 1
            cnum = cmap[ckey]
            commune_file = daira_dir / f"{_clean_filename(f'{cnum:03d} - {commune_resolved}')}.txt"
            _append_row(commune_file, line)
            state.last_commune_by_daira_key[daira_key] = commune_resolved


def _ocr_cell(cell_bgr: np.ndarray) -> str:
    if cell_bgr.size == 0:
        return ""
    gray = cv2.cvtColor(cell_bgr, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (3, 3), 0)
    thr = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]
    # For OCR, prefer black text on white background.
    if np.mean(thr) < 127:
        thr = cv2.bitwise_not(thr)
    pil = Image.fromarray(thr)
    txt = pytesseract.image_to_string(pil, lang="eng", config="--psm 7")
    txt = re.sub(r"\s+", " ", txt).strip()
    return txt


def _find_grid_boundaries(page_bgr: np.ndarray) -> tuple[list[int], list[int]]:
    """Return (x_boundaries, y_boundaries) sorted; include outer edges.

    Uses morphology to detect table vertical/horizontal lines.
    """
    gray = cv2.cvtColor(page_bgr, cv2.COLOR_BGR2GRAY)
    inv = cv2.bitwise_not(gray)
    bw = cv2.threshold(inv, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]

    h, w = bw.shape[:2]
    # Kernels tuned for scanned table lines.
    v_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (max(25, w // 40), 1))
    h_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, max(25, h // 40)))

    # Vertical lines: erode then dilate with a tall kernel.
    vertical = cv2.erode(bw, h_kernel, iterations=1)
    vertical = cv2.dilate(vertical, h_kernel, iterations=2)

    # Horizontal lines: erode then dilate with a wide kernel.
    horizontal = cv2.erode(bw, v_kernel, iterations=1)
    horizontal = cv2.dilate(horizontal, v_kernel, iterations=2)

    # Extract boundary positions from contours (more robust than projections on broken lines).
    x_bounds: list[int] = []
    v_cnts, _ = cv2.findContours(vertical, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    for c in v_cnts:
        x, y, ww, hh = cv2.boundingRect(c)
        if hh >= int(0.35 * h) and ww <= int(0.05 * w):
            x_bounds.append(x)
            x_bounds.append(x + ww)
    y_bounds: list[int] = []
    h_cnts, _ = cv2.findContours(horizontal, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    for c in h_cnts:
        x, y, ww, hh = cv2.boundingRect(c)
        if ww >= int(0.35 * w) and hh <= int(0.05 * h):
            y_bounds.append(y)
            y_bounds.append(y + hh)

    # De-duplicate close boundaries.
    def _dedupe(vals: list[int], eps: int = 6) -> list[int]:
        if not vals:
            return []
        vals = sorted(vals)
        out = [vals[0]]
        for v in vals[1:]:
            if abs(v - out[-1]) > eps:
                out.append(v)
        return out

    x_bounds = _dedupe(x_bounds)
    y_bounds = _dedupe(y_bounds)

    # Ensure outer boundaries exist.
    if not x_bounds or x_bounds[0] > 5:
        x_bounds = [0] + x_bounds
    if x_bounds[-1] < w - 5:
        x_bounds = x_bounds + [w - 1]
    if not y_bounds or y_bounds[0] > 5:
        y_bounds = [0] + y_bounds
    if y_bounds[-1] < h - 5:
        y_bounds = y_bounds + [h - 1]

    x_bounds = sorted(set(x_bounds))
    y_bounds = sorted(set(y_bounds))
    return x_bounds, y_bounds


def _choose_column_bounds(x_bounds: list[int], width: int) -> list[int]:
    # Group near-duplicate boundaries (grid line thickness / double edges).
    xs = sorted(set(int(x) for x in x_bounds if 0 <= x < width))
    if not xs:
        return [int(i * width / 5) for i in range(6)]

    grouped: list[list[int]] = []
    cur = [xs[0]]
    for v in xs[1:]:
        if abs(v - cur[-1]) <= 25:
            cur.append(v)
        else:
            grouped.append(cur)
            cur = [v]
    grouped.append(cur)
    centers = [int(round(float(np.mean(g)))) for g in grouped]
    centers = sorted(set(centers))

    # Ensure outer edges.
    if centers[0] > 10:
        centers = [0] + centers
    if centers[-1] < width - 10:
        centers = centers + [width - 1]

    # Target: 6 boundaries (5 columns). Choose 4 internal cuts from detected centers.
    left = 0
    right = width - 1
    internal = [c for c in centers if left + 150 < c < right - 150]
    internal = sorted(set(internal))
    if len(internal) >= 4:
        from itertools import combinations

        best = None
        best_score = None
        for combo in combinations(internal, 4):
            b = [left, *combo, right]
            widths = np.diff(np.array(b, dtype=np.float64))
            # Reject obviously wrong splits (too narrow column)
            if np.min(widths) < 120:
                continue
            score = float(np.min(widths) - np.std(widths))
            if best_score is None or score > best_score:
                best_score = score
                best = b
        if best is not None:
            return [int(v) for v in best]

    # Fallback: evenly spaced.
    return [int(i * width / 5) for i in range(6)]

    # Not enough detected; fallback.
    return [int(i * width / 5) for i in range(6)]


def _extract_rows_from_grid(page_bgr: np.ndarray) -> tuple[list[dict[int, str]], list[dict[int, str]]]:
    x_bounds, y_bounds = _find_grid_boundaries(page_bgr)

    h, w = page_bgr.shape[:2]
    x_bounds = _choose_column_bounds(x_bounds, width=w)

    # Reduce y bounds: keep lines and derive row segments; many scans have too many noisy lines.
    ys = np.array(y_bounds, dtype=np.float64)
    if len(ys) > 50:
        # Keep stronger boundaries: downsample by taking quantiles.
        keep = sorted(set(int(round(q)) for q in np.quantile(ys, np.linspace(0.02, 0.98, 20))))
        y_bounds = keep
    if len(y_bounds) < 3:
        return []

    raw_rows: list[dict[int, str]] = []
    kept_rows: list[dict[int, str]] = []
    # Iterate row segments; skip very short ones.
    for y0, y1 in zip(y_bounds[:-1], y_bounds[1:]):
        if y1 - y0 < 35:
            continue
        row: dict[int, str] = {}
        for col_idx in (1, 2, 3, 4, 5):
            x0 = x_bounds[col_idx - 1]
            x1 = x_bounds[col_idx]
            # inset a bit to avoid grid lines
            pad = 3
            cell = page_bgr[max(0, y0 + pad) : max(0, y1 - pad), max(0, x0 + pad) : max(0, x1 - pad)]
            row[col_idx] = _ocr_cell(cell)
        row["_y0"] = str(int(y0))
        row["_y1"] = str(int(y1))

        # Normalize common prefixes (French).
        def _norm(s: str) -> str:
            s = re.sub(r"[|]+", " ", s)
            s = re.sub(r"\s+", " ", s).strip()
            return s.strip(" -_.,;:")

        raw1 = row.get(1, "")
        raw2 = row.get(2, "")
        raw3 = row.get(3, "")
        raw4 = row.get(4, "")
        raw5 = row.get(5, "")

        col1 = _norm(raw1)
        commune = _norm(re.sub(r"^commune", "", raw2, flags=re.IGNORECASE))
        daira = _norm(re.sub(r"^daira", "", raw3, flags=re.IGNORECASE))
        col4 = _norm(raw4)
        col5_raw = _norm(raw5)

        def _extract_account(text: str) -> str:
            # Best-effort: take the last account-like token with dashes.
            # Example: MICLAT-AN-Ain-Nehla-G, D-Ain-Tellout-G, W-TLEMCEN-G
            m = re.findall(r"\b[0-9A-Za-z]+(?:-[0-9A-Za-z]+)+\b", text)
            return m[-1] if m else ""

        # If OCR mixes Wilaya (col4) and username, use Wilaya anchor and take what comes after.
        merged_45 = f"{col4} {col5_raw}".strip()
        lower_45 = merged_45.lower()
        username = ""
        if "wilaya" in lower_45 and "tlemcen" in lower_45:
            # Take substring after the wilaya phrase.
            after = re.split(r"wilaya\s*13\s*tlemcen", merged_45, flags=re.IGNORECASE, maxsplit=1)
            tail = after[1] if len(after) == 2 else merged_45
            username = _extract_account(tail)
        if not username:
            username = _extract_account(col5_raw) or _extract_account(merged_45)

        # Common OCR fixups for this document.
        username = username.replace("I MICLAT", "MICLAT").replace("I MILCAT", "MILCAT").strip()
        if username.startswith("I "):
            username = username[2:].strip()
        row["_raw2"] = _norm(raw2)
        row["_raw3"] = _norm(raw3)
        row["_raw4"] = _norm(raw4)
        row["_raw5"] = _norm(raw5)
        row["_raw1"] = _norm(raw1)
        row[1], row[2], row[3], row[4], row[5] = col1, commune, daira, col4, username

        raw_rows.append(dict(row))

        joined = f"{commune} {daira} {username}".lower()
        if "username" in joined or "entity_completename" in joined:
            continue
        # Keep only rows that have an account-like username.
        u = username.strip()
        if "-" not in u:
            continue

        kept_rows.append(row)
    return raw_rows, kept_rows


def _dump_rows(rows: list[dict[int, str]], out_dir: Path, page: int, *, label: str) -> None:
    dump_dir = out_dir / "_ocr_dump"
    dump_dir.mkdir(parents=True, exist_ok=True)

    jsonl_path = dump_dir / f"page_{page:02d}.{label}.jsonl"
    csv_path = dump_dir / f"page_{page:02d}.{label}.csv"

    # JSONL (best for debugging)
    with jsonl_path.open("w", encoding="utf-8", newline="\n") as f:
        for r in rows:
            obj = {
                "page": page,
                "y0": int(r.get("_y0", "0")),
                "y1": int(r.get("_y1", "0")),
                "raw_col1": r.get("_raw1", ""),
                "raw_col2": r.get("_raw2", ""),
                "raw_col3": r.get("_raw3", ""),
                "raw_col4": r.get("_raw4", ""),
                "raw_col5": r.get("_raw5", ""),
                "col1_data": r.get(1, ""),
                "col2_commune": r.get(2, ""),
                "col3_daira": r.get(3, ""),
                "col4_wilaya": r.get(4, ""),
                "col5_username": r.get(5, ""),
            }
            f.write(json.dumps(obj, ensure_ascii=False) + "\n")

    # CSV (easy to open)
    with csv_path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(
            f,
            fieldnames=[
                "page",
                "y0",
                "y1",
                "raw_col1",
                "raw_col2",
                "raw_col3",
                "raw_col4",
                "raw_col5",
                "col1_data",
                "col2_commune",
                "col3_daira",
                "col4_wilaya",
                "col5_username",
            ],
        )
        w.writeheader()
        for r in rows:
            w.writerow(
                {
                    "page": page,
                    "y0": r.get("_y0", ""),
                    "y1": r.get("_y1", ""),
                    "raw_col1": r.get("_raw1", ""),
                    "raw_col2": r.get("_raw2", ""),
                    "raw_col3": r.get("_raw3", ""),
                    "raw_col4": r.get("_raw4", ""),
                    "raw_col5": r.get("_raw5", ""),
                    "col1_data": r.get(1, ""),
                    "col2_commune": r.get(2, ""),
                    "col3_daira": r.get(3, ""),
                    "col4_wilaya": r.get(4, ""),
                    "col5_username": r.get(5, ""),
                }
            )


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf", default="W13.pdf")
    ap.add_argument("--page", type=int, default=1, help="1-based page number (ignored if --all-pages)")
    ap.add_argument("--all-pages", action="store_true", help="process all pages in the PDF")
    ap.add_argument("--out", default="out_w13", help="output directory")
    ap.add_argument("--dpi", type=int, default=300)
    ap.add_argument("--debug-image", action="store_true", help="write rendered page image to output dir")
    ap.add_argument("--dump-ocr", action="store_true", help="save OCR-extracted rows to out/_ocr_dump/")
    ap.add_argument("--cleanup-only", action="store_true", help="only cleanup an existing --out folder")
    args = ap.parse_args()

    pdf_path = Path(args.pdf)
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    if args.cleanup_only:
        cleanup_output(out_dir)
        print(f"cleaned {out_dir.resolve()}")
        return 0

    # Render page using PyMuPDF (installed as pymupdf / fitz).
    import fitz  # type: ignore

    doc = fitz.open(str(pdf_path))
    pages = range(doc.page_count) if args.all_pages else range(max(0, args.page - 1), max(0, args.page - 1) + 1)

    total_rows = 0
    state = _new_state()
    # Process sequentially into the same output folder so name merging/appending works across pages.
    for page_idx in pages:
        page_num = page_idx + 1
        page = doc.load_page(page_idx)
        pix = page.get_pixmap(dpi=args.dpi)
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)

        # This PDF is rotated; rotate for readable OCR.
        img = img.rotate(90, expand=True)
        if args.debug_image:
            img.save(out_dir / f"page_{page_num:02d}.png")

        page_bgr = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
        raw_rows, rows = _extract_rows_from_grid(page_bgr)
        for rr in raw_rows:
            rr["_page"] = str(page_num)
        for rr in rows:
            rr["_page"] = str(page_num)
        if args.dump_ocr:
            _dump_rows(raw_rows, out_dir=out_dir, page=page_num, label="raw")
            _dump_rows(rows, out_dir=out_dir, page=page_num, label="kept")
        _write_outputs(rows, out_dir=out_dir, state=state)
        total_rows += len(rows)

    cleanup_output(out_dir)
    print(f"wrote rows={total_rows} to {out_dir.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

