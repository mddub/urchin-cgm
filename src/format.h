#pragma once

#include <pebble.h>

const char* get_error_string(int mgdl);
void format_bg(char* buffer, char buf_size, int mgdl, bool is_delta, bool use_mmol);
