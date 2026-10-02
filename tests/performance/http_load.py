"""Small GET-only baseline. Run against your local/test API, not a live AI route."""
import argparse
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import json
import math
from pathlib import Path
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import urlopen


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', required=True)
    parser.add_argument('--requests', type=int, default=100)
    parser.add_argument('--concurrency', type=int, default=5)
    parser.add_argument('--timeout', type=float, default=15)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    if urlsplit(args.url).scheme not in ('http', 'https'):
        parser.error('URL must use http or https')
    if args.requests < 1 or not 1 <= args.concurrency <= 50 or args.timeout <= 0:
        parser.error('Use positive requests/timeout and concurrency between 1 and 50')

    def request(_):
        start = time.perf_counter()
        try:
            with urlopen(args.url, timeout=args.timeout) as response:
                response.read()
                status = str(response.status)
                success = 200 <= response.status < 300
        except HTTPError as error:
            status, success = str(error.code), False
            error.close()
        except (URLError, TimeoutError, OSError):
            status, success = 'network_error', False
        return (time.perf_counter() - start) * 1000, status, success

    started = datetime.now(timezone.utc).isoformat()
    start = time.perf_counter()
    with ThreadPoolExecutor(max_workers=args.concurrency) as pool:
        results = list(pool.map(request, range(args.requests)))
    elapsed = time.perf_counter() - start
    times = sorted(row[0] for row in results)
    successes = sum(row[2] for row in results)
    report = {
        'started_utc': started, 'url': args.url,
        'requests': args.requests, 'concurrency': args.concurrency,
        'elapsed_seconds': round(elapsed, 3),
        'requests_per_second': round(args.requests / elapsed, 2),
        'successes': successes, 'failures': args.requests - successes,
        'success_rate_percent': round(100 * successes / args.requests, 2),
        'status_counts': dict(Counter(row[1] for row in results)),
        'latency_ms_all_attempts': {
            'mean': round(sum(times) / len(times), 2),
            'p50': round(times[math.ceil(len(times) * .50) - 1], 2),
            'p95': round(times[math.ceil(len(times) * .95) - 1], 2),
            'max': round(times[-1], 2),
        },
        'scope': 'HTTP GET; fresh connections; HTTP status checks only; not browser users or booking races',
    }
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report, indent=2))
    return 0 if successes == args.requests else 1


if __name__ == '__main__':
    raise SystemExit(main())
