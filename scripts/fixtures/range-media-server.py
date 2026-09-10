#!/usr/bin/env python3
"""Diagnostic localhost origin: serve one private local file with HTTP Range.

No media is embedded, copied, transcoded, or cached. Every URL path maps to the
same supplied file so each trial can use a fresh path/query. The bandwidth limit
is aggregate across connections. JSONL traces omit URLs, paths, and headers and
record bytes handed to the socket (an upper bound on bytes consumed by the peer).
Keep the supplied file and output log in /tmp, outside version control.
"""
import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import itertools
import json
from pathlib import Path
import re
import threading
import time


class Bandwidth:
    def __init__(self, rate):
        self.rate = rate
        self.next_slot = time.monotonic()
        self.lock = threading.Lock()

    def reserve(self, size):
        if self.rate == 0:
            return
        with self.lock:
            now = time.monotonic()
            start = max(now, self.next_slot)
            self.next_slot = start + size / self.rate
        if start > now:
            time.sleep(start - now)


def byte_range(value, size):
    if value is None:
        return 0, size - 1, 200
    match = re.fullmatch(r"bytes=(\d*)-(\d*)", value.strip())
    if not match or not any(match.groups()):
        return None
    first, last = match.groups()
    if not first:
        suffix = int(last)
        if suffix <= 0:
            return None
        return max(0, size - suffix), size - 1, 206
    first = int(first)
    last = min(size - 1, int(last)) if last else size - 1
    return (first, last, 206) if 0 <= first <= last < size else None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("media", type=Path, help="Existing complete local file, normally under /tmp")
    parser.add_argument("--log", required=True, type=Path, help="Private JSONL transfer log")
    parser.add_argument("--port", type=int, default=0)
    parser.add_argument("--bytes-per-second", type=int, default=1048576, help="Aggregate rate; 0 means unlimited")
    parser.add_argument("--chunk-bytes", type=int, default=16384)
    parser.add_argument("--content-type", default="audio/flac")
    parser.add_argument("--ready-file", type=Path, help="Optional private JSON file with bound port")
    args = parser.parse_args()
    if not args.media.is_file() or args.media.stat().st_size <= 0:
        parser.error("media must be an existing nonempty file")
    if args.bytes_per_second < 0 or args.chunk_bytes < 1:
        parser.error("rate must be nonnegative and chunk size positive")
    size = args.media.stat().st_size
    bandwidth = Bandwidth(args.bytes_per_second)
    ids = itertools.count(1)
    trace_lock = threading.Lock()
    stop = threading.Event()
    trace_file = args.log.open("w", encoding="utf-8", buffering=1)

    def trace(event, **fields):
        with trace_lock:
            if not trace_file.closed:
                trace_file.write(json.dumps({"event": event, "hostSeconds": time.monotonic(), **fields}) + "\n")

    class Handler(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"

        def log_message(self, *_):
            pass

        def do_HEAD(self):
            self.serve(False)

        def do_GET(self):
            self.serve(True)

        def serve(self, with_body):
            request_id = next(ids)
            selection = byte_range(self.headers.get("Range"), size)
            self.close_connection = True
            if selection is None:
                self.send_response(416)
                self.send_header("Content-Range", f"bytes */{size}")
                self.send_header("Content-Length", "0")
                self.send_header("Connection", "close")
                self.end_headers()
                trace("rejected-range", requestId=request_id)
                return
            start, end, status = selection
            self.send_response(status)
            self.send_header("Content-Type", args.content_type)
            self.send_header("Content-Length", str(end - start + 1))
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
            self.send_header("Connection", "close")
            if status == 206:
                self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
            self.end_headers()
            trace("response", requestId=request_id, status=status, start=start,
                  endInclusive=end, body=with_body, totalBytes=size)
            if not with_body:
                return
            sent = 0
            reason = "complete"
            try:
                with args.media.open("rb") as source:
                    source.seek(start)
                    position = start
                    while position <= end and not stop.is_set():
                        data = source.read(min(args.chunk_bytes, end - position + 1))
                        if not data:
                            reason = "unexpected-eof"
                            break
                        bandwidth.reserve(len(data))
                        self.wfile.write(data)
                        self.wfile.flush()
                        trace("bytes", requestId=request_id, start=position,
                              endExclusive=position + len(data), count=len(data))
                        position += len(data)
                        sent += len(data)
            except (BrokenPipeError, ConnectionResetError):
                reason = "client-closed"
            finally:
                trace("finished", requestId=request_id, bytesSent=sent, reason=reason)

    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    server.daemon_threads = True
    ready = {"port": server.server_port, "url": f"http://127.0.0.1:{server.server_port}/trial.flac",
             "mediaBytes": size, "bytesPerSecond": args.bytes_per_second,
             "contentType": args.content_type}
    trace("server-ready", **{key: value for key, value in ready.items() if key != "url"})
    if args.ready_file:
        args.ready_file.write_text(json.dumps(ready) + "\n")
    print(json.dumps(ready), flush=True)
    try:
        server.serve_forever(poll_interval=0.1)
    except KeyboardInterrupt:
        pass
    finally:
        stop.set()
        server.server_close()
        with trace_lock:
            trace_file.close()


if __name__ == "__main__":
    main()
