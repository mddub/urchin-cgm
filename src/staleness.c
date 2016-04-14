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

static int max(int a, int b) {
  return a > b ? a : b;
}

ConnectionIssue connection_issue() {
  // TODO
  if (!ever_had_phone_contact()) {
    return (ConnectionIssue) {
      .reason = CONNECTION_ISSUE_NONE,
      .staleness = 0,
    };
  }

  if (graph_staleness_padding() == 0) {
    return (ConnectionIssue) {
      .reason = CONNECTION_ISSUE_NONE,
      .staleness = 0,
    };
  } else {
    int max_staleness = max(phone_to_pebble_staleness(), web_to_phone_staleness());
    // Blame total staleness on rig->web only if last SGV was stale when fetched
    if (rig_to_web_staleness() > SGV_UPDATE_FREQUENCY_SECONDS) {
      max_staleness = max(max_staleness, rig_to_web_staleness());
    }

    uint8_t reason;
    if (phone_to_pebble_staleness() == max_staleness) {
      reason = CONNECTION_ISSUE_BLUETOOTH;
    } else if (web_to_phone_staleness() == max_staleness) {
      reason = CONNECTION_ISSUE_NETWORK;
    } else {
      reason = CONNECTION_ISSUE_RIG;
    }

    return (ConnectionIssue) {
      .reason = reason,
      .staleness = max_staleness,
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
