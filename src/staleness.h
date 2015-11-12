#pragma once

#include <pebble.h>

enum {
  CONNECTION_ISSUE_NONE,
  CONNECTION_ISSUE_BLUETOOTH,
  CONNECTION_ISSUE_NETWORK,
  CONNECTION_ISSUE_RIG,
};

typedef struct ConnectionIssue {
  unsigned int reason:2;
  int staleness;
} ConnectionIssue;

bool ever_had_phone_contact();
bool ever_received_data();
int phone_to_pebble_staleness();
int web_to_phone_staleness();
int rig_to_web_staleness();
int total_data_staleness();
ConnectionIssue connection_issue();
void staleness_update(DictionaryIterator *data);
