#include "app_keys.h"
#include "config.h"
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

int graph_staleness_padding() {
  int staleness = total_data_staleness();
  int padding = staleness / GRAPH_INTERVAL_SIZE_SECONDS;
  if (padding == 1 && staleness < GRAPH_INTERVAL_SIZE_SECONDS + GRAPH_STALENESS_GRACE_PERIOD_SECONDS) {
    padding = 0;
  }
  return padding;
}

ConnectionIssue connection_issue() {
  // TODO
  if (!ever_had_phone_contact()) {
    return (ConnectionIssue) {
      .reason = CONNECTION_ISSUE_NONE,
      .staleness = 0,
    };
  }

  if (phone_to_pebble_staleness() > PHONE_TO_PEBBLE_MAX_ACCEPTABLE_DELAY * 60) {
    return (ConnectionIssue) {
      .reason = CONNECTION_ISSUE_BLUETOOTH,
      .staleness = phone_to_pebble_staleness(),
    };
  } else if (web_to_phone_staleness() > WEB_TO_PHONE_MAX_ACCEPTABLE_DELAY * 60) {
    return (ConnectionIssue) {
      .reason = CONNECTION_ISSUE_NETWORK,
      .staleness = web_to_phone_staleness(),
    };
  } else if (rig_to_web_staleness() > RIG_TO_WEB_MAX_ACCEPTABLE_DELAY * 60) {
    return (ConnectionIssue) {
      .reason = CONNECTION_ISSUE_RIG,
      .staleness = rig_to_web_staleness(),
    };
  } else {
    return (ConnectionIssue) {
      .reason = CONNECTION_ISSUE_NONE,
      .staleness = 0,
    };
  }
}

void staleness_update(DictionaryIterator *data) {
  phone_contact = true;
  time_t now = time(NULL);
  last_phone_contact = now;
  if (dict_find(data, APP_KEY_MSG_TYPE)->value->uint8 == MSG_TYPE_DATA) {
    data_received = true;
    last_successful_phone_contact = now;
    last_data_staleness_wrt_phone = dict_find(data, APP_KEY_RECENCY)->value->int32;
  }
}
