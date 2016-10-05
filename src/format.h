#pragma once

#include <pebble.h>
#include "app_messages.h"

const char* get_error_string(int mgdl);
void format_bg(char* buffer, char buf_size, int mgdl, bool is_delta, bool use_mmol);
void format_status_bar_text(char* buffer, uint16_t buf_size, DataMessage *d);
