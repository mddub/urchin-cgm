#pragma once

#include <pebble.h>
#include "app_messages.h"

// Size can be up to ~390 when status bar text is 255 bytes long (as of fa6984)
#define CONTENT_SIZE 512

// There are many failure modes...
#define INITIAL_TIMEOUT_HALVED 2500
#define DEFAULT_TIMEOUT (10*1000)
#define MISSING_INITIAL_DATA_ALERT (5*1000)
#define TIMEOUT_RETRY_DELAY (20*1000)
#define NO_BLUETOOTH_RETRY_DELAY (60*1000)
#define SEND_FAILED_DELAY (60*1000)
#define OUT_RETRY_DELAY (20*1000)
#define IN_RETRY_DELAY 100
#define LATE_DATA_RETRY_PERIOD_SECONDS 60
#define LATE_DATA_UPDATE_FREQUENCY_SECONDS 60
#define ERROR_RETRY_DELAY (60*1000)
#define BAD_APP_MESSAGE_RETRY_DELAY (60*1000)

enum {
  MSG_TYPE_ERROR,
  MSG_TYPE_DATA,
  MSG_TYPE_PREFERENCES,
};

typedef enum {
  REQUEST_STATE_WAITING,
  REQUEST_STATE_SUCCESS,
  REQUEST_STATE_FETCH_ERROR,
  REQUEST_STATE_BAD_APP_MESSAGE,
  REQUEST_STATE_TIMED_OUT,
  REQUEST_STATE_NO_BLUETOOTH,
  REQUEST_STATE_OUT_FAILED,
  REQUEST_STATE_IN_DROPPED,
  REQUEST_STATE_BEGIN_FAILED,
  REQUEST_STATE_SEND_FAILED,
} RequestState;

void init_comm(
  void (*callback_for_data)(DataMessage *data),
  void (*callback_for_prefs)(DictionaryIterator *received),
  void (*callback_for_request_state)(RequestState state, AppMessageResult reason)
);
void deinit_comm();
bool comm_is_update_in_progress();
