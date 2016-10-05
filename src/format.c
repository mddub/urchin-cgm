#include "format.h"
#include "preferences.h"

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

void format_status_bar_text(char* buffer, uint16_t buf_size, DataMessage *d) {
  int32_t recency = time(NULL) - d->received_at + d->status_recency;
  int32_t minutes = (float)recency / 60.0f + 0.5f;

  if (d->status_recency == -1 || (get_prefs()->status_min_recency_to_show_minutes > 0 && minutes <= get_prefs()->status_min_recency_to_show_minutes)) {

    strcpy(buffer, d->status_text);

  } else if (minutes > get_prefs()->status_max_age_minutes) {

    strcpy(buffer, "-");

  } else {

    static char recency_str[16];
    if (minutes < 60) {
      snprintf(recency_str, 16, "%d", (int)minutes);
    } else {
      int32_t hours = minutes / 60;
      snprintf(recency_str, 16, "%dh%d", (int)hours, (int)(minutes - 60 * hours));
    }

    switch(get_prefs()->status_recency_format) {
      case STATUS_RECENCY_FORMAT_PAREN_LEFT:
        snprintf(buffer, buf_size, "(%s) %s", recency_str, d->status_text);
        break;
      case STATUS_RECENCY_FORMAT_BRACKET_LEFT:
        snprintf(buffer, buf_size, "[%s] %s", recency_str, d->status_text);
        break;
      case STATUS_RECENCY_FORMAT_COLON_LEFT:
        snprintf(buffer, buf_size, "%s: %s", recency_str, d->status_text);
        break;
      case STATUS_RECENCY_FORMAT_CLOSE_PAREN_LEFT:
        snprintf(buffer, buf_size, "%s) %s", recency_str, d->status_text);
        break;
      case STATUS_RECENCY_FORMAT_PLAIN_LEFT:
        snprintf(buffer, buf_size, "%s %s", recency_str, d->status_text);
        break;
      case STATUS_RECENCY_FORMAT_PAREN_RIGHT:
        snprintf(buffer, buf_size, "%s (%s)", d->status_text, recency_str);
        break;
      case STATUS_RECENCY_FORMAT_BRACKET_RIGHT:
        snprintf(buffer, buf_size, "%s [%s]", d->status_text, recency_str);
        break;
      default:
        break;
    }

  }
}
