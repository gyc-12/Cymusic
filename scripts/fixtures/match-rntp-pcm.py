#!/usr/bin/env python3
"""Match a contiguous AVPlayer tap capture against a file decoded from byte zero.

Needs NumPy and ffmpeg. Does not trust currentTime or timeRange to choose the
reference audio location; normalized content correlation searches the full file.
Run the remote probe first, then obtain/decode a byte-identical local reference.
Every match must be strong and unique across an 8 kHz sub-sample phase search
and survive native-rate refinement. Independent segment resampling starts at
its own phase; testing only integer 8 kHz lags can reject identical native PCM
or hide a repeated passage at another phase.
Use --max-offset-samples 1 to require sample alignment with the tap's own timeline;
omit that bound to measure a baseline mismatch without accepting ambiguous PCM.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import subprocess

import numpy as np


COARSE_PHASES = tuple(index / 8 - 0.5 for index in range(8))


def decode(ffmpeg, args, raw=None):
    result = subprocess.run(
        [ffmpeg, "-hide_banner", "-loglevel", "error", *args],
        input=raw, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False,
    )
    if result.returncode:
        raise RuntimeError(f"ffmpeg decode failed ({result.returncode}); inspect media privately")
    return np.frombuffer(result.stdout, dtype="<f4").astype(np.float64)


def choose_segment(rows, earliest_host, duration):
    # Do not join PCM on opposite sides of a seek or a format/time discontinuity.
    for index, first in enumerate(rows):
        if first["hostSeconds"] < earliest_host or first.get("assetStartSeconds") is None:
            continue
        rate = first["sampleRate"]
        required = int(round(duration * rate))
        count = 0
        expected_time = first["assetStartSeconds"]
        expected_frame = first["frameOffset"]
        for row in rows[index:]:
            if (row["sampleRate"] != rate or row["frameOffset"] != expected_frame
                    or row.get("assetStartSeconds") is None
                    or abs(row["assetStartSeconds"] - expected_time) > max(0.002, 2 / rate)):
                break
            count += row["frameCount"]
            expected_frame += row["frameCount"]
            expected_time += row["frameCount"] / rate
            if count >= required:
                return first, required
    raise RuntimeError("No sufficiently long contiguous PCM segment after the settling period")


def normalized_scores(reference, query, rate):
    length = len(query)
    if length < rate or len(reference) < length:
        raise RuntimeError("Reference or capture is too short")
    query = query - query.mean()
    energy = np.dot(query, query)
    if energy / length < 1e-10:
        raise RuntimeError("Captured segment is silent or nearly silent")
    fft_length = 1 << (len(reference) + length - 2).bit_length()
    convolution = np.fft.irfft(
        np.fft.rfft(reference, fft_length) * np.fft.rfft(query[::-1], fft_length),
        fft_length,
    )
    numerators = convolution[length - 1:len(reference)]
    sums = np.concatenate(([0.0], np.cumsum(reference)))
    squares = np.concatenate(([0.0], np.cumsum(reference * reference)))
    window_sums = sums[length:] - sums[:-length]
    window_energy = squares[length:] - squares[:-length] - window_sums * window_sums / length
    return numerators / np.sqrt(np.maximum(window_energy, 1e-20) * energy)


def normalized_search(reference, query, rate):
    scores = normalized_scores(reference, query, rate)
    best = int(np.argmax(np.abs(scores)))
    correlation = float(scores[best])
    exclusion = int(rate * 0.5)
    other = np.abs(scores).copy()
    other[max(0, best - exclusion):min(len(other), best + exclusion + 1)] = 0
    return best / rate, correlation, float(other.max())


def phase_search(reference, query, rate):
    # A native segment's origin need not fall on the full reference's 8 kHz
    # grid. Fractional shifts of the band-limited query cover that phase without
    # consulting the tap timestamp or a proposed content location. Eight phases
    # limit the residual to 1/16 of a coarse sample; acceptance thresholds stay
    # unchanged. Padding and edge trimming exclude interpolation transients.
    if len(query) < rate:
        raise RuntimeError("Reference or capture is too short")
    padding = 256
    trim = min(64, (len(query) - rate) // 2)
    padded = np.pad(query, (padding, padding))
    fft_length = 1 << (len(padded) - 1).bit_length()
    spectrum = np.fft.rfft(padded, fft_length)
    frequencies = np.fft.rfftfreq(fft_length)
    candidates = []
    for phase in COARSE_PHASES:
        shifted = np.fft.irfft(
            spectrum * np.exp(2j * np.pi * frequencies * phase), fft_length,
        )[padding + trim:padding + len(query) - trim]
        scores = normalized_scores(reference, shifted, rate)
        best = int(np.argmax(np.abs(scores)))
        candidates.append((phase, scores, best))
    phase, scores, best = max(candidates, key=lambda entry: abs(entry[1][entry[2]]))
    position = best - trim - phase
    correlation = float(scores[best])
    # Every phase participates in uniqueness, not only the winning phase. Two
    # identical passages at different fractional lags must still be ambiguous.
    runner_up = 0.0
    for candidate_phase, candidate_scores, _ in candidates:
        center = position + trim + candidate_phase
        left = min(len(candidate_scores), max(0, math.ceil(center - rate * 0.5)))
        right = min(len(candidate_scores), max(0, math.floor(center + rate * 0.5) + 1))
        runner_up = max(
            runner_up,
            float(np.abs(candidate_scores[:left]).max(initial=0)),
            float(np.abs(candidate_scores[right:]).max(initial=0)),
        )
    return position / rate, correlation, runner_up, phase, trim


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("capture", type=Path, help="Directory containing the probe's three output files")
    parser.add_argument("reference", type=Path, help="Byte-identical, complete LOCAL media file")
    parser.add_argument("--ffmpeg", default="ffmpeg")
    parser.add_argument("--segment-seconds", type=float, default=3)
    parser.add_argument("--settle-seconds", type=float, default=0.35)
    parser.add_argument("--max-offset-samples", type=int, help="Fail if refined content differs from the tap timeline by more than this many native-rate samples")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if not args.reference.is_file():
        parser.error("reference must be a local file, never a remote URL")
    if args.segment_seconds < 1 or not math.isfinite(args.segment_seconds):
        parser.error("segment-seconds must be finite and at least 1")
    if args.settle_seconds < 0 or not math.isfinite(args.settle_seconds):
        parser.error("settle-seconds must be finite and nonnegative")
    if args.max_offset_samples is not None and args.max_offset_samples < 0:
        parser.error("max-offset-samples must be nonnegative")
    report = json.loads((args.capture / "report.json").read_text())
    rows = json.loads((args.capture / "buffers.json").read_text())
    if report["measurementValid"] is not True:
        raise RuntimeError("Probe marked capture invalid; do not report a seek result")
    seek = next((e for e in report["events"] if e["event"] == "seek-completed"), None)
    anchor = seek or next(e for e in report["events"] if e["event"] == "first-playing")
    if seek and not seek["finished"]:
        raise RuntimeError("Seek was interrupted")
    first, count = choose_segment(rows, anchor["hostSeconds"] + args.settle_seconds, args.segment_seconds)
    raw = np.fromfile(args.capture / "decoded.f32", dtype="<f4")
    begin = first["frameOffset"]
    segment = raw[begin:begin + count]
    if len(segment) != count or not np.isfinite(segment).all():
        raise RuntimeError("PCM is non-finite or its length does not match buffer metadata")
    match_rate = 8000
    query = decode(args.ffmpeg, [
        "-f", "f32le", "-ar", str(first["sampleRate"]), "-ac", "1", "-i", "pipe:0",
        "-ar", str(match_rate), "-ac", "1", "-f", "f32le", "pipe:1",
    ], segment.tobytes())
    # No -ss, input seek, AVAssetReader timeRange, or AVPlayer clock is used.
    reference = decode(args.ffmpeg, [
        "-i", str(args.reference), "-map", "0:a:0", "-ar", str(match_rate),
        "-ac", "1", "-f", "f32le", "pipe:1",
    ])
    seconds, correlation, runner_up, coarse_phase, coarse_trim = phase_search(reference, query, match_rate)
    strong_unique = abs(correlation) >= 0.95 and abs(correlation) - runner_up >= 0.05
    # Refine around the CONTENT match, never around the player's claimed time.
    # Decode the entire reference again from byte zero at the capture rate. This
    # avoids turning coarse resampling/grid error into a sample-accuracy claim.
    native_rate = int(round(first["sampleRate"]))
    native_reference = decode(args.ffmpeg, [
        "-i", str(args.reference), "-map", "0:a:0", "-ar", str(native_rate),
        "-ac", "1", "-f", "f32le", "pipe:1",
    ])
    coarse_sample = int(round(seconds * native_rate))
    radius = int(round(0.05 * native_rate))
    search_start = max(0, coarse_sample - radius)
    search_end = min(len(native_reference), coarse_sample + count + radius)
    refined_seconds, refined_correlation, _ = normalized_search(
        native_reference[search_start:search_end], segment.astype(np.float64), native_rate,
    )
    refined_sample = search_start + int(round(refined_seconds * native_rate))
    expected_sample = int(round(first["assetStartSeconds"] * native_rate))
    offset_samples = refined_sample - expected_sample
    refined_valid = strong_unique and abs(refined_correlation) >= 0.95
    within_bound = args.max_offset_samples is None or abs(offset_samples) <= args.max_offset_samples
    native_poll = min(report["polls"], key=lambda row: abs(row["hostSeconds"] - first["hostSeconds"]))
    requested = next((e["targetSeconds"] for e in report["events"] if e["event"] == "seek-requested"), None)
    result = {
        "referenceSHA256": hashlib.file_digest(args.reference.open("rb"), "sha256").hexdigest(),
        "referenceDurationSeconds": len(reference) / match_rate,
        "requestedSeekSeconds": requested,
        "segmentSeconds": len(query) / match_rate,
        "capturedFrameOffset": begin,
        "captureHostSeconds": first["hostSeconds"],
        "tapAssetStartSeconds": first["assetStartSeconds"],
        "nearestPlayerClockSeconds": native_poll["playerSeconds"],
        "decodedContentStartSeconds": seconds,
        "contentMinusTapTimelineSeconds": seconds - first["assetStartSeconds"],
        "normalizedCorrelation": correlation,
        "runnerUpOutsideHalfSecond": runner_up,
        "correlationGap": abs(correlation) - runner_up,
        "strongUniqueMatch": strong_unique,
        "coarseSampleRate": match_rate,
        "coarsePhaseCount": len(COARSE_PHASES),
        "coarsePhaseSamples": coarse_phase,
        "coarseEdgeTrimSamples": coarse_trim,
        "nativeSampleRate": native_rate,
        "refinedContentStartSample": refined_sample,
        "refinedContentStartSeconds": refined_sample / native_rate,
        "refinedCorrelation": refined_correlation,
        "contentMinusTapTimelineSamples": offset_samples,
        "contentMinusTapTimelineRefinedSeconds": offset_samples / native_rate,
        "maxOffsetSamples": args.max_offset_samples,
        "measurementValid": refined_valid,
        "alignmentPassed": refined_valid and within_bound if args.max_offset_samples is not None else None,
        "limits": [
            "The reference must contain exactly the same encoded song/edition as the remote response.",
            "Repeated choruses/silence may make a segment ambiguous; inspect the runner-up and use a longer segment.",
            "All sub-sample phases participate in the full-file coarse search and its ambiguity check; native-rate refinement remains mandatory.",
            "Tap runs ahead of hardware output; compare content against tap timeRange, not raw callback wall-clock time.",
            "One-sample accuracy is at the native capture rate; it is not an original-rate assertion if decoding resamples.",
            "Native host reproduction does not replace iOS App or physical-device validation.",
        ],
    }
    text = json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False)
    print(text)
    if args.output:
        args.output.write_text(text + "\n")
    if not refined_valid:
        raise SystemExit("PCM match is weak or ambiguous; this capture cannot establish content accuracy")
    if not within_bound:
        raise SystemExit("Decoded content exceeds the required tap-timeline alignment bound")


if __name__ == "__main__":
    main()
