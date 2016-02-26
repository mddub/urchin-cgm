#pragma once

#include <pebble.h>

// Size can be up to ~390 when status bar text is 255 bytes long (as of fa6984)
#define CONTENT_SIZE 512

// Default delay between the timestamp of the last SGV reading and the next request for data
#define SGV_UPDATE_FREQUENCY (60*1000*5 + 30*1000)

// There are many failure modes...
#define INITIAL_TIMEOUT 1000
#define DEFAULT_TIMEOUT (20*1000)
#define TIMEOUT_RETRY_DELAY (10*1000)
#define OUT_RETRY_DELAY (20*1000)
#define IN_RETRY_DELAY 100
#define LATE_DATA_UPDATE_FREQUENCY (60*1000)
#define ERROR_RETRY_DELAY (60*1000)

void init_comm(void (*callback)(DictionaryIterator *received));
