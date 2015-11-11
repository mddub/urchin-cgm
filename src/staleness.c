#include "app_keys.h"
#include "staleness.h"

static bool phone_contact = false;
static bool data_received = false;
static time_t last_phone_contact;
static time_t last_successful_phone_contact;
static int last_data_staleness_wrt_phone;

bool ever_had_phone_contact() {
  return phone_contact;
}

bool ever_received_data() {
  return data_received;
}

int phone_to_pebble_staleness() {
  return time(NULL) - last_phone_contact;
}

int web_to_phone_staleness() {
  return last_phone_contact - last_successful_phone_contact;
}

int rig_to_web_staleness() {
  return last_data_staleness_wrt_phone;
}

int total_data_staleness() {
  return rig_to_web_staleness() + web_to_phone_staleness() + phone_to_pebble_staleness();
}

void staleness_update(DictionaryIterator *data) {
  phone_contact = true;
  time_t now = time(NULL);
  last_phone_contact = now;
  if (!dict_find(data, APP_KEY_ERROR)->value->uint8) {
    data_received = true;
    last_successful_phone_contact = now;
    last_data_staleness_wrt_phone = dict_find(data, APP_KEY_RECENCY)->value->int32;
  }
}
