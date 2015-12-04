#include "format.h"

const char* get_error_string(int mgdl) {
  switch(mgdl) {
    // From https://github.com/nightscout/cgm-remote-monitor/blob/master/lib/plugins/errorcodes.js
    case 12: return "?RF"; // BAD_RF
    case 10: return "???"; // POWER_DEVIATION
    case 9:  return "?AD"; // ABSOLUTE_DEVIATION
    case 6:  return "?CD"; // COUNTS_DEVIATION
    case 5:  return "?NC"; // SENSOR_NOT_CALIBRATED
    case 3:  return "?NA"; // NO_ANTENNA
    case 2:  return "?MD"; // MINIMAL_DEVIATION
    case 1:  return "?SN"; // SENSOR_NOT_ACTIVE

    // JS indicates that there is no recent SGV on the server
    case 0:  return "-";

    default: return NULL;
  }
}

void format_bg(char* buffer, char buf_size, int mgdl, bool is_delta, bool use_mmol) {
  const char* error_string = get_error_string(mgdl);
  if (!is_delta && error_string != NULL) {
    strcpy(buffer, error_string);
    return;
  }

  char* plus_minus;
  if (is_delta) {
    plus_minus = mgdl >= 0 ? "+" : "-";
    mgdl = (mgdl < 0 ? -1 : 1) * mgdl;
  } else {
    plus_minus = "";
  }

  if (use_mmol) {
    // Pebble snprintf does not support %f:
    // https://forums.getpebble.com/discussion/8743/petition-please-support-float-double-for-snprintf
    int a = mgdl / 18;
    int b = ((float)mgdl - a * 18.0f) / 1.8f + 0.5f;
    if (a == 0 && b == 0) {
      // e.g. "-1 mg/dL" == "+0.0 mmol/L"
      plus_minus = "+";
    }
    snprintf(buffer, buf_size, "%s%d.%d", plus_minus, a, b);
  } else {
    snprintf(buffer, buf_size, "%s%d", plus_minus, mgdl);
  }
}
