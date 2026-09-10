#!/usr/bin/env python3
"""Offline PCM-matcher regression controls using original temporary audio only.

Requires NumPy and ffmpeg. Starts no player, simulator, server or network request.
Run with --output /tmp/result.json to retain the small verification summary.
"""
import argparse
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile

import numpy as np


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ffmpeg", default="ffmpeg")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    matcher_path = Path(__file__).parent / "fixtures/match-rntp-pcm.py"
    sys.dont_write_bytecode = True
    spec = importlib.util.spec_from_file_location("pcm_matcher", matcher_path)
    matcher = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(matcher)
    rate = 44100
    rng = np.random.default_rng(20260910)
    results = []

    with tempfile.TemporaryDirectory(prefix="cymusic-pcm-controls-") as temporary:
        directory = Path(temporary)

        def reference(name, values):
            path = directory / (name + ".flac")
            subprocess.run([
                args.ffmpeg, "-v", "error", "-f", "f32le", "-ar", str(rate),
                "-ac", "1", "-i", "pipe:0", "-c:a", "flac", str(path),
            ], input=values.astype("<f4").tobytes(), capture_output=True, check=True)
            decoded = matcher.decode(args.ffmpeg, [
                "-i", str(path), "-ar", str(rate), "-ac", "1", "-f", "f32le", "pipe:1",
            ]).astype("<f4")
            return path, decoded

        original, decoded = reference("original", rng.uniform(-0.3, 0.3, 14 * rate))

        def control(name, start=3 * rate, *, media=original, pcm=decoded,
                    shift_seconds=0, bound=1, mutation=None, rejected=None):
            capture = directory / name
            capture.mkdir()
            segment = pcm[start:start + 4 * rate].copy()
            rows = [{
                "hostSeconds": 100 + index / 10,
                "assetStartSeconds": start / rate + index / 10 + shift_seconds,
                "assetDurationSeconds": 0.1, "frameOffset": index * 4410,
                "frameCount": 4410, "sampleRate": rate, "channels": 1,
                "sourceFlags": 0,
            } for index in range(40)]
            report = {
                "measurementValid": True,
                "events": [
                    {"event": "first-playing", "hostSeconds": 99},
                    {"event": "seek-requested", "hostSeconds": 99.5, "targetSeconds": start / rate},
                    {"event": "seek-completed", "hostSeconds": 99.6, "finished": True},
                ],
                "polls": [{"hostSeconds": 100, "playerSeconds": start / rate}],
            }
            if mutation:
                mutation(segment, rows, report)
            (capture / "decoded.f32").write_bytes(segment.tobytes())
            (capture / "buffers.json").write_text(json.dumps(rows))
            (capture / "report.json").write_text(json.dumps(report))
            command = [
                sys.executable, "-B", str(matcher_path), str(capture), str(media),
                "--ffmpeg", args.ffmpeg, "--settle-seconds", "0",
                "--output", str(capture / "match.json"),
            ]
            if bound is not None:
                command += ["--max-offset-samples", str(bound)]
            run = subprocess.run(command, capture_output=True, text=True)
            expected = 1 if rejected else 0
            assert run.returncode == expected, (name, run.returncode, run.stderr)
            if rejected:
                assert rejected in run.stderr, (name, run.stderr)
            result = json.loads((capture / "match.json").read_text()) if (capture / "match.json").exists() else {}
            if expected == 0:
                assert result["measurementValid"] is True, name
                assert result["contentMinusTapTimelineSamples"] == -round(shift_seconds * rate), name
                assert result["alignmentPassed"] == (True if bound is not None else None), name
            results.append({
                "case": name, "exitCode": run.returncode,
                "measurementValid": result.get("measurementValid"),
                "alignmentPassed": result.get("alignmentPassed"),
                "offsetSamples": result.get("contentMinusTapTimelineSamples"),
                "correlation": result.get("normalizedCorrelation"),
                "runnerUp": result.get("runnerUpOutsideHalfSecond"),
            })
            return result

        control("aligned-integer-grid")
        fractional_start = 3 * rate + 3
        # Independently demonstrate the old mathematical failure on exact PCM.
        coarse_reference = matcher.decode(args.ffmpeg, [
            "-i", str(original), "-ar", "8000", "-ac", "1", "-f", "f32le", "pipe:1",
        ])
        coarse_query = matcher.decode(args.ffmpeg, [
            "-f", "f32le", "-ar", str(rate), "-ac", "1", "-i", "pipe:0",
            "-ar", "8000", "-ac", "1", "-f", "f32le", "pipe:1",
        ], decoded[fractional_start:fractional_start + 3 * rate].tobytes())
        _, old_correlation, _ = matcher.normalized_search(coarse_reference, coarse_query, 8000)
        assert abs(old_correlation) < 0.95, "Fixture must expose integer-grid rejection"
        result = control("aligned-fractional-grid", start=fractional_start)
        assert result["strongUniqueMatch"] is True and result["coarsePhaseCount"] == 8

        control("offset-rejected", shift_seconds=10,
                rejected="Decoded content exceeds the required tap-timeline alignment bound")
        control("offset-measured-without-bound", shift_seconds=10, bound=None)
        control("silence-rejected", mutation=lambda pcm, *_: pcm.fill(0),
                rejected="Captured segment is silent or nearly silent")
        control("unrelated-content-rejected",
                mutation=lambda pcm, *_: np.copyto(pcm, rng.uniform(-0.3, 0.3, len(pcm)).astype("<f4")),
                rejected="PCM match is weak or ambiguous")

        def interrupt(_, __, report):
            report["events"][2]["finished"] = False

        control("interrupted-seek-rejected", mutation=interrupt, rejected="Seek was interrupted")
        control("invalid-capture-rejected",
                mutation=lambda _, __, report: report.update(measurementValid=False),
                rejected="Probe marked capture invalid")

        def discontinuity(_, rows, __):
            for row in rows[16:]:
                row["assetStartSeconds"] += 0.1

        control("discontinuous-capture-rejected", mutation=discontinuity,
                rejected="No sufficiently long contiguous PCM segment")

        passage = rng.uniform(-0.3, 0.3, 4 * rate)
        for phase_samples, name in [(0, "same-phase"), (3, "different-phase")]:
            values = rng.uniform(-0.3, 0.3, 14 * rate)
            values[rate:5 * rate] = passage
            values[6 * rate + phase_samples:10 * rate + phase_samples] = passage
            media, repeated = reference(name, values)
            result = control("ambiguous-" + name, start=rate, media=media, pcm=repeated,
                             rejected="PCM match is weak or ambiguous")
            assert result["runnerUpOutsideHalfSecond"] >= 0.95
            assert result["strongUniqueMatch"] is False

        def zero_tail(pcm, *_):
            pcm[round(1.7 * rate):] = 0

        control("partial-zero-pcm-rejected", mutation=zero_tail, rejected="PCM match is weak or ambiguous")

    summary = {
        "passed": len(results), "failed": 0,
        "integerGridExactPCMCorrelation": old_correlation,
        "thresholds": {"correlation": 0.95, "uniquenessGap": 0.05, "alignmentSamples": 1},
        "results": results,
        "limits": "Original offline measurement controls; no native playback or App acceptance.",
    }
    text = json.dumps(summary, indent=2, allow_nan=False)
    print(text)
    if args.output:
        args.output.write_text(text + "\n")


if __name__ == "__main__":
    main()
