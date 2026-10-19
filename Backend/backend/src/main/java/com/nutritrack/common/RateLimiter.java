package com.nutritrack.common;

import com.nutritrack.exception.ApiException;
import java.time.Duration;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

/**
 * Simple in-memory sliding-window limiter. Per application instance only: behind multiple instances use a shared
 * store (Redis) or enforce limits at the gateway.
 */
@Component
public class RateLimiter {
    private final Map<String, Deque<Long>> hits = new ConcurrentHashMap<>();

    public void check(String key, int limit, Duration window) {
        long now = System.nanoTime();
        long cutoff = now - window.toNanos();
        Deque<Long> deque = hits.computeIfAbsent(key, k -> new ArrayDeque<>());
        synchronized (deque) {
            while (!deque.isEmpty() && deque.peekFirst() < cutoff) {
                deque.pollFirst();
            }
            if (deque.size() >= limit) {
                throw ApiException.tooManyRequests();
            }
            deque.addLast(now);
        }
        if (hits.size() > 10_000) {
            hits.entrySet().removeIf(e -> {
                synchronized (e.getValue()) {
                    return e.getValue().isEmpty() || e.getValue().peekLast() < cutoff;
                }
            });
        }
    }

    public void clear() {
        hits.clear();
    }
}
