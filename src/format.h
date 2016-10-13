#pragma once

#include <pebble.h>
#include "app_messages.h"

void format_bg(char* buffer, char buf_size, int16_t mgdl, bool is_delta, bool use_mmol);
void format_recency(char* buffer, uint16_t buf_size, int32_t seconds);
void format_status_bar_text(char* buffer, uint16_t buf_size, DataMessage *d);
