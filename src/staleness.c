#include "config.h"
#include "staleness.h"

#define GRAPH_INTERVAL_SIZE_SECONDS (5*60)

static bool ever_seen_request_complete = false;
static bool ever_had_phone_contact = false;
static bool ever_received_data = false;
static time_t app_start_time;
static time_t last_phone_contact;
static time_t last_successful_phone_contact;
static uint32_t last_data_staleness_wrt_phone;

static uint32_t phone_to_pebble_staleness() {
  return time(NULL) - last_phone_contact;
}

static uint32_t web_to_phone_staleness() {
  return last_phone_contact - last_successful_phone_contact;
}

static uint32_t rig_to_web_staleness() {
  return last_data_staleness_wrt_phone;
}

static uint32_t total_data_staleness() {
  return rig_to_web_staleness() + web_to_phone_staleness() + phone_to_pebble_staleness();
}

uint32_t graph_staleness_padding() {
  uint32_t staleness = total_data_staleness();
  uint32_t padding = staleness / GRAPH_INTERVAL_SIZE_SECONDS;
  if (padding == 1 && staleness < GRAPH_INTERVAL_SIZE_SECONDS + GRAPH_STALENESS_GRACE_PERIOD_SECONDS) {
    padding = 0;
  }
  return padding;
}

ConnectionIssue connection_issue() {
  if (!ever_seen_request_complete) {
    // Haven't seen a request time out yet
    return (ConnectionIssue) {
      .reason = CONNECTION_ISSUE_NONE,
      .staleness = 0,
    };
  } else if (ever_seen_request_complete && !ever_had_phone_contact) {
    // No phone contact and a request to the phone has timed out
    return (ConnectionIssue) {
      .reason = CONNECTION_ISSUE_BLUETOOTH,
      .staleness = time(NULL) - app_start_time,
    };
  } else if (ever_seen_request_complete && ever_had_phone_contact && !ever_received_data) {
    // Have heard from the phone but it has never successfully fetched data
    return (ConnectionIssue) {
      .reason = CONNECTION_ISSUE_NETWORK,
      .staleness = time(NULL) - app_start_time,
    };
  }

  if (graph_staleness_padding() > 0) {
    if (phone_to_pebble_staleness() > SGV_UPDATE_FREQUENCY_SECONDS) {
      return (ConnectionIssue) {
        .reason = CONNECTION_ISSUE_BLUETOOTH,
        .staleness = phone_to_pebble_staleness(),
      };
    } else if (web_to_phone_staleness() > SGV_UPDATE_FREQUENCY_SECONDS) {
      return (ConnectionIssue) {
        .reason = CONNECTION_ISSUE_NETWORK,
        .staleness = web_to_phone_staleness(),
      };
    } else if (rig_to_web_staleness() > SGV_UPDATE_FREQUENCY_SECONDS) {
      return (ConnectionIssue) {
        .reason = CONNECTION_ISSUE_RIG,
        .staleness = rig_to_web_staleness(),
      };
    }
  }

  return (ConnectionIssue) {
    .reason = CONNECTION_ISSUE_NONE,
    .staleness = 0,
  };
}

void init_staleness() {
  app_start_time = time(NULL);
}

void staleness_on_request_state_changed(RequestState state) {
  if (state != REQUEST_STATE_WAITING) {
    ever_seen_request_complete = true;
  }
  if (state == REQUEST_STATE_SUCCESS || state == REQUEST_STATE_BAD_APP_MESSAGE || state == REQUEST_STATE_FETCH_ERROR) {
    ever_had_phone_contact = true;
    last_phone_contact = time(NULL);
  }
}

void staleness_on_data_received(int32_t recency) {
  ever_received_data = true;
  last_successful_phone_contact = time(NULL);
  last_data_staleness_wrt_phone = recency;
}
