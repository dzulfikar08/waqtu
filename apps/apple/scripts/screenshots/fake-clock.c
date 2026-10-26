// Fixed wall clock for one process, for the DEBUG screenshot mode (.github/workflows/mas-screenshots.yml).
//
//   clang -dynamiclib -O2 -framework CoreFoundation -o fake-clock.dylib fake-clock.c
//   WAQTU_FAKE_UNIX_TIME=1802426400 DYLD_INSERT_LIBRARIES=$PWD/fake-clock.dylib Waqtu.app/Contents/MacOS/Waqtu
//
// Every wall-clock entry point returns WAQTU_FAKE_UNIX_TIME plus the real time elapsed since launch,
// so the app renders the same moment on every run. The replacements return absolute values (not
// offsets), so one clock call that goes through another stays correct. Monotonic clocks
// (timers, animations) are untouched. Needs a target without hardened runtime (an unsigned Debug build).

#include <CoreFoundation/CoreFoundation.h>
#include <mach/mach_time.h>
#include <stdint.h>
#include <stdlib.h>
#include <sys/time.h>
#include <time.h>

static int enabled;
static double fake_start;
static uint64_t continuous_start;
static mach_timebase_info_data_t timebase;

__attribute__((constructor)) static void fake_clock_init(void) {
    const char *value = getenv("WAQTU_FAKE_UNIX_TIME");
    if (value == NULL || *value == '\0') return;
    fake_start = strtod(value, NULL);
    mach_timebase_info(&timebase);
    continuous_start = mach_continuous_time();
    enabled = 1;
}

static double fake_now(void) {
    double elapsed = (double)(mach_continuous_time() - continuous_start) * timebase.numer / timebase.denom / 1e9;
    return fake_start + elapsed;
}

static int fake_gettimeofday(struct timeval *tv, void *tz) {
    int result = gettimeofday(tv, tz);
    if (result == 0 && tv != NULL && enabled) {
        double now = fake_now();
        tv->tv_sec = (time_t)now;
        tv->tv_usec = (suseconds_t)((now - (double)tv->tv_sec) * 1e6);
    }
    return result;
}

static int fake_clock_gettime(clockid_t clock, struct timespec *ts) {
    int result = clock_gettime(clock, ts);
    if (result == 0 && ts != NULL && enabled && clock == CLOCK_REALTIME) {
        double now = fake_now();
        ts->tv_sec = (time_t)now;
        ts->tv_nsec = (long)((now - (double)ts->tv_sec) * 1e9);
    }
    return result;
}

static uint64_t fake_clock_gettime_nsec_np(clockid_t clock) {
    if (enabled && clock == CLOCK_REALTIME) return (uint64_t)(fake_now() * 1e9);
    return clock_gettime_nsec_np(clock);
}

static time_t fake_time(time_t *out) {
    if (!enabled) return time(out);
    time_t now = (time_t)fake_now();
    if (out != NULL) *out = now;
    return now;
}

static CFAbsoluteTime fake_CFAbsoluteTimeGetCurrent(void) {
    if (!enabled) return CFAbsoluteTimeGetCurrent();
    return fake_now() - kCFAbsoluteTimeIntervalSince1970;
}

#define INTERPOSE(replacement, original)                                                  \
    __attribute__((used)) static const struct {                                          \
        const void *replacement;                                                          \
        const void *original;                                                             \
    } interpose_##original __attribute__((section("__DATA,__interpose"))) = {             \
        (const void *)(uintptr_t)&replacement, (const void *)(uintptr_t)&original         \
    };

INTERPOSE(fake_gettimeofday, gettimeofday)
INTERPOSE(fake_clock_gettime, clock_gettime)
INTERPOSE(fake_clock_gettime_nsec_np, clock_gettime_nsec_np)
INTERPOSE(fake_time, time)
INTERPOSE(fake_CFAbsoluteTimeGetCurrent, CFAbsoluteTimeGetCurrent)
