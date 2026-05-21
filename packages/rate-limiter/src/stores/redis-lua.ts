// Lua script for atomic rate limiter consume in Redis.
// Handles all 4 built-in algorithms in one script.
// Loaded via SCRIPT LOAD, executed via EVALSHA.

export const CONSUME_SCRIPT = `
-- KEYS[1]: key
-- ARGV[1]: weight (number)
-- ARGV[2]: now (timestamp ms)
-- ARGV[3]: algorithm type (string: token-bucket|fixed-window|sliding-window-log|sliding-window-counter)
-- ARGV[4]: algorithm config as JSON

local key = KEYS[1]
local weight = tonumber(ARGV[1])
local now = tonumber(ARGV[2])
local algo = ARGV[3]
local config = cjson.decode(ARGV[4])

local raw = redis.call('GET', key)
local state, allowed, remaining, resetAt, totalLimit, newState

if algo == 'token-bucket' then
    local tokensPerSecond = tonumber(config.tokensPerSecond)
    local bucketSize = tonumber(config.bucketSize)
    totalLimit = bucketSize

    if raw then
        state = cjson.decode(raw)
    else
        state = { tokens = bucketSize, lastRefill = now }
    end

    -- Refill based on elapsed time
    local elapsed = (now - state.lastRefill) / 1000.0
    local refill = elapsed * tokensPerSecond
    state.tokens = math.min(bucketSize, state.tokens + refill)
    state.lastRefill = now

    -- Consume
    allowed = state.tokens >= weight
    if allowed then
        state.tokens = state.tokens - weight
    end

    -- ResetAt: time to refill to full bucket
    local tokensNeeded = bucketSize - state.tokens
    resetAt = now + (tokensNeeded / tokensPerSecond) * 1000
    remaining = math.floor(state.tokens)
    newState = cjson.encode(state)

elseif algo == 'fixed-window' then
    local windowMs = tonumber(config.windowMs)
    local maxRequests = tonumber(config.maxRequests)
    totalLimit = maxRequests
    local windowKey = math.floor(now / windowMs) * windowMs

    if raw then
        state = cjson.decode(raw)
        if state.window ~= windowKey then
            state = { count = 0, window = windowKey }
        end
    else
        state = { count = 0, window = windowKey }
    end

    allowed = state.count < maxRequests
    if allowed then
        state.count = state.count + weight
    end

    remaining = math.max(0, maxRequests - state.count)
    resetAt = windowKey + windowMs
    newState = cjson.encode(state)

elseif algo == 'sliding-window-log' then
    local windowMs = tonumber(config.windowMs)
    local maxRequests = tonumber(config.maxRequests)
    totalLimit = maxRequests
    local cutoff = now - windowMs

    if raw then
        state = cjson.decode(raw)
        -- Remove expired timestamps
        local valid = {}
        for _, ts in ipairs(state.timestamps) do
            if ts > cutoff then
                table.insert(valid, ts)
            end
        end
        state.timestamps = valid
    else
        state = { timestamps = {} }
    end

    allowed = #state.timestamps < maxRequests
    if allowed then
        for _ = 1, weight do
            table.insert(state.timestamps, now)
        end
    end

    remaining = math.max(0, maxRequests - #state.timestamps)
    if #state.timestamps > 0 then
        resetAt = state.timestamps[1] + windowMs
    else
        resetAt = now + windowMs
    end
    newState = cjson.encode(state)

elseif algo == 'sliding-window-counter' then
    local windowMs = tonumber(config.windowMs)
    local maxRequests = tonumber(config.maxRequests)
    totalLimit = maxRequests

    local currentWindow = math.floor(now / windowMs)
    local previousWindow = currentWindow - 1

    if raw then
        state = cjson.decode(raw)
        if state.currentWindow ~= currentWindow then
            state.previousCount = state.currentWindow == previousWindow and state.currentCount or 0
            state.currentCount = 0
            state.currentWindow = currentWindow
        end
    else
        state = { currentCount = 0, previousCount = 0, currentWindow = currentWindow }
    end

    -- Approximation: previous * (1 - progress) + current
    local progress = (now - currentWindow * windowMs) / windowMs
    local estimate = state.previousCount * (1 - progress) + state.currentCount

    allowed = estimate < maxRequests
    if allowed then
        state.currentCount = state.currentCount + weight
    end

    remaining = math.max(0, math.floor(maxRequests - estimate))
    resetAt = (currentWindow + 1) * windowMs
    newState = cjson.encode(state)

else
    return redis.error_reply('Unknown algorithm: ' .. algo)
end

-- TTL: how long until resetAt (minimum 1 second).
-- Redis rounds sub-second TTL to 0, which would expire the key immediately.
-- math.max(..., 1) ensures the key lives at least 1 second, preventing
-- premature expiry for windows smaller than 1s or near-instant resets.
local ttlSeconds = math.max(math.ceil((resetAt - now) / 1000), 1)
redis.call('SET', key, newState, 'EX', ttlSeconds)

return {
    allowed and 1 or 0,
    math.floor(remaining),
    math.floor(resetAt),
    totalLimit
}
`.trim();
