#pragma once

#include "comm.h"

enum {
  CONNECTION_ISSUE_NONE,
  CONNECTION_ISSUE_BLUETOOTH,
  CONNECTION_ISSUE_NETWORK,
  CONNECTION_ISSUE_RIG,
};

typedef struct ConnectionIssue {
  unsigned int reason:2;
  uint32_t staleness;
} ConnectionIssue;

uint32_t graph_staleness_padding();
ConnectionIssue connection_issue();
void init_staleness();
void staleness_on_request_state_changed(RequestState state);
void staleness_on_data_received(int32_t recency);
