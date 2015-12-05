#include "app_keys.h"
#include "config.h"
#include "comm.h"
#include "staleness.h"

static bool phone_contact = false;
static bool update_in_progress;
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
  DictionaryIterator *send_message;
  app_message_outbox_begin(&send_message);
  app_message_outbox_send();

  request_timer = NULL;
  update_in_progress = true;
  timeout_timer = app_timer_register(timeout_length(), timeout_handler, NULL);
}

static void in_received_handler(DictionaryIterator *received, void *context) {
  phone_contact = true;
  update_in_progress = false;
  Tuple* recency = dict_find(received, APP_KEY_RECENCY);
  if (recency) {
    int32_t next_update = UPDATE_FREQUENCY - recency->value->uint32 * 1000;
    int32_t delay = next_update < 60000 ? 60000 : next_update;
    schedule_update((uint32_t) delay);
  } else
    schedule_update(UPDATE_FREQUENCY);
  staleness_update(received);
  if (dict_find(received, APP_KEY_MSG_TYPE)->value->uint8 != MSG_TYPE_ERROR) {
    data_callback(received);
  }
}

static void in_dropped_handler(AppMessageResult reason, void *context) {
  update_in_progress = false;
  schedule_update(IN_RETRY_DELAY);
}

static void out_failed_handler(DictionaryIterator *failed, AppMessageResult reason, void *context) {
  update_in_progress = false;
  schedule_update(OUT_RETRY_DELAY);
}

void init_comm(void (*callback)(DictionaryIterator *received)) {
  data_callback = callback;
  app_message_register_inbox_received(in_received_handler);
  app_message_register_inbox_dropped(in_dropped_handler);
  app_message_register_outbox_failed(out_failed_handler);

  const uint32_t inbound_size = CONTENT_SIZE;
  const uint32_t outbound_size = 64;

  // We expect the JS to initiate sending data first.
  update_in_progress = true;
  timeout_timer = app_timer_register(timeout_length(), timeout_handler, NULL);

  app_message_open(inbound_size, outbound_size);
}
