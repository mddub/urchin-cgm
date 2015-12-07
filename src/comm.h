#pragma once

#include <pebble.h>

#define CONTENT_SIZE 256

// There are many failure modes...
#define INITIAL_TIMEOUT 1000
#define DEFAULT_TIMEOUT (20*1000)
#define TIMEOUT_RETRY_DELAY (10*1000)
#define OUT_RETRY_DELAY (20*1000)
#define IN_RETRY_DELAY 100
#define LATE_DATA_UPDATE_FREQUENCY (60*1000)
#define ERROR_RETRY_DELAY (60*1000)

void init_comm(void (*callback)(DictionaryIterator *received));
