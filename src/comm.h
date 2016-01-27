#pragma once

#include <pebble.h>

// Size can be up to ~390 when status bar text is 255 bytes long (as of fa6984)
#define CONTENT_SIZE 512

#define SGV_UPDATE_FREQUENCY (60*1000*5 + 30*1000)
#define LATE_DATA_UPDATE_FREQUENCY (60*1000)

// There are many failure modes...
#define DEFAULT_APP_MESSAGE_TIMEOUT (10*1000)
#define INITIAL_NO_PHONE_CONTACT_TIMEOUT (1000)
#define INITIAL_NETWORK_ERROR_RETRY_DELAY (5*1000)
#define MAX_EXPONENTIAL_DELAY (60*1000)
#define OUT_RETRY_DELAY (20*1000)
#define IN_RETRY_DELAY 100

void init_comm(void (*callback)(DictionaryIterator *received), bool have_prefs);
