#!/usr/bin/env python3
"""Generate original, indexed FLAC with intentionally nonuniform compression.

This tool never reads external audio and never plays sound. All source samples
are deterministic integer arithmetic: two swept oscillators, time-coded pulses,
and stateless seeded noise. Requires NumPy, the FLAC CLI, ffmpeg and ffprobe.
Generated media belongs outside the repository, not in a source-code commit.
"""
import argparse
from decimal import Decimal
import hashlib
import json
from pathlib import Path
import platform
import shutil
import subprocess

import numpy as np


RATE = 44100
CHANNELS = 2
BITS = 16
BLOCK = 4096
MASK32 = (1 << 32) - 1


def sine_q15(phase):
    """Integer Bhaskara-II approximation; no platform-dependent sin() calls."""
    half_phase = (phase & MASK32) >> 16
    x = half_phase & 32767
    product = x * (32768 - x)
    magnitude = (16 * product * 32767) // (5 * 32768 * 32768 - 4 * product)
    return np.where(half_phase < 32768, magnitude, -magnitude)


def noise_q15(indices, salt):
    # Every multiplication fits uint64 before the explicit 32-bit reduction.
    value = (indices.astype(np.uint64) + (salt & MASK32)) & np.uint64(MASK32)
    value = ((value ^ (value >> 16)) * np.uint64(0x7FEB352D)) & np.uint64(MASK32)
    value = ((value ^ (value >> 15)) * np.uint64(0x846CA68B)) & np.uint64(MASK32)
    value ^= value >> 16
    return (value >> 16).astype(np.int64) - 32768


def stages(profile, total_frames):
    # Q8 gains: each unit is 1/256 full-scale. Identical channels in the low
    # phases make mid/side compression effective; the high phases are independent.
    rising = [
        (0, 10, "low-entropy-mono", 0, 0, True),
        (10, 25, "medium-entropy-mono", 12, 12, True),
        (25, 65, "high-entropy-stereo", 105, 115, False),
        (65, 80, "low-entropy-mono-return", 2, 2, True),
        (80, 100, "highest-entropy-stereo", 125, 119, False),
    ]
    if profile == "constant":
        definitions = [(0, 100, "constant-entropy-stereo-control", 70, 70, False)]
    elif profile == "falling":
        definitions = [(100 - end, 100 - start, name, left, right, mono)
                       for start, end, name, left, right, mono in reversed(rising)]
    else:
        definitions = rising
    return [{
        "startFrame": total_frames * start // 100,
        "endFrame": total_frames * end // 100,
        "name": name, "leftNoiseGainQ8": left, "rightNoiseGainQ8": right,
        "identicalChannels": mono,
    } for start, end, name, left, right, mono in definitions]


