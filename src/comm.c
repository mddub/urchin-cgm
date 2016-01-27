#include <pebble.h>
#include "app_keys.h"
#include "config.h"
#include "comm.h"
#include "staleness.h"

static bool phone_contact = false;
static bool update_in_progress;
static bool need_prefs;
static uint16_t no_phone_contact_timeout = INITIAL_NO_PHONE_CONTACT_TIMEOUT;
static uint16_t network_error_retry_delay = INITIAL_NETWORK_ERROR_RETRY_DELAY;
static AppTimer *request_timer = NULL;
static AppTimer *timeout_timer = NULL;

static void (*data_callback)(DictionaryIterator *received);
static void schedule_update(uint32_t delay);
static void request_update();
static void timeout_handler();

static void clear_timer(AppTimer **timer) {
  if (*timer != NULL) {
    app_timer_cancel(*timer);
    *timer = NULL;
  }
}

static uint16_t advance_exponential_delay(uint16_t *delay) {
  uint16_t current_delay = *delay;
  *delay = *delay * 2 < MAX_EXPONENTIAL_DELAY ? *delay * 2 : MAX_EXPONENTIAL_DELAY;
  return current_delay;
}

static void timeout_handler() {
  timeout_timer = NULL;
  if (update_in_progress) {
    update_in_progress = false;
    schedule_update(0);
  }
}

static void schedule_update(uint32_t delay) {
  clear_timer(&request_timer);
  clear_timer(&timeout_timer);
  request_timer = app_timer_register(delay, request_update, NULL);
  APP_LOG(APP_LOG_LEVEL_DEBUG, "Scheduling update for delay %d", (int) delay);
}

static void request_update() {
  uint8_t request_type = need_prefs ? MSG_TYPE_REQUEST_PREFERENCES : MSG_TYPE_REQUEST_DATA;

  DictionaryIterator *send_message;
  app_message_outbox_begin(&send_message);
  dict_write_uint8(send_message, APP_KEY_MSG_TYPE, request_type);
  app_message_outbox_send();

  request_timer = NULL;
  update_in_progress = true;

  // Start with extra short timeouts on launch to get data showing as soon as possible.
  int timeout = phone_contact ? DEFAULT_APP_MESSAGE_TIMEOUT : advance_exponential_delay(&no_phone_contact_timeout);

  timeout_timer = app_timer_register(timeout, timeout_handler, NULL);
}

static void in_received_handler(DictionaryIterator *received, void *context) {
  phone_contact = true;
  staleness_update(received);
  int msg_type = dict_find(received, APP_KEY_MSG_TYPE)->value->uint8;

  if (need_prefs && msg_type != MSG_TYPE_RESPONSE_PREFERENCES) {

    update_in_progress = false;
    schedule_update(0);

  } else if (msg_type == MSG_TYPE_RESPONSE_PREFERENCES) {

    // Expect the phone to send data right after sending preferences.
    update_in_progress = true;
    need_prefs = false;

  } else if (msg_type == MSG_TYPE_RESPONSE_DATA) {

    update_in_progress = false;
    uint32_t recency = dict_find(received, APP_KEY_RECENCY)->value->uint32;
    int32_t next_update = SGV_UPDATE_FREQUENCY - recency * 1000;
    int32_t delay = next_update < LATE_DATA_UPDATE_FREQUENCY ? LATE_DATA_UPDATE_FREQUENCY : next_update;
    schedule_update((uint32_t) delay);

    network_error_retry_delay = INITIAL_NETWORK_ERROR_RETRY_DELAY;

  } else if (msg_type == MSG_TYPE_RESPONSE_ERROR) {

    update_in_progress = false;
    schedule_update(advance_exponential_delay(&network_error_retry_delay));

  }

  data_callback(received);
}

static void in_dropped_handler(AppMessageResult reason, void *context) {
  // https://developer.getpebble.com/docs/c/Foundation/AppMessage/#AppMessageResult
  APP_LOG(APP_LOG_LEVEL_DEBUG, "Incoming AppMessage dropped, %d", reason);

  update_in_progress = false;
  schedule_update(IN_RETRY_DELAY);
}

static void out_failed_handler(DictionaryIterator *failed, AppMessageResult reason, void *context) {
  update_in_progress = false;
  schedule_update(OUT_RETRY_DELAY);
}

void init_comm(void (*callback)(DictionaryIterator *received), bool have_prefs) {
  data_callback = callback;
  app_message_register_inbox_received(in_received_handler);
  app_message_register_inbox_dropped(in_dropped_handler);
  app_message_register_outbox_failed(out_failed_handler);

  const uint32_t inbound_size = CONTENT_SIZE;
  const uint32_t outbound_size = 64;

  need_prefs = !have_prefs;
  if (need_prefs) {
    schedule_update(0);
  } else {
    // We expect the JS to initiate sending data first.
    update_in_progress = true;
    timeout_timer = app_timer_register(advance_exponential_delay(&no_phone_contact_timeout), timeout_handler, NULL);
  }

  app_message_open(inbound_size, outbound_size);
}
