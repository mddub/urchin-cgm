#include <pebble.h>
#include "app_keys.h"
#include "config.h"
#include "comm.h"
#include "preferences.h"
#include "staleness.h"

static bool phone_contact = false;
static bool update_in_progress;
static AppTimer *request_timer = NULL;
static AppTimer *timeout_timer = NULL;

static void (*data_callback)(DataMessage *data);
static void (*prefs_callback)(DictionaryIterator *received);
static void (*request_state_callback)(RequestState state, AppMessageResult reason);
static void schedule_update(uint32_t delay);
static void request_update();
static void timeout_handler();

static DataMessage *last_data_message;

static void clear_timer(AppTimer **timer) {
  if (*timer != NULL) {
    app_timer_cancel(*timer);
    *timer = NULL;
  }
}

static int timeout_length() {
  // Start with extra short timeouts on launch to get data showing as soon as possible.
  static int exponential_timeout = INITIAL_TIMEOUT;

  if (phone_contact) {
    return DEFAULT_TIMEOUT;
  } else {
    exponential_timeout = exponential_timeout * 2 < DEFAULT_TIMEOUT ? exponential_timeout * 2 : DEFAULT_TIMEOUT;
    return exponential_timeout;
  }
}

static void timeout_handler() {
  if (phone_contact) {
    // Requests time out more quickly immediately after load (before any phone
    // contact), so only timeouts after phone contact are legitimate
    request_state_callback(REQUEST_STATE_TIMED_OUT, 0);
  } else if (!phone_contact && !connection_service_peek_pebble_app_connection()) {
    // ...unless the app just loaded and there's no Bluetooth connection
    request_state_callback(REQUEST_STATE_NO_BLUETOOTH, 0);
  }

  timeout_timer = NULL;
  if (update_in_progress) {
    update_in_progress = false;
    schedule_update(TIMEOUT_RETRY_DELAY);
  }
}

static void schedule_update(uint32_t delay) {
  if (update_in_progress) {
    return;
  }
  clear_timer(&request_timer);
  clear_timer(&timeout_timer);
  request_timer = app_timer_register(delay, request_update, NULL);
  APP_LOG(APP_LOG_LEVEL_DEBUG, "Scheduling update for delay %d", (int) delay);
}

static void request_update() {
  request_timer = NULL;

  if (!connection_service_peek_pebble_app_connection()) {
    request_state_callback(REQUEST_STATE_NO_BLUETOOTH, 0);
    schedule_update(NO_BLUETOOTH_RETRY_DELAY);
  } else {
    request_state_callback(REQUEST_STATE_WAITING, 0);

    DictionaryIterator *send_message;
    app_message_outbox_begin(&send_message);
    app_message_outbox_send();

    update_in_progress = true;
    timeout_timer = app_timer_register(timeout_length(), timeout_handler, NULL);
  }
}

static void in_received_handler(DictionaryIterator *received, void *context) {
  phone_contact = true;
  update_in_progress = false;

  time_t now = time(NULL);
  staleness_update_message_received(now);

  int32_t msg_type;
  if (!get_int32(received, &msg_type, APP_KEY_MSG_TYPE, true, 0)) {
    request_state_callback(REQUEST_STATE_BAD_APP_MESSAGE, 0);
    schedule_update(BAD_APP_MESSAGE_RETRY_DELAY);
    return;
  }

  if (msg_type == MSG_TYPE_DATA) {
    static DataMessage d;
    if (validate_data_message(received, &d)) {
      memcpy(last_data_message, &d, sizeof(DataMessage));
      int32_t delay;
      if (get_prefs()->update_every_minute) {
        delay = 60 * 1000;
      } else {
        int32_t next_update = (SGV_UPDATE_FREQUENCY_SECONDS - last_data_message->recency) * 1000;
        delay = next_update < 0 ? LATE_DATA_UPDATE_FREQUENCY : next_update;
      }
      schedule_update((uint32_t) delay);

      staleness_update_data_received(now, last_data_message->recency);
      request_state_callback(REQUEST_STATE_SUCCESS, 0);
      data_callback(last_data_message);
    } else {
      request_state_callback(REQUEST_STATE_BAD_APP_MESSAGE, 0);
      schedule_update(BAD_APP_MESSAGE_RETRY_DELAY);
    }
  } else if (msg_type == MSG_TYPE_PREFERENCES) {
    request_state_callback(REQUEST_STATE_SUCCESS, 0);
    prefs_callback(received);
  } else {
    request_state_callback(REQUEST_STATE_FETCH_ERROR, 0);
    schedule_update(ERROR_RETRY_DELAY);
  }
}

static void in_dropped_handler(AppMessageResult reason, void *context) {
  // https://developer.getpebble.com/docs/c/Foundation/AppMessage/#AppMessageResult
  request_state_callback(REQUEST_STATE_IN_DROPPED, reason);
  update_in_progress = false;
  schedule_update(IN_RETRY_DELAY);
}

static void out_failed_handler(DictionaryIterator *failed, AppMessageResult reason, void *context) {
  // https://developer.getpebble.com/docs/c/Foundation/AppMessage/#AppMessageResult
  request_state_callback(REQUEST_STATE_OUT_FAILED, reason);
  update_in_progress = false;
  schedule_update(OUT_RETRY_DELAY);
}

static void bluetooth_connection_handler(bool connected) {
  if (connected) {
    schedule_update(0);
  }
}

void init_comm(
    void (*callback_for_data)(DataMessage *data),
    void (*callback_for_prefs)(DictionaryIterator *received),
    void (*callback_for_request_state)(RequestState state, AppMessageResult reason)
) {
  data_callback = callback_for_data;
  prefs_callback = callback_for_prefs;
  request_state_callback = callback_for_request_state;
  app_message_register_inbox_received(in_received_handler);
  app_message_register_inbox_dropped(in_dropped_handler);
  app_message_register_outbox_failed(out_failed_handler);

  const uint32_t inbound_size = CONTENT_SIZE;
  const uint32_t outbound_size = 64;

  // We expect the JS to initiate sending data first.
  update_in_progress = true;
  request_state_callback(REQUEST_STATE_WAITING, 0);
  timeout_timer = app_timer_register(timeout_length(), timeout_handler, NULL);

  last_data_message = malloc(sizeof(DataMessage));

  app_message_open(inbound_size, outbound_size);

  // Request data as soon as Bluetooth reconnects
  connection_service_subscribe((ConnectionHandlers) {
    .pebble_app_connection_handler = bluetooth_connection_handler
  });
}

void deinit_comm() {
  app_message_deregister_callbacks();
  free(last_data_message);
}

bool comm_is_update_in_progress() {
  return update_in_progress;
}