def pcm_chunk(start, end, schedule, seed):
    indices = np.arange(start, end, dtype=np.int64)
    triangle_number = indices * (indices - 1) // 2
    # Integer DDS phases produce continuous, nonrepeating-in-the-fixture sweeps.
    phase_a = indices * ((110 << 32) // RATE) + 2 * triangle_number
    phase_b = indices * ((293 << 32) // RATE) - triangle_number
    carrier = (48 * sine_q15(phase_a) + 20 * sine_q15(phase_b)) // 256

    # Each second begins with ten ~25 ms FSK slots: nine counter bits plus parity.
    # A short ramp removes abrupt pulse edges; these are generated tones, not voice.
    second = indices // RATE
    within_second = indices % RATE
    slot_frames = RATE // 40
    slot = within_second // slot_frames
    within_slot = within_second % slot_frames
    code = second ^ (second >> 1)
    parity = np.zeros_like(code)
    for bit in range(9):
        parity ^= (code >> bit) & 1
    bit_value = np.where(slot == 9, parity, (code >> np.minimum(slot, 8)) & 1)
    marker_hz = np.where(bit_value == 0, 887, 1477)
    marker_phase = within_slot * ((marker_hz << 32) // RATE)
    ramp_frames = RATE // 500
    envelope = np.minimum(np.minimum(within_slot, slot_frames - 1 - within_slot), ramp_frames)
    marker = (sine_q15(marker_phase) * envelope * 12) // (ramp_frames * 256)
    carrier += np.where(slot < 10, marker, 0)

    noise_left = noise_q15(indices, seed)
    noise_right = noise_q15(indices, seed ^ 0x9E3779B9)
    left = np.empty(len(indices), dtype=np.int64)
    right = np.empty(len(indices), dtype=np.int64)
    for stage in schedule:
        selected = (indices >= stage["startFrame"]) & (indices < stage["endFrame"])
        if not selected.any():
            continue
        gain_left, gain_right = stage["leftNoiseGainQ8"], stage["rightNoiseGainQ8"]
        left[selected] = carrier[selected] + (noise_left[selected] * gain_left) // 256
        if stage["identicalChannels"]:
            right[selected] = left[selected]
        else:
            right[selected] = carrier[selected] + (noise_right[selected] * gain_right) // 256
    peak = int(max(np.abs(left).max(initial=0), np.abs(right).max(initial=0)))
    if peak > 32767:
        raise RuntimeError("Generator clipped; adjust gains instead of hiding the clipping")
    return np.column_stack([left, right]).astype("<i2").tobytes(), peak


def read_flac_metadata(path):
    blocks, points, stream = [], [], None
    with path.open("rb") as source:
        if source.read(4) != b"fLaC":
            raise RuntimeError("Encoder did not produce native FLAC")
        while True:
            header = source.read(4)
            if len(header) != 4:
                raise RuntimeError("Truncated metadata header")
            kind, length = header[0] & 127, int.from_bytes(header[1:], "big")
            data = source.read(length)
            if len(data) != length:
                raise RuntimeError("Truncated metadata block")
            blocks.append({"type": kind, "length": length})
            if kind == 0:
                packed = int.from_bytes(data[10:18], "big")
                stream = {
                    "minBlockSize": int.from_bytes(data[0:2], "big"),
                    "maxBlockSize": int.from_bytes(data[2:4], "big"),
                    "sampleRate": packed >> 44,
                    "channels": ((packed >> 41) & 7) + 1,
                    "bitsPerSample": ((packed >> 36) & 31) + 1,
                    "totalSamples": packed & ((1 << 36) - 1),
                    "pcmMD5": data[18:34].hex(),
                }
            elif kind == 3:
                if length % 18:
                    raise RuntimeError("Malformed SEEKTABLE length")
                for index in range(0, length, 18):
                    sample = int.from_bytes(data[index:index + 8], "big")
                    if sample == (1 << 64) - 1:
                        raise RuntimeError("Unexpected placeholder seek point")
                    points.append({"sample": sample,
                                   "offset": int.from_bytes(data[index + 8:index + 16], "big"),
                                   "frameSamples": int.from_bytes(data[index + 16:index + 18], "big")})
            if header[0] & 128:
                break
        first_audio = source.tell()
    if not stream or len(points) < 2:
        raise RuntimeError("Missing STREAMINFO or useful SEEKTABLE")
    if [p["sample"] for p in points] != sorted({p["sample"] for p in points}):
        raise RuntimeError("Seek points are not unique and ordered")
    return stream, points, blocks, first_audio


def decode_hash(ffmpeg, path):
    process = subprocess.Popen([
        ffmpeg, "-hide_banner", "-loglevel", "error", "-i", str(path),
        "-map", "0:a:0", "-c:a", "pcm_s16le", "-f", "s16le", "pipe:1",
    ], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    digest = hashlib.sha256()
    total = 0
    while True:
        chunk = process.stdout.read(1024 * 1024)
        if not chunk:
            break
        digest.update(chunk)
        total += len(chunk)
    stderr = process.stderr.read()
    if process.wait() != 0:
        raise RuntimeError("Independent ffmpeg decode failed: " + stderr.decode(errors="replace"))
    return digest.hexdigest(), total


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--duration-seconds", type=Decimal, default=Decimal(300))
    parser.add_argument("--profile", choices=["rising", "falling", "constant"], default="rising")
    parser.add_argument("--seed", type=lambda value: int(value, 0), default=20260910)
    parser.add_argument("--output-dir", required=True, type=Path, help="New directory outside the repository")
    parser.add_argument("--flac", default="flac")
    parser.add_argument("--ffmpeg", default="ffmpeg")
    parser.add_argument("--ffprobe", default="ffprobe")
    args = parser.parse_args()
    if not args.duration_seconds.is_finite() or not (20 <= args.duration_seconds <= 320):
        parser.error("duration must be 20–320 seconds; use 180–320 for stress trials")
    frames_decimal = args.duration_seconds * RATE
    if frames_decimal != int(frames_decimal):
        parser.error("duration must resolve to an exact integer sample count at 44100 Hz")
    frames = int(frames_decimal)
    tools = {name: shutil.which(getattr(args, name)) for name in ["flac", "ffmpeg", "ffprobe"]}
    if not all(tools.values()):
        parser.error("flac, ffmpeg and ffprobe executables are required")
    output = args.output_dir
    if output.exists():
        parser.error("output directory already exists; choose a new one rather than overwriting evidence")
    output.mkdir(parents=True)
    target = output / "fixture.flac"
    schedule = stages(args.profile, frames)
    raw_sha, raw_md5 = hashlib.sha256(), hashlib.md5()
    peak = 0
    command = [
        tools["flac"], "--silent", "--verify", "-5", "--blocksize=4096",
        "--seekpoint=10s", "--padding=8192", "--no-preserve-modtime",
        "--force-raw-format", "--endian=little", "--sign=signed", "--channels=2",
        "--bps=16", "--sample-rate=44100", f"--input-size={frames * CHANNELS * (BITS // 8)}",
        f"--output-name={target}", "-",
    ]
    with (output / "encoder.log").open("wb") as log:
        process = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=log)
        try:
            for start in range(0, frames, RATE):
                raw, chunk_peak = pcm_chunk(start, min(frames, start + RATE), schedule, args.seed)
                raw_sha.update(raw)
                raw_md5.update(raw)
                peak = max(peak, chunk_peak)
                process.stdin.write(raw)
            process.stdin.close()
            if process.wait() != 0:
                raise RuntimeError("FLAC encode/verify failed; inspect encoder.log")
        except BaseException:
            process.kill()
            process.wait()
            raise

    stream, points, blocks, first_audio = read_flac_metadata(target)
    expected = {"sampleRate": RATE, "channels": CHANNELS, "bitsPerSample": BITS,
                "totalSamples": frames, "pcmMD5": raw_md5.hexdigest()}
    if any(stream[key] != value for key, value in expected.items()):
        raise RuntimeError("STREAMINFO differs from generated PCM")
    packets = json.loads(subprocess.check_output([
        tools["ffprobe"], "-v", "error", "-select_streams", "a:0", "-show_packets",
        "-show_entries", "packet=pts,pos,duration,size", "-of", "json", str(target),
    ]))["packets"]
    packet_by_position = {int(packet["pos"]): packet for packet in packets}
    for point in points:
        packet = packet_by_position.get(first_audio + point["offset"])
        if not packet or int(packet["pts"]) != point["sample"] or int(packet["duration"]) != point["frameSamples"]:
            raise RuntimeError("SEEKTABLE point does not match independently parsed packet")
    decoded_sha, decoded_bytes = decode_hash(tools["ffmpeg"], target)
    if decoded_sha != raw_sha.hexdigest() or decoded_bytes != frames * 4:
        raise RuntimeError("Independent decoded PCM is not bit-identical to generated PCM")

    for stage in schedule:
        stage["startSeconds"] = stage["startFrame"] / RATE
        stage["endSeconds"] = stage["endFrame"] / RATE
        stage["encodedFrameBytes"] = sum(int(packet["size"]) for packet in packets
                                         if stage["startFrame"] <= int(packet["pts"]) < stage["endFrame"])
        stage["approximateBitsPerSecond"] = stage["encodedFrameBytes"] * 8 / (stage["endSeconds"] - stage["startSeconds"])
    ten_second_bins = []
    for start_frame in range(0, frames, 10 * RATE):
        end_frame = min(frames, start_frame + 10 * RATE)
        count = sum(int(packet["size"]) for packet in packets if start_frame <= int(packet["pts"]) < end_frame)
        ten_second_bins.append({"startSeconds": start_frame / RATE, "endSeconds": end_frame / RATE,
                                "encodedFrameBytes": count, "approximateBitsPerSecond": count * 8 * RATE / (end_frame - start_frame)})
    with target.open("rb") as source:
        encoded_sha = hashlib.file_digest(source, "sha256").hexdigest()
    manifest = {
        "schema": 1, "purpose": "Original AVPlayer FLAC seek regression candidate; no external audio",
        "generator": Path(__file__).name, "profile": args.profile, "seed": args.seed,
        "sourceArithmetic": "Integer DDS/Bhaskara oscillators, 10-slot per-second Gray-code FSK marker, stateless 32-bit hash noise",
        "streamInfo": stream, "durationSeconds": frames / RATE, "peakAbsoluteS16": peak,
        "rawPCMFormat": "signed 16-bit little-endian interleaved stereo",
        "rawPCMSHA256": raw_sha.hexdigest(), "decodedPCMSHA256": decoded_sha,
        "flacSHA256": encoded_sha, "flacBytes": target.stat().st_size,
        "metadata": blocks, "firstAudioByte": first_audio, "seekPoints": points,
        "seekPointValidation": f"All {len(points)} points matched independent ffprobe packet positions, sample indices and frame durations",
        "stages": schedule, "tenSecondBitrateBins": ten_second_bins,
        "versions": {
            "python": platform.python_version(), "numpy": np.__version__,
            "flac": subprocess.check_output([tools["flac"], "--version"], text=True).strip(),
            "ffmpeg": subprocess.check_output([tools["ffmpeg"], "-version"], text=True).splitlines()[0],
        },
        "recommendedSeekSeconds": sorted({int(frames / RATE * 0.5), int(frames / RATE * 0.9)}),
        "verification": {"flacEncoderVerify": True, "independentPCMHashMatch": True,
                         "allSeekPointsValid": True, "audioPlaybackExecuted": False,
                         "AVPlayerBugReproduced": "not tested; qualify candidate before making a regression assertion"},
        "limits": [
            "Encoded byte layout depends on the FLAC encoder/version; record hashes and versions.",
            "Bitrate bins attribute an entire encoded frame to its start timestamp, so boundaries are approximate by at most one block.",
            "An original long VBR file is a candidate, not proof of reproduction; AVFoundation must be tested separately.",
            "Do not treat .playing, getProgress or tap timeRange as independent audio-content evidence.",
        ],
    }
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    (output / "fixture.lrc").write_text("\n".join(
        f"[{second // 60:02d}:{second % 60:02d}.00]Original fixture — sample {second * RATE} / second {second}"
        for second in range(int(args.duration_seconds) + 1)
    ) + "\n")
    print(json.dumps({"outputDirectory": str(output), "durationSeconds": frames / RATE,
                      "flacBytes": target.stat().st_size, "seekPointCount": len(points),
                      "PCMHashVerified": True, "flacSHA256": encoded_sha,
                      "stageBitsPerSecond": [round(stage["approximateBitsPerSecond"]) for stage in schedule]}))


if __name__ == "__main__":
    main()
