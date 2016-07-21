#pragma once

#include <pebble.h>
#include "app_messages.h"

// Size can be up to ~390 when status bar text is 255 bytes long (as of fa6984)
#define CONTENT_SIZE 512

// There are many failure modes...
#define INITIAL_TIMEOUT 1000
#define DEFAULT_TIMEOUT (20*1000)
#define TIMEOUT_RETRY_DELAY (10*1000)
#define OUT_RETRY_DELAY (20*1000)
#define IN_RETRY_DELAY 100
#define LATE_DATA_UPDATE_FREQUENCY (60*1000)
#define ERROR_RETRY_DELAY (60*1000)
#define BAD_APP_MESSAGE_RETRY_DELAY (60*1000)

void init_comm(void (*callback_for_data)(DataMessage *data), void (*callback_for_prefs)(DictionaryIterator *received));
void deinit_comm();
